/**
 * Consensus Engine — Side Panel
 * Main UI controller for the conversation thread, handoff generation,
 * interjection, export, and session management.
 */

(function () {
  'use strict';

  // ===== State =====
  let session = null;
  let settings = {};

  // ===== DOM Refs =====
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    roundCounter: $('#round-counter'),
    turnIndicator: $('#turn-indicator'),
    thread: $('#thread'),
    initialContextSection: $('#initial-context-section'),
    initialContext: $('#initial-context'),
    btnStartSession: $('#btn-start-session'),
    btnNewSession: $('#btn-new-session'),
    btnSessionsList: $('#btn-sessions-list'),
    btnSettings: $('#btn-settings'),
    actionBar: $('#action-bar'),
    btnPrepareHandoff: $('#btn-prepare-handoff'),
    handoffTarget: $('#handoff-target'),
    btnInterject: $('#btn-interject'),
    replyTarget: $('#reply-target'),
    consensusBar: $('#consensus-bar'),
    btnConsensus: $('#btn-consensus'),
    btnExportToggle: $('#btn-export-toggle'),
    exportDropdown: $('#export-dropdown'),
    btnExportMdHeader: $('#btn-export-md-header'),
    btnExportJsonHeader: $('#btn-export-json-header'),
    btnPushGithubHeader: $('#btn-push-github-header'),
    exportDropdownStatus: $('#export-dropdown-status'),
    interjectionSection: $('#interjection-section'),
    interjectionText: $('#interjection-text'),
    interjectionTarget: $('#interject-target'),
    interjectionTargetBtn: $('#interject-target-btn'),
    btnSubmitInterject: $('#btn-submit-interject'),
    btnCancelInterject: $('#btn-cancel-interject'),
    inlineInsertForm: $('#inline-insert-form'),
    inlineInsertSource: $('#inline-insert-source'),
    inlineInsertContent: $('#inline-insert-content'),
    btnSubmitInlineInsert: $('#btn-submit-inline-insert'),
    btnCancelInlineInsert: $('#btn-cancel-inline-insert'),
    viewConversation: $('#view-conversation'),
    viewSessions: $('#view-sessions'),
    sessionsList: $('#sessions-list'),
    btnBackConversation: $('#btn-back-conversation'),
    exportModal: $('#export-modal'),
    btnExportMd: $('#btn-export-md'),
    btnExportJson: $('#btn-export-json'),
    btnPushGithub: $('#btn-push-github'),
    btnCloseModal: $('#btn-close-modal'),
    btnCloseModalX: $('#btn-close-modal-x'),
    exportStatus: $('#export-status'),
    btnHelp: $('#btn-help'),
    helpModal: $('#help-modal'),
    btnCloseHelp: $('#btn-close-help'),
    btnThemeToggle: $('#btn-theme-toggle'),
    btnFontUp: $('#btn-font-up'),
    btnFontDown: $('#btn-font-down'),
    modLength: $('#mod-length'),
    modTone: $('#mod-tone'),
    modVector: $('#mod-vector'),
    modifierGroupVector: $('#modifier-group-vector'),
    toggleBrainstorm: $('#settings-toggle-brainstorm'),
    modLengthLabel: document.querySelector('label[for="mod-length"]'),
    modToneLabel: document.querySelector('label[for="mod-tone"]'),
    brandSubtitle: $('.brand-text .subtitle'),
  };

  // ===== Init =====

  async function init() {
    await initTheme();
    await initUIZoom();
    await loadSettings();
    if (els.brandSubtitle) {
      els.brandSubtitle.textContent = settings.brainstormMode ? 'BRAINSTORM SESSION' : 'CONSENSUS WORKFLOW';
    }
    await loadCurrentSession();
    bindEvents();
    bindSettingsEvents();
    render();
  }

  // ===== Theme =====

  async function initTheme() {
    return new Promise((resolve) => {
      chrome.storage.local.get('ce_theme', (data) => {
        const theme = data.ce_theme || 'light';
        applyTheme(theme);
        resolve();
      });
    });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const logo = $('#brand-logo');
    if (logo) {
      const src = theme === 'dark' ? logo.dataset.dark : logo.dataset.light;
      if (src) logo.src = src;
    }
    document.querySelectorAll('.deftx-footer-logo').forEach((img) => {
      const src = theme === 'dark' ? img.dataset.dark : img.dataset.light;
      if (src) img.src = src;
    });
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    chrome.storage.local.set({ ce_theme: next });
  }

  // ===== UI Zoom (replaces font-size-only control) =====

  const IDEAL_WIDTH = 400;
  const ZOOM_MIN = 0.5;
  const ZOOM_MAX = 2.0;
  const ZOOM_DEFAULT = 0.815;
  const ZOOM_STEP = 0.1;

  let userZoom = ZOOM_DEFAULT;

  function initUIZoom() {
    return new Promise((resolve) => {
      chrome.storage.local.get('ce_ui_zoom', (data) => {
        userZoom = data.ce_ui_zoom || ZOOM_DEFAULT;
        applyUIScale();
        window.addEventListener('resize', applyUIScale);
        resolve();
      });
    });
  }

  function applyUIScale() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const panelScale = Math.min(1, w / IDEAL_WIDTH);
    const totalZoom = panelScale * userZoom;

    document.body.style.width = w / totalZoom + 'px';
    document.body.style.height = h / totalZoom + 'px';
    document.body.style.zoom = totalZoom;
  }

  function changeZoom(direction) {
    userZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round((userZoom + direction * ZOOM_STEP) * 100) / 100));
    chrome.storage.local.set({ ce_ui_zoom: userZoom });
    applyUIScale();
  }

  // ===== Settings =====

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ce_settings', 'ce_modifiers'], (data) => {
        settings = data.ce_settings || {};
        const legacy = data.ce_modifiers;
        if (legacy) {
          if (!settings.modLength && legacy.length) settings.modLength = legacy.length;
          if (!settings.modTone && legacy.tone) settings.modTone = legacy.tone;
          chrome.storage.local.remove('ce_modifiers');
        }
        resolve();
      });
    });
  }

  // ===== Brainstorm UI =====

  function applyBrainstormUI(active) {
    // Update header subtitle
    if (els.brandSubtitle) {
      els.brandSubtitle.textContent = active ? 'BRAINSTORM SESSION' : 'CONSENSUS WORKFLOW';
    }

    // Show/hide vector dropdown
    els.modifierGroupVector.style.display = active ? '' : 'none';

    // Swap Length <-> Expansion
    if (els.modLengthLabel) {
      els.modLengthLabel.textContent = active ? 'Expansion' : 'Length';
    }
    const lengthSelect = els.modLength;
    lengthSelect.innerHTML = '';
    if (active) {
      [['sparks', 'Sparks'], ['seeds', 'Seeds'], ['branches', 'Branches']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        lengthSelect.appendChild(opt);
      });
      lengthSelect.value = settings.modExpansion || 'sparks';
    } else {
      [['normal', 'Normal'], ['short', 'Short'], ['deep', 'Deep Dive']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        lengthSelect.appendChild(opt);
      });
      lengthSelect.value = settings.modLength || 'normal';
    }

    // Swap Tone <-> Perspective
    if (els.modToneLabel) {
      els.modToneLabel.textContent = active ? 'Perspective' : 'Tone';
    }
    const toneSelect = els.modTone;
    toneSelect.innerHTML = '';
    if (active) {
      [['rapid-fire', 'Rapid-Fire'], ['contrarian', 'Contrarian'], ['first-principles', 'First Principles']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        toneSelect.appendChild(opt);
      });
      toneSelect.value = settings.modPerspective || 'rapid-fire';
    } else {
      [['default', 'Default'], ['clinical', 'Clinical'], ['socratic', 'Socratic'], ['sassy', 'Sassy']].forEach(([val, label]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = label;
        toneSelect.appendChild(opt);
      });
      toneSelect.value = settings.modTone || 'default';
    }
  }

  // ===== Settings Modal =====

  function openSettingsModal() {
    const modal = $('#settings-modal');
    $('#settings-github-repo').value = settings.githubRepo || '';
    $('#settings-github-path').value = settings.githubPath || '';
    $('#settings-github-token').value = settings.githubToken || '';
    $('#settings-system-context').value = settings.systemContext || '';
    const toggle = $('#settings-toggle-autocapture');
    toggle.classList.toggle('active', !!settings.autoCapture);
    els.toggleBrainstorm.classList.toggle('active', !!settings.brainstormMode);
    const brainstormActive = !!settings.brainstormMode;
    applyBrainstormUI(brainstormActive);
    els.modVector.value = settings.modVector || 'all';
    modal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    $('#settings-modal').classList.add('hidden');
  }

  function saveSettingsModal() {
    const brainstormActive = els.toggleBrainstorm.classList.contains('active');
    // Merge with existing settings so we never lose keys not shown in the modal
    const updated = {
      ...settings,
      githubRepo: $('#settings-github-repo').value.trim(),
      githubPath: $('#settings-github-path').value.trim(),
      githubToken: $('#settings-github-token').value.trim(),
      systemContext: $('#settings-system-context').value.trim(),
      autoCapture: $('#settings-toggle-autocapture').classList.contains('active'),
      brainstormMode: brainstormActive,
      modVector: els.modVector.value,
    };
    if (brainstormActive) {
      updated.modExpansion = els.modLength.value;
      updated.modPerspective = els.modTone.value;
    } else {
      updated.modLength = els.modLength.value;
      updated.modTone = els.modTone.value;
    }
    settings = updated;
    chrome.storage.local.set({ ce_settings: settings }, () => {
      showSettingsStatus('Settings saved!', 'success');
    });
  }

  function showSettingsStatus(text, type) {
    const el = $('#settings-status');
    el.textContent = text;
    el.className = `settings-status show ${type}`;
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  function settingsExportAll() {
    chrome.runtime.sendMessage({ type: 'EXPORT_ALL_DATA' }, (response) => {
      if (!response || !response.ok) {
        showSettingsStatus('Export failed', 'error');
        return;
      }
      const json = JSON.stringify(response.payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `aidialectic-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSettingsStatus('All sessions exported!', 'success');
    });
  }

  function settingsImportAll() {
    $('#settings-import-file').click();
  }

  function settingsHandleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.runtime.sendMessage({ type: 'IMPORT_ALL_DATA', data }, (response) => {
          if (response && response.ok) {
            showSettingsStatus(`Imported ${response.imported} new session(s)!`, 'success');
          } else {
            showSettingsStatus(response?.error || 'Import failed', 'error');
          }
        });
      } catch (err) {
        showSettingsStatus('Invalid JSON file', 'error');
      }
      $('#settings-import-file').value = '';
    };
    reader.readAsText(file);
  }

  function settingsClearData() {
    if (!confirm('Delete ALL saved sessions? This cannot be undone.')) return;
    chrome.storage.local.get(null, (data) => {
      const sessionKeys = Object.keys(data).filter((k) => k.startsWith('session_'));
      sessionKeys.push('currentSessionId');
      chrome.storage.local.remove(sessionKeys, () => {
        showSettingsStatus('All sessions cleared.', 'success');
      });
    });
  }

  function bindSettingsEvents() {
    $('#btn-close-settings').addEventListener('click', closeSettingsModal);
    $('#settings-modal .modal-backdrop').addEventListener('click', closeSettingsModal);
    $('#settings-btn-save').addEventListener('click', saveSettingsModal);
    $('#settings-btn-export-all').addEventListener('click', settingsExportAll);
    $('#settings-btn-import-all').addEventListener('click', settingsImportAll);
    $('#settings-import-file').addEventListener('change', settingsHandleImport);
    $('#settings-btn-clear-data').addEventListener('click', settingsClearData);
    $('#settings-toggle-autocapture').addEventListener('click', () => {
      $('#settings-toggle-autocapture').classList.toggle('active');
    });
    els.toggleBrainstorm.addEventListener('click', () => {
      els.toggleBrainstorm.classList.toggle('active');
      applyBrainstormUI(els.toggleBrainstorm.classList.contains('active'));
    });
  }

  // ===== Session Management =====

  async function loadCurrentSession() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_SESSION' }, (response) => {
        if (response && response.session) {
          session = response.session;
        }
        resolve();
      });
    });
  }

  function startSession() {
    const context = els.initialContext.value.trim();
    if (!context) {
      els.initialContext.focus();
      return;
    }
    chrome.runtime.sendMessage({ type: 'START_SESSION', context }, (response) => {
      if (response && response.session) {
        session = response.session;
        render();

        // Build initial prompt with dialectic framing (same structure as handoff)
        const prompt = generateInitialPrompt(context, settings);
        chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: prompt }, () => {
          showToast('Session started — click the arrow on Claude or Gemini to paste', 'success');
        });
      }
    });
  }

  function newSession() {
    chrome.runtime.sendMessage({ type: 'NEW_SESSION' }, () => {
      session = null;
      els.initialContext.value = '';
      render();
    });
  }

  // ===== Event Binding =====

  function bindEvents() {
    els.btnStartSession.addEventListener('click', startSession);
    els.btnNewSession.addEventListener('click', newSession);
    els.btnSessionsList.addEventListener('click', showSessionsView);
    els.btnBackConversation.addEventListener('click', showConversationView);
    els.btnSettings.addEventListener('click', openSettingsModal);

    els.btnPrepareHandoff.addEventListener('click', prepareHandoff);
    els.btnInterject.addEventListener('click', showInterjection);
    els.btnConsensus.addEventListener('click', markConsensus);

    els.btnSubmitInterject.addEventListener('click', submitInterjection);
    els.btnCancelInterject.addEventListener('click', hideInterjection);

    els.btnSubmitInlineInsert.addEventListener('click', submitInlineInsert);
    els.btnCancelInlineInsert.addEventListener('click', hideInlineInsert);

    // Export dropdown (header icon)
    els.btnExportToggle.addEventListener('click', toggleExportDropdown);
    els.btnExportMdHeader.addEventListener('click', () => {
      exportMarkdown();
      hideExportDropdown();
    });
    els.btnExportJsonHeader.addEventListener('click', () => {
      exportJSON();
      hideExportDropdown();
    });
    els.btnPushGithubHeader.addEventListener('click', () => {
      pushToGitHub();
    });

    // Export modal (keep for History view usage)
    els.btnExportMd.addEventListener('click', exportMarkdown);
    els.btnExportJson.addEventListener('click', exportJSON);
    els.btnPushGithub.addEventListener('click', pushToGitHub);
    els.btnCloseModal.addEventListener('click', hideExportModal);
    els.btnCloseModalX.addEventListener('click', hideExportModal);
    $('#export-modal .modal-backdrop').addEventListener('click', hideExportModal);

    els.btnThemeToggle.addEventListener('click', toggleTheme);

    els.btnFontUp.addEventListener('click', () => changeZoom(1));
    els.btnFontDown.addEventListener('click', () => changeZoom(-1));

    // Gracefully hide brand logo if image fails to load
    const brandLogo = $('#brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('error', () => brandLogo.classList.add('logo-missing'));
    }

    els.btnHelp.addEventListener('click', showHelp);
    els.btnCloseHelp.addEventListener('click', hideHelp);
    $('#help-modal .modal-backdrop').addEventListener('click', hideHelp);

    // Listen for session updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SESSION_UPDATED') {
        session = message.session;
        render();
      }
    });

    // Keyboard shortcut for initial context
    els.initialContext.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        startSession();
      }
    });
  }

  // ===== Rendering =====

  function render() {
    if (!session) {
      renderNoSession();
    } else {
      renderSession();
    }
  }

  function renderNoSession() {
    els.initialContextSection.classList.remove('hidden');
    els.thread.innerHTML = '';
    els.actionBar.classList.add('hidden');
    els.consensusBar.classList.add('hidden');
    els.interjectionSection.classList.add('hidden');
    els.inlineInsertForm.classList.add('hidden');
    els.roundCounter.textContent = '';
    els.turnIndicator.textContent = 'Start a session';
    els.turnIndicator.className = 'turn-indicator';
  }

  function renderSession() {
    if (session.messages.length > 0 || session.initialContext) {
      els.initialContextSection.classList.add('hidden');
    }

    const roundLabel = session.round > 0 ? `(Round ${session.round})` : '';
    if (session.consensusReached) {
      els.turnIndicator.innerHTML = `CONSENSUS REACHED ${roundLabel} <span class="status-check">&#10004;</span>`;
      els.turnIndicator.className = 'turn-indicator consensus';
      els.turnIndicator.style.color = '';
    } else if (session.nextTurn) {
      // Clickable turn indicator with override
      els.turnIndicator.innerHTML = `<span class="turn-override" title="Click to switch turn">${capitalize(session.nextTurn)}'s turn ${roundLabel} <span class="turn-override-icon">&#9654;</span></span>`;
      els.turnIndicator.className = `turn-indicator ${session.nextTurn}`;
      els.turnIndicator.style.color = '';
      els.turnIndicator.querySelector('.turn-override').addEventListener('click', toggleTurn);
    } else {
      els.turnIndicator.textContent = `Waiting for first capture ${roundLabel}`;
      els.turnIndicator.className = 'turn-indicator';
      els.turnIndicator.style.color = '';
    }
    els.roundCounter.textContent = session.round > 0 ? `Round ${session.round}` : '';

    renderThread();

    // Session stays fully usable even after consensus is marked
    if (session.messages.length > 0) {
      els.actionBar.classList.remove('hidden');
      els.btnPrepareHandoff.classList.remove('hidden');
      if (session.nextTurn) {
        els.handoffTarget.textContent = capitalize(session.nextTurn);
      }
      const lastAI = getLastAISource();
      if (lastAI) {
        els.replyTarget.textContent = capitalize(lastAI);
        els.btnInterject.classList.remove('hidden');
      } else {
        els.btnInterject.classList.add('hidden');
      }
      // Consensus bar: show toggle (mark / unmark)
      els.consensusBar.classList.remove('hidden');
      if (session.consensusReached) {
        els.btnConsensus.textContent = settings.brainstormMode ? 'Reopen Brainstorm' : 'Reopen Session';
        els.btnConsensus.classList.add('btn-consensus-reopen');
      } else {
        els.btnConsensus.textContent = settings.brainstormMode ? 'End Brainstorm' : 'Mark Consensus';
        els.btnConsensus.classList.remove('btn-consensus-reopen');
      }
    } else {
      els.actionBar.classList.add('hidden');
      els.consensusBar.classList.add('hidden');
    }
  }

  function renderThread() {
    if (els.inlineInsertForm.parentNode === els.thread) {
      els.thread.removeChild(els.inlineInsertForm);
    }
    els.thread.innerHTML = '';
    let msgIndex = 0;

    // Helper to add an inline insert button at a given splice index
    function addInsertBtn(insertIdx) {
      const wrapper = document.createElement('div');
      wrapper.className = 'inline-insert-btn';
      const btn = document.createElement('button');
      btn.textContent = '+';
      btn.title = 'Insert message here';
      btn.addEventListener('click', () => showInlineInsert(insertIdx, wrapper));
      wrapper.appendChild(btn);
      els.thread.appendChild(wrapper);
    }

    addInsertBtn(0);

    if (session.initialContext) {
      msgIndex++;
      const ctxDiv = createMessageElement(
        {
          source: 'user',
          content: session.initialContext,
          timestamp: session.createdAt,
          round: 0,
        },
        'Initial Context',
        msgIndex,
        null,
      );
      els.thread.appendChild(ctxDiv);
      addInsertBtn(0); // insert after initial context = index 0 in messages array
    }

    let lastRound = 0;
    for (let i = 0; i < session.messages.length; i++) {
      const msg = session.messages[i];

      if (msg.round && msg.round !== lastRound) {
        lastRound = msg.round;
        const divider = document.createElement('div');
        divider.className = 'round-divider';
        divider.textContent = `Round ${msg.round}`;
        els.thread.appendChild(divider);
      }

      msgIndex++;
      const msgEl = createMessageElement(msg, null, msgIndex, i);
      els.thread.appendChild(msgEl);

      addInsertBtn(i + 1);
    }

    els.thread.scrollTop = els.thread.scrollHeight;
  }

  function createMessageElement(msg, labelOverride, msgIndex, arrayIndex) {
    const div = document.createElement('div');
    const cssClass = msg.isConsensus ? 'consensus' : msg.source;
    div.className = `message ${cssClass}`;

    const label = labelOverride || (msg.source === 'user' ? 'User Interjection' : capitalize(msg.source));
    const consensusTag = msg.isConsensus ? ' [CONSENSUS]' : '';
    const time = formatTime(msg.timestamp);
    const idTag = msgIndex != null ? `<span class="message-id">msgid#${msgIndex}</span>` : '';
    const deletable = arrayIndex != null;

    div.innerHTML = `
      <div class="message-header">
        <span class="message-header-left">${idTag}<span class="source-label" data-msg-id="${msg.id}">${label}</span>${consensusTag ? `<span>${consensusTag}</span>` : ''}</span>
        <span class="message-header-right">
          <span class="message-timestamp">${time}</span>
          <button class="btn-copy" title="Copy message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </button>
          ${
            deletable
              ? `<button class="btn-delete-msg" title="Delete message">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>`
              : ''
          }
        </span>
      </div>
      <div class="message-body"></div>
    `;

    const body = div.querySelector('.message-body');
    if (typeof marked !== 'undefined' && marked.parse) {
      body.innerHTML = marked.parse(msg.content, { breaks: true });
    } else {
      body.textContent = msg.content;
    }

    // Brainstorm idea coordinates: prepend [R#-#] to idea lines
    // Ideas may be in separate <p> tags OR within one <p> separated by <br>.
    // Use innerHTML replacement to catch both cases.
    if (settings.brainstormMode && msg.source !== 'user') {
      const round = msg.round || 0;
      let ideaNum = 0;
      body.innerHTML = body.innerHTML.replace(
        /(<p[^>]*>|<li[^>]*>|<br\s*\/?>)\s*((?:<(?:strong|em|b)>)*)(\[The\s)/gi,
        (match, tag, formatting, bracket) => {
          ideaNum++;
          return `${tag}${formatting}<span class="idea-coord">[R${round}-${ideaNum}]</span> ${bracket}`;
        },
      );
    }

    div.querySelector('.btn-copy').addEventListener('click', (e) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(msg.content)
        .then(() => {
          const btn = e.currentTarget;
          btn.innerHTML =
            '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>';
          setTimeout(() => {
            btn.innerHTML =
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
          }, 1500);
        })
        .catch(() => {
          showToast('Copy failed', 'error');
        });
    });

    const deleteBtn = div.querySelector('.btn-delete-msg');
    if (deleteBtn && msg.id) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.runtime.sendMessage(
          {
            type: 'DELETE_MESSAGE',
            messageId: msg.id,
          },
          (response) => {
            if (response && response.session) {
              session = response.session;
              render();
            }
          },
        );
      });
    }

    const sourceLabel = div.querySelector('.source-label');
    if (sourceLabel && msg.id) {
      sourceLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        document.querySelectorAll('.source-dropdown').forEach((d) => d.remove());

        const dropdown = document.createElement('div');
        dropdown.className = 'source-dropdown';

        const sources = [
          { value: 'claude', label: 'Claude' },
          { value: 'gemini', label: 'Gemini' },
          { value: 'user', label: 'User' },
        ];
        sources.forEach((s) => {
          const opt = document.createElement('div');
          opt.className = 'source-option' + (s.value === msg.source ? ' active' : '');
          opt.textContent = s.label;
          opt.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (s.value !== msg.source) {
              chrome.runtime.sendMessage({
                type: 'UPDATE_MESSAGE_SOURCE',
                messageId: msg.id,
                newSource: s.value,
              });
            }
            dropdown.remove();
          });
          dropdown.appendChild(opt);
        });

        sourceLabel.style.position = 'relative';
        sourceLabel.appendChild(dropdown);

        const close = () => {
          dropdown.remove();
          document.removeEventListener('click', close);
        };
        setTimeout(() => document.addEventListener('click', close), 0);
      });
    }

    setupCollapse(div, msg.content);

    return div;
  }

  // ===== Handoff Prompt =====

  function prepareHandoff() {
    if (!session || !session.nextTurn) return;

    const target = session.nextTurn;
    const prompt = generateHandoffPrompt(session, target, settings);

    chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: prompt }, () => {
      showToast(`Handoff ready! Click the arrow on ${capitalize(target)}'s page to paste.`, 'success');
    });

    navigator.clipboard.writeText(prompt).catch(() => {});
  }

  // ===== Interjection =====

  function getLastAISource() {
    if (!session || !session.messages.length) return null;
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const src = session.messages[i].source;
      if (src === 'claude' || src === 'gemini') return src;
    }
    return null;
  }

  function showInterjection() {
    const target = getLastAISource();
    if (!target) return;
    els.interjectionTarget.textContent = capitalize(target);
    els.interjectionTargetBtn.textContent = capitalize(target);
    els.interjectionSection.classList.remove('hidden');
    els.interjectionText.focus();
  }

  function hideInterjection() {
    els.interjectionSection.classList.add('hidden');
    els.interjectionText.value = '';
  }

  function submitInterjection() {
    const text = els.interjectionText.value.trim();
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
          session = response.session;
        }
        render();
      },
    );

    chrome.runtime.sendMessage({ type: 'SET_PENDING_PUSH', content: text }, () => {
      showToast(`Reply ready — click the arrow on ${capitalize(target)}'s page to paste`, 'success');
    });

    hideInterjection();
  }

  // ===== Turn Override =====

  let pendingInsertIndex = null; // tracks where inline insert will splice

  function toggleTurn() {
    if (!session || !session.nextTurn) return;
    const newTurn = session.nextTurn === 'claude' ? 'gemini' : 'claude';
    chrome.runtime.sendMessage(
      {
        type: 'SET_NEXT_TURN',
        nextTurn: newTurn,
      },
      (response) => {
        if (response && response.session) {
          session = response.session;
          render();
          showToast(`Switched to ${capitalize(newTurn)}'s turn`, 'success');
        }
      },
    );
  }

  // ===== Inline Insert (between messages) =====

  function showInlineInsert(insertIdx, anchorEl) {
    pendingInsertIndex = insertIdx;
    els.inlineInsertForm.classList.remove('hidden');
    els.inlineInsertContent.value = '';
    if (anchorEl && anchorEl.parentNode) {
      anchorEl.parentNode.insertBefore(els.inlineInsertForm, anchorEl.nextSibling);
    }
    els.inlineInsertContent.focus();
  }

  function hideInlineInsert() {
    els.inlineInsertForm.classList.add('hidden');
    els.inlineInsertContent.value = '';
    pendingInsertIndex = null;
  }

  function submitInlineInsert() {
    const content = els.inlineInsertContent.value.trim();
    if (!content || pendingInsertIndex == null) return;

    const source = els.inlineInsertSource.value;

    chrome.runtime.sendMessage(
      {
        type: 'INSERT_MESSAGE',
        source,
        content,
        insertIndex: pendingInsertIndex,
      },
      (response) => {
        if (response && response.session) {
          session = response.session;
          render();
          showToast('Message inserted', 'success');
        } else {
          showToast(response?.error || 'Insert failed', 'error');
        }
      },
    );

    hideInlineInsert();
  }

  // ===== Consensus =====

  function markConsensus() {
    if (!session) return;

    if (session.consensusReached) {
      chrome.runtime.sendMessage({ type: 'REOPEN_CONSENSUS' }, (response) => {
        if (response && response.session) {
          session = response.session;
          render();
          showToast('Session reopened', 'success');
        }
      });
    } else {
      const confirmMsg = settings.brainstormMode
        ? 'End this brainstorm session?'
        : 'Mark the last response as the consensus result?';
      if (!confirm(confirmMsg)) return;
      chrome.runtime.sendMessage({ type: 'MARK_CONSENSUS' }, (response) => {
        if (response && response.session) {
          session = response.session;
          render();
          showToast('Consensus marked!', 'success');
        }
      });
    }
  }

  // ===== Help =====

  function showHelp() {
    const v = $('#help-version');
    if (v) v.textContent = 'v' + chrome.runtime.getManifest().version;
    els.helpModal.classList.remove('hidden');
  }

  function hideHelp() {
    els.helpModal.classList.add('hidden');
  }

  // ===== Export =====

  function hideExportModal() {
    els.exportModal.classList.add('hidden');
  }

  function exportFilename(ext) {
    if (session && session.initialContext) {
      const slug = session.initialContext
        .slice(0, 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug) return `${slug}.${ext}`;
    }
    return `consensus-${session ? session.id.slice(0, 8) : 'export'}.${ext}`;
  }

  function exportMarkdown() {
    if (!session) return;
    const md = generateMarkdownExport(session);
    downloadFile(md, exportFilename('md'), 'text/markdown');
    showExportStatus('Markdown downloaded!', 'success');
  }

  function exportJSON() {
    if (!session) return;
    let exportData = session;
    if (settings.brainstormMode) {
      exportData = {
        ...session,
        messages: session.messages.map((msg) => {
          if (msg.source === 'user') return msg;
          const round = msg.round || 0;
          const ideas = [];
          let ideaNum = 0;
          msg.content.split('\n').forEach((line) => {
            if (/^\*{0,2}\[The\s/.test(line.trimStart())) {
              ideaNum++;
              ideas.push({ ideaIndex: `R${round}-${ideaNum}`, text: line });
            }
          });
          return ideas.length > 0 ? { ...msg, ideas } : msg;
        }),
      };
    }
    const json = JSON.stringify(exportData, null, 2);
    downloadFile(json, exportFilename('json'), 'application/json');
    showExportStatus('JSON downloaded!', 'success');
  }

  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function pushToGitHub() {
    await loadSettings();
    if (!settings.githubToken || !settings.githubRepo) {
      showExportStatus('GitHub not configured. Go to Settings.', 'error');
      return;
    }

    showExportStatus('Pushing to GitHub...', 'success');

    chrome.runtime.sendMessage({ type: 'PUSH_GITHUB', session, settings }, (response) => {
      if (response && response.ok) {
        showExportStatus(`Pushed! ${response.url || ''}`, 'success');
      } else {
        showExportStatus(response?.error || 'Push failed', 'error');
      }
    });
  }

  function toggleExportDropdown() {
    if (!session) {
      showToast('No session to export', 'error');
      return;
    }
    els.exportDropdown.classList.toggle('hidden');
    if (!els.exportDropdown.classList.contains('hidden')) {
      const close = (e) => {
        if (!els.exportDropdown.contains(e.target) && e.target !== els.btnExportToggle) {
          hideExportDropdown();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  function hideExportDropdown() {
    els.exportDropdown.classList.add('hidden');
    els.exportDropdownStatus.classList.add('hidden');
  }

  function showExportStatus(text, type) {
    els.exportStatus.textContent = text;
    els.exportStatus.className = `export-status ${type}`;
    els.exportStatus.classList.remove('hidden');
    els.exportDropdownStatus.textContent = text;
    els.exportDropdownStatus.className = `export-status ${type}`;
    els.exportDropdownStatus.classList.remove('hidden');
  }

  // ===== Markdown Export Generator =====
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

      const label = msg.source === 'user' ? '[User Interjection]' : `[${capitalize(msg.source)}]`;
      const time = new Date(msg.timestamp).toLocaleString();
      const consensusTag = msg.isConsensus ? ' **[CONSENSUS]**' : '';

      lines.push(`#### ${label} — ${time}${consensusTag}`);
      lines.push('');

      if (settings.brainstormMode && msg.source !== 'user') {
        const round = msg.round || 0;
        let ideaNum = 0;
        lines.push(
          msg.content
            .split('\n')
            .map((line) => {
              if (/^\*{0,2}\[The\s/.test(line.trimStart())) {
                ideaNum++;
                return `[R${round}-${ideaNum}] ${line}`;
              }
              return line;
            })
            .join('\n'),
        );
      } else {
        lines.push(msg.content);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  // ===== Sessions List =====

  function showSessionsView() {
    els.viewConversation.classList.remove('active');
    els.viewSessions.classList.add('active');
    loadSessionsList();
  }

  function showConversationView() {
    els.viewSessions.classList.remove('active');
    els.viewConversation.classList.add('active');
    render();
  }

  function loadSessionsList() {
    chrome.runtime.sendMessage({ type: 'GET_ALL_SESSIONS' }, (response) => {
      if (!response || !response.sessions) return;
      renderSessionsList(response.sessions);
    });
  }

  function renderSessionsList(sessions) {
    els.sessionsList.innerHTML = '';

    if (sessions.length === 0) {
      els.sessionsList.innerHTML = `
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

      els.sessionsList.appendChild(item);
    }
  }

  function loadSessionById(id) {
    chrome.runtime.sendMessage({ type: 'LOAD_SESSION', sessionId: id }, (response) => {
      if (response && response.session) {
        session = response.session;
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

  // ===== Helpers =====

  function showToast(text, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // ===== Boot =====
  init();
})();
