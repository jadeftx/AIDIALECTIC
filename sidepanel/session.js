/**
 * Consensus Engine — Session Management & Actions
 * Handles session CRUD, handoff, interjection, inline insert, consensus, turn, and history.
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  // ===== Session CRUD =====

  async function loadCurrentSession() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
        if (response && response.session) {
          AID.session = response.session;
        }
        resolve();
      });
    });
  }

  function startSession() {
    const context = AID.els.initialContext.value.trim();
    if (!context) {
      AID.els.initialContext.focus();
      return;
    }
    chrome.runtime.sendMessage({ type: 'START_SESSION', context }, (response) => {
      if (response && response.session) {
        AID.session = response.session;
        AID.render();

        const prompt = generateInitialPrompt(context, AID.settings);
        chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: prompt }, () => {
          AID.showToast('Session started — click the arrow on Claude or Gemini to paste', 'success');
        });
      }
    });
  }

  function newSession() {
    chrome.runtime.sendMessage({ type: 'NEW_SESSION' }, () => {
      AID.session = null;
      AID.els.initialContext.value = '';
      AID.render();
    });
  }

  // ===== Handoff =====

  function prepareHandoff() {
    if (!AID.session || !AID.session.nextTurn) return;

    const target = AID.session.nextTurn;
    const prompt = generateHandoffPrompt(AID.session, target, AID.settings);

    chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: prompt }, () => {
      AID.showToast(`Handoff ready! Click the arrow on ${capitalize(target)}'s page to paste.`, 'success');
    });

    navigator.clipboard.writeText(prompt).catch(() => {});
  }

  // ===== Interjection =====

  function getLastAISource() {
    if (!AID.session || !AID.session.messages.length) return null;
    for (let i = AID.session.messages.length - 1; i >= 0; i--) {
      const src = AID.session.messages[i].source;
      if (src === 'claude' || src === 'gemini') return src;
    }
    return null;
  }

  function showInterjection() {
    const target = getLastAISource();
    if (!target) return;
    AID.els.interjectionTarget.textContent = capitalize(target);
    AID.els.interjectionTargetBtn.textContent = capitalize(target);
    AID.els.interjectionSection.classList.remove('hidden');
    AID.els.interjectionText.focus();
  }

  function hideInterjection() {
    AID.els.interjectionSection.classList.add('hidden');
    AID.els.interjectionText.value = '';
  }

  function submitInterjection() {
    const text = AID.els.interjectionText.value.trim();
    if (!text) return;

    const target = getLastAISource();
    if (!target) return;

    chrome.runtime.sendMessage(
      {
        type: 'CAPTURE_RESPONSE',
        source: 'user',
        content: text,
      },
      (response) => {
        if (response && response.session) {
          AID.session = response.session;
        }
        AID.render();
      },
    );

    chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: text }, () => {
      AID.showToast(`Reply ready — click the arrow on ${capitalize(target)}'s page to paste`, 'success');
    });

    hideInterjection();
  }

  // ===== Turn Override =====

  function toggleTurn() {
    if (!AID.session || !AID.session.nextTurn) return;
    const newTurn = AID.session.nextTurn === 'claude' ? 'gemini' : 'claude';
    chrome.runtime.sendMessage(
      {
        type: 'SET_NEXT_TURN',
        nextTurn: newTurn,
      },
      (response) => {
        if (response && response.session) {
          AID.session = response.session;
          AID.render();
          AID.showToast(`Switched to ${capitalize(newTurn)}'s turn`, 'success');
        }
      },
    );
  }

  // ===== Inline Insert =====

  function showInlineInsert(insertIdx, anchorEl) {
    AID.pendingInsertIndex = insertIdx;
    AID.els.inlineInsertForm.classList.remove('hidden');
    AID.els.inlineInsertContent.value = '';
    if (anchorEl && anchorEl.parentNode) {
      anchorEl.parentNode.insertBefore(AID.els.inlineInsertForm, anchorEl.nextSibling);
    }
    AID.els.inlineInsertContent.focus();
  }

  function hideInlineInsert() {
    AID.els.inlineInsertForm.classList.add('hidden');
    AID.els.inlineInsertContent.value = '';
    AID.pendingInsertIndex = null;
  }

  function submitInlineInsert() {
    const content = AID.els.inlineInsertContent.value.trim();
    if (!content || AID.pendingInsertIndex == null) return;

    const source = AID.els.inlineInsertSource.value;

    chrome.runtime.sendMessage(
      {
        type: 'INSERT_MESSAGE',
        source,
        content,
        insertIndex: AID.pendingInsertIndex,
      },
      (response) => {
        if (response && response.session) {
          AID.session = response.session;
          AID.render();
          AID.showToast('Message inserted', 'success');
        } else {
          AID.showToast(response?.error || 'Insert failed', 'error');
        }
      },
    );

    hideInlineInsert();
  }

  // ===== Consensus =====

  function markConsensus() {
    if (!AID.session) return;

    if (AID.session.consensusReached) {
      chrome.runtime.sendMessage({ type: 'REOPEN_CONSENSUS' }, (response) => {
        if (response && response.session) {
          AID.session = response.session;
          AID.render();
          AID.showToast('Session reopened', 'success');
        }
      });
    } else {
      if (!confirm('Mark the last response as the consensus result?')) return;
      chrome.runtime.sendMessage({ type: 'MARK_CONSENSUS' }, (response) => {
        if (response && response.session) {
          AID.session = response.session;
          AID.render();
          AID.showToast('Consensus marked!', 'success');
        }
      });
    }
  }

  // ===== Sessions List =====

  function showSessionsView() {
    AID.els.viewConversation.classList.remove('active');
    AID.els.viewSessions.classList.add('active');
    loadSessionsList();
  }

  function showConversationView() {
    AID.els.viewSessions.classList.remove('active');
    AID.els.viewConversation.classList.add('active');
    AID.render();
  }

  function loadSessionsList() {
    chrome.runtime.sendMessage({ type: 'GET_ALL_SESSIONS' }, (response) => {
      if (!response || !response.sessions) return;
      renderSessionsList(response.sessions);
    });
  }

  function renderSessionsList(sessions) {
    AID.els.sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      AID.els.sessionsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128196;</div>
          <div class="empty-state-text">No past sessions yet.<br>Start a new session to begin.</div>
        </div>
      `;
      return;
    }

    for (const s of sessions) {
      const item = document.createElement('div');
      item.className = 'session-item';

      const preview = s.initialContext
        ? s.initialContext.slice(0, 80) + (s.initialContext.length > 80 ? '...' : '')
        : 'No context';
      const date = new Date(s.createdAt).toLocaleDateString();
      const consensusLabel = s.consensusReached ? ' [Consensus]' : '';

      item.innerHTML = `
        <div class="session-item-title">${escapeHtml(preview)}</div>
        <div class="session-item-meta">
          <span>${date}</span>
          <span>${s.round} rounds</span>
          <span>${s.messageCount} messages${consensusLabel}</span>
        </div>
        <div class="session-item-actions">
          <button class="btn btn-sm btn-secondary btn-load" data-id="${s.id}">Load</button>
          <button class="btn btn-sm btn-ghost btn-delete" data-id="${s.id}">Delete</button>
        </div>
      `;

      item.querySelector('.btn-load').addEventListener('click', (e) => {
        e.stopPropagation();
        loadSessionById(s.id);
      });

      item.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteSessionById(s.id);
      });

      AID.els.sessionsList.appendChild(item);
    }
  }

  function loadSessionById(id) {
    chrome.runtime.sendMessage({ type: 'LOAD_SESSION', sessionId: id }, (response) => {
      if (response && response.session) {
        AID.session = response.session;
        showConversationView();
      }
    });
  }

  function deleteSessionById(id) {
    if (!confirm('Delete this session?')) return;
    chrome.runtime.sendMessage({ type: 'DELETE_SESSION', sessionId: id }, () => {
      loadSessionsList();
    });
  }

  // Public API
  AID.loadCurrentSession = loadCurrentSession;
  AID.startSession = startSession;
  AID.newSession = newSession;
  AID.prepareHandoff = prepareHandoff;
  AID.getLastAISource = getLastAISource;
  AID.showInterjection = showInterjection;
  AID.hideInterjection = hideInterjection;
  AID.submitInterjection = submitInterjection;
  AID.toggleTurn = toggleTurn;
  AID.showInlineInsert = showInlineInsert;
  AID.hideInlineInsert = hideInlineInsert;
  AID.submitInlineInsert = submitInlineInsert;
  AID.markConsensus = markConsensus;
  AID.showSessionsView = showSessionsView;
  AID.showConversationView = showConversationView;
})();
