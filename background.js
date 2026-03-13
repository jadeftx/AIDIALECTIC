/**
 * Consensus Engine — Background Service Worker
 * Handles message routing, state management, and side panel lifecycle.
 */

// ===== State =====

let currentSession = null;
let pendingPush = null; // Content to paste into AI chat input
let pendingPushLoaded = false; // Whether we've restored pendingPush from storage

const DEFAULT_SESSION = () => ({
  id: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  initialContext: '',
  messages: [],
  round: 0,
  nextTurn: null, // 'claude' | 'gemini' | null
  startingAI: null, // which AI kicked off the dialectic (first to respond)
  pendingInterjection: null,
  consensusReached: false,
  consensusAt: null,
});

// ===== SPA Navigation Detection =====
// Content scripts run in Chrome's Isolated World and cannot hook history.pushState.
// Use webNavigation API to detect in-app navigation (switching conversations).

chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (details.frameId !== 0) return; // top frame only
    chrome.tabs.sendMessage(details.tabId, { type: 'spa-navigated' }).catch(() => {
      // Content script may not be ready yet
    });
  },
  {
    url: [{ hostContains: 'claude.ai' }, { hostContains: 'gemini.google.com' }],
  },
);

// ===== Keyboard Shortcut: Inject Captured Text =====

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'inject-captured') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { type: 'inject-captured-text' }).catch(() => {});
    }
  }
});

// ===== Side Panel Setup =====

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// Enable side panel on supported pages
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

// ===== Message Handling =====

// Ensure session is restored from storage before handling any message.
// MV3 service workers can go idle and lose in-memory state at any time.
async function ensureSession() {
  if (!currentSession) {
    await restoreSession();
  }
  if (!pendingPushLoaded) {
    const data = await chrome.storage.local.get('pendingPush');
    pendingPush = data.pendingPush || null;
    pendingPushLoaded = true;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // All branches go through the async ensureSession() path so we always
  // return true (will call sendResponse asynchronously).
  (async () => {
    await ensureSession();

    switch (message.type) {
      case 'CAPTURE_RESPONSE':
        return await handleCapture(message, sender);

      case 'AUTO_CAPTURED':
        return await handleAutoCapture(message, sender);

      case 'CLEAR_BADGE':
        chrome.action.setBadgeText({ text: '' });
        return { ok: true };

      case 'GET_SESSION':
        return { session: currentSession };

      case 'START_SESSION':
        currentSession = DEFAULT_SESSION();
        currentSession.initialContext = message.context || '';
        await saveSession();
        // Pending push is now set by the sidepanel with dialectic framing
        return { session: currentSession };

      case 'NEW_SESSION':
        currentSession = null;
        await chrome.storage.local.remove('currentSessionId');
        await setPendingPush(null);
        return { ok: true };

      case 'SET_INTERJECTION':
        if (currentSession) {
          currentSession.pendingInterjection = message.text || null;
          await saveSession();
        }
        return { ok: true };

      case 'MARK_CONSENSUS':
        return await handleConsensus();

      case 'REOPEN_CONSENSUS':
        return await handleReopenConsensus();

      case 'GET_ALL_SESSIONS':
        return await getAllSessions();

      case 'LOAD_SESSION':
        return await loadSession(message.sessionId);

      case 'DELETE_SESSION':
        return await deleteSession(message.sessionId);

      case 'EXPORT_SESSION':
        return { session: currentSession };

      case 'EXPORT_ALL_DATA':
        return await exportAllData();

      case 'IMPORT_ALL_DATA':
        return await importAllData(message.data);

      case 'PUSH_GITHUB':
        return await pushToGitHub(message.session, message.settings);

      case 'GET_BUTTON_MODE':
        return { mode: pendingPush ? 'push' : 'pull' };

      case 'GET_PUSH_CONTENT':
        return { content: pendingPush };

      case 'PUSH_COMPLETE':
        await setPendingPush(null);
        return { ok: true };

      case 'SET_PENDING_PUSH':
        await setPendingPush(message.content || null);
        return { ok: true };

      case 'INSERT_MESSAGE':
        return await handleInsertMessage(message);

      case 'UPDATE_MESSAGE_SOURCE':
        return await handleUpdateMessageSource(message);

      case 'DELETE_MESSAGE':
        return await handleDeleteMessage(message);

      case 'SET_NEXT_TURN':
        return await handleSetNextTurn(message);

      default:
        return { error: 'Unknown message type' };
    }
  })().then(sendResponse);

  return true; // async — all paths call sendResponse via the promise
});

// ===== Capture Handler =====

async function handleCapture(message, sender) {
  if (!currentSession) {
    // Auto-create session if none exists
    currentSession = DEFAULT_SESSION();
  }

  const source = message.source; // 'claude' | 'gemini' | 'user'
  const content = message.content;

  if (!content || !content.trim()) {
    return { error: 'Empty response captured' };
  }

  // User interjections don't affect round counting or turn order
  if (source === 'user') {
    const msg = {
      id: crypto.randomUUID(),
      source: 'user',
      content,
      timestamp: new Date().toISOString(),
      round: currentSession.round,
    };
    currentSession.messages.push(msg);
    await saveSession();
    broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
    return { ok: true, session: currentSession };
  }

  // A "round" is one full cycle: starting AI → other AI → back to starting AI.
  // The round only advances when the starting AI responds again after the
  // other AI has already responded this round. This means user interjections
  // (and the replies they trigger) don't prematurely bump the round.
  const otherModel = source === 'claude' ? 'gemini' : 'claude';

  if (!currentSession.startingAI) {
    // First AI message ever — record who started and begin round 1
    currentSession.startingAI = source;
    currentSession.round++;
  } else if (source === currentSession.startingAI) {
    // The starting AI is responding — check if the other AI already
    // responded this round (meaning the cycle is complete).
    const currentRoundAIs = new Set(
      currentSession.messages
        .filter((m) => m.round === currentSession.round && (m.source === 'claude' || m.source === 'gemini'))
        .map((m) => m.source),
    );
    if (currentRoundAIs.has(otherModel)) {
      // Other AI already responded this round — new round
      currentSession.round++;
    }
  }
  // If the non-starting AI responds (including after a user interjection),
  // stay in the current round — the cycle hasn't completed yet.

  currentSession.pendingInterjection = null;

  const msg = {
    id: crypto.randomUUID(),
    source,
    content,
    timestamp: new Date().toISOString(),
    round: currentSession.round,
  };

  currentSession.messages.push(msg);
  currentSession.nextTurn = otherModel;

  await saveSession();

  // Notify side panel
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });

  return { ok: true, session: currentSession };
}

// ===== Auto-Capture Handler =====

async function handleAutoCapture(message, sender) {
  const captureResult = await handleCapture(message, sender);

  if (captureResult.ok) {
    await chrome.storage.local.set({
      autoCapturedText: message.content,
      autoCapturedSource: message.source,
      autoCapturedAt: new Date().toISOString(),
    });

    const badge = message.source === 'claude' ? 'C' : 'G';
    chrome.action.setBadgeText({ text: badge });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' }); // green
  }

  return captureResult;
}

// ===== Consensus =====

async function handleConsensus() {
  if (!currentSession) return { error: 'No active session' };

  currentSession.consensusReached = true;
  currentSession.consensusAt = new Date().toISOString();

  const lastAI = [...currentSession.messages].reverse().find((m) => m.source === 'claude' || m.source === 'gemini');
  if (lastAI) {
    lastAI.isConsensus = true;
  }

  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

async function handleReopenConsensus() {
  if (!currentSession) return { error: 'No active session' };

  currentSession.consensusReached = false;
  currentSession.consensusAt = null;

  for (const msg of currentSession.messages) {
    if (msg.isConsensus) {
      delete msg.isConsensus;
    }
  }

  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

// ===== Recompute Session State =====
// Recalculates round assignments, startingAI, round counter, and nextTurn
// from the message sequence. Called after any manual mutation (insert, delete,
// source change) so the session metadata stays consistent with the messages.

function recomputeSessionState(session) {
  session.startingAI = null;
  session.round = 0;

  let currentRoundAIs = new Set();

  for (const msg of session.messages) {
    const source = msg.source;

    if (source === 'user') {
      msg.round = session.round;
      continue;
    }

    const otherModel = source === 'claude' ? 'gemini' : 'claude';

    if (!session.startingAI) {
      session.startingAI = source;
      session.round++;
      currentRoundAIs = new Set();
    } else if (source === session.startingAI && currentRoundAIs.has(otherModel)) {
      session.round++;
      currentRoundAIs = new Set();
    }

    currentRoundAIs.add(source);
    msg.round = session.round;
  }

  const lastAI = [...session.messages].reverse().find((m) => m.source === 'claude' || m.source === 'gemini');
  if (lastAI) {
    session.nextTurn = lastAI.source === 'claude' ? 'gemini' : 'claude';
  } else {
    session.nextTurn = null;
  }
}

// ===== Insert Message =====

async function handleInsertMessage(message) {
  if (!currentSession) return { error: 'No active session' };

  const { source, content, insertIndex } = message;
  if (!content || !content.trim()) return { error: 'Empty content' };

  const msg = {
    id: crypto.randomUUID(),
    source,
    content,
    timestamp: new Date().toISOString(),
    round: 0, // will be recomputed
  };

  const idx = Math.min(Math.max(0, insertIndex), currentSession.messages.length);
  currentSession.messages.splice(idx, 0, msg);

  recomputeSessionState(currentSession);
  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

// ===== Update Message Source =====

async function handleUpdateMessageSource(message) {
  if (!currentSession) return { error: 'No active session' };

  const { messageId, newSource } = message;
  const validSources = ['claude', 'gemini', 'user'];
  if (!validSources.includes(newSource)) return { error: 'Invalid source' };

  const msg = currentSession.messages.find((m) => m.id === messageId);
  if (!msg) return { error: 'Message not found' };

  msg.source = newSource;
  recomputeSessionState(currentSession);
  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

// ===== Delete Message =====

async function handleDeleteMessage(message) {
  if (!currentSession) return { error: 'No active session' };

  const { messageId } = message;
  const idx = currentSession.messages.findIndex((m) => m.id === messageId);
  if (idx === -1) return { error: 'Message not found' };

  currentSession.messages.splice(idx, 1);
  recomputeSessionState(currentSession);
  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

// ===== Set Next Turn =====

async function handleSetNextTurn(message) {
  if (!currentSession) return { error: 'No active session' };

  const { nextTurn } = message;
  if (nextTurn !== 'claude' && nextTurn !== 'gemini') return { error: 'Invalid turn' };

  currentSession.nextTurn = nextTurn;
  await saveSession();
  broadcastToSidePanel({ type: 'SESSION_UPDATED', session: currentSession });
  return { ok: true, session: currentSession };
}

// ===== Storage =====

async function saveSession() {
  if (!currentSession) return;
  const key = `session_${currentSession.id}`;
  await chrome.storage.local.set({
    [key]: currentSession,
    currentSessionId: currentSession.id,
  });
}

async function getAllSessions() {
  const data = await chrome.storage.local.get(null);
  const sessions = [];
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('session_') && value && value.id) {
      sessions.push({
        id: value.id,
        createdAt: value.createdAt,
        initialContext: value.initialContext,
        round: value.round,
        messageCount: value.messages ? value.messages.length : 0,
        consensusReached: value.consensusReached,
      });
    }
  }
  sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { sessions };
}

async function loadSession(sessionId) {
  const key = `session_${sessionId}`;
  const data = await chrome.storage.local.get(key);
  if (data[key]) {
    currentSession = data[key];
    return { session: currentSession };
  }
  return { error: 'Session not found' };
}

async function deleteSession(sessionId) {
  const key = `session_${sessionId}`;
  await chrome.storage.local.remove(key);
  if (currentSession && currentSession.id === sessionId) {
    currentSession = null;
    await chrome.storage.local.remove('currentSessionId');
  }
  return { ok: true };
}

// ===== Restore Session on Startup =====

chrome.runtime.onStartup.addListener(async () => {
  await restoreSession();
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await restoreSession();
  // Track version for migration and to verify data persists across updates
  const manifest = chrome.runtime.getManifest();
  await chrome.storage.local.set({
    _extensionVersion: manifest.version,
    _lastInstallReason: details.reason, // 'install' | 'update' | 'chrome_update'
    _lastInstallTime: new Date().toISOString(),
  });

  // Re-inject content scripts into already-open tabs after extension update/reload.
  // MV3 content scripts are orphaned when the extension reloads — they lose their
  // chrome.runtime connection. Re-injecting restores auto-capture, the arrow button,
  // and all other content script functionality without requiring the user to refresh.
  if (details.reason === 'update' || details.reason === 'install') {
    const targets = [
      {
        origin: 'https://claude.ai',
        scripts: ['content/shared.js', 'content/provider-base.js', 'content/claude.js'],
        css: ['content/capture-button.css'],
      },
      {
        origin: 'https://gemini.google.com',
        scripts: ['content/shared.js', 'content/provider-base.js', 'content/gemini.js'],
        css: ['content/capture-button.css'],
      },
    ];
    for (const target of targets) {
      try {
        const tabs = await chrome.tabs.query({ url: target.origin + '/*' });
        for (const tab of tabs) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: target.scripts,
            })
            .catch(() => {});
          chrome.scripting
            .insertCSS({
              target: { tabId: tab.id },
              files: target.css,
            })
            .catch(() => {});
        }
      } catch {
        // Tab may not be scriptable
      }
    }
  }
});

async function restoreSession() {
  const data = await chrome.storage.local.get('currentSessionId');
  if (data.currentSessionId) {
    const key = `session_${data.currentSessionId}`;
    const sessionData = await chrome.storage.local.get(key);
    if (sessionData[key]) {
      currentSession = sessionData[key];
    }
  }
}

// ===== Bulk Export / Import =====

async function exportAllData() {
  const data = await chrome.storage.local.get(null);
  const sessions = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith('session_') && value && value.id) {
      sessions[key] = value;
    }
  }
  return {
    ok: true,
    payload: {
      version: chrome.runtime.getManifest().version,
      exportedAt: new Date().toISOString(),
      currentSessionId: data.currentSessionId || null,
      sessions,
    },
  };
}

async function importAllData(data) {
  if (!data || !data.sessions) {
    return { error: 'Invalid import data' };
  }
  // Merge imported sessions (won't overwrite existing ones with same key)
  const existing = await chrome.storage.local.get(null);
  let imported = 0;
  for (const [key, value] of Object.entries(data.sessions)) {
    if (!existing[key]) {
      await chrome.storage.local.set({ [key]: value });
      imported++;
    }
  }
  return { ok: true, imported };
}

// ===== GitHub Push =====

async function pushToGitHub(session, settings) {
  if (!settings || !settings.githubToken || !settings.githubRepo) {
    return { error: 'GitHub settings not configured' };
  }

  const { githubToken, githubRepo, githubPath } = settings;

  // Parse repo: "owner/repo"
  const repoParts = githubRepo.replace(/^https?:\/\/github\.com\//, '').replace(/\/$/, '');
  const [owner, repo] = repoParts.split('/');
  if (!owner || !repo) {
    return { error: 'Invalid GitHub repo format. Use owner/repo' };
  }

  const filename = `consensus-${session.id.slice(0, 8)}-${formatDateForFilename(session.createdAt)}.md`;
  const filePath = githubPath ? `${githubPath.replace(/\/$/, '')}/${filename}` : filename;
  const content = generateMarkdownExport(session);
  const contentBase64 = btoa(unescape(encodeURIComponent(content)));

  let sha = null;
  try {
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (checkRes.ok) {
      const existing = await checkRes.json();
      sha = existing.sha;
    }
  } catch (e) {
    // Expected if file doesn't exist yet
  }

  try {
    const body = {
      message: `Add consensus transcript: ${filename}`,
      content: contentBase64,
    };
    if (sha) body.sha = sha;

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json();
      return { error: `GitHub API error: ${err.message || res.statusText}` };
    }

    const result = await res.json();
    return { ok: true, url: result.content.html_url };
  } catch (e) {
    return { error: `GitHub push failed: ${e.message}` };
  }
}

// ===== Export Helpers =====
// NOTE: Duplicated across sidepanel and background for MV3 service worker stability. Keep in sync.

function generateMarkdownExport(session) {
  const lines = [];
  lines.push(`# AIDIALECTIC Transcript`);
  lines.push('');
  lines.push(`**Session ID:** ${session.id}`);
  lines.push(`**Created:** ${new Date(session.createdAt).toLocaleString()}`);
  lines.push(`**Rounds:** ${session.round}`);
  lines.push(`**Consensus:** ${session.consensusReached ? 'Yes' : 'No'}`);
  lines.push('');

  if (session.initialContext) {
    lines.push('## Initial Context');
    lines.push('');
    lines.push(session.initialContext);
    lines.push('');
  }

  lines.push('## Conversation');
  lines.push('');

  let lastRound = 0;
  for (const msg of session.messages) {
    if (msg.round && msg.round !== lastRound) {
      lastRound = msg.round;
      lines.push(`---`);
      lines.push(`### Round ${msg.round}`);
      lines.push('');
    }

    const label =
      msg.source === 'user' ? '[User Interjection]' : `[${msg.source.charAt(0).toUpperCase() + msg.source.slice(1)}]`;
    const time = new Date(msg.timestamp).toLocaleString();
    const consensusTag = msg.isConsensus ? ' **[CONSENSUS]**' : '';

    lines.push(`#### ${label} — ${time}${consensusTag}`);
    lines.push('');
    lines.push(msg.content);
    lines.push('');
  }

  return lines.join('\n');
}

function formatDateForFilename(isoString) {
  const d = new Date(isoString);
  return d.toISOString().slice(0, 10);
}

// ===== Push State =====

async function setPendingPush(content) {
  pendingPush = content;
  pendingPushLoaded = true;
  if (content) {
    await chrome.storage.local.set({ pendingPush: content });
  } else {
    await chrome.storage.local.remove('pendingPush');
  }
  broadcastButtonMode();
}

function broadcastButtonMode() {
  const mode = pendingPush ? 'push' : 'pull';
  chrome.tabs.query({ url: ['https://claude.ai/*', 'https://gemini.google.com/*'] }, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { type: 'BUTTON_MODE', mode }).catch(() => {});
    }
  });
}

// ===== Broadcast =====

function broadcastToSidePanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Side panel might not be open
  });
}
