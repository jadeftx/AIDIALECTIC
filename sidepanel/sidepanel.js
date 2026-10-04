/**
 * Consensus Engine — Side Panel
 * Controller: boots the panel and wires user actions to the session store
 * (state and background requests) and the views (rendering).
 *
 * Load order (sidepanel.html): dom, session-store, appearance, settings-panel,
 * export, session-view, history-view, then this file.
 */

(function () {
  'use strict';

  const viewHandlers = {
    onToggleTurn: toggleTurn,
    onInsertAt: showInlineInsert,
    onDeleteMessage: (messageId) => SessionStore.deleteMessage(messageId),
    onChangeSource: (messageId, source) => SessionStore.updateMessageSource(messageId, source),
  };

  function render() {
    SessionView.render(SessionStore.get(), viewHandlers);
  }

  // ===== Init =====

  async function init() {
    await Appearance.initTheme();
    await Appearance.initUIZoom();
    await PanelSettings.load();
    await SessionStore.load();
    bindEvents();
    PanelSettings.bindEvents();
    render();
  }

  // ===== Session Management =====

  async function startSession() {
    const context = els.initialContext.value.trim();
    if (!context) {
      els.initialContext.focus();
      return;
    }
    const response = await SessionStore.start(context);
    if (response && response.session) {
      // Build initial prompt with dialectic framing (same structure as handoff)
      const prompt = generateInitialPrompt(context, PanelSettings.get());
      await SessionStore.queuePush(prompt);
      showToast('Session started — click the arrow on Claude or Gemini to paste', 'success');
    }
  }

  async function newSession() {
    await SessionStore.reset();
    els.initialContext.value = '';
  }

  // ===== Event Binding =====

  function bindEvents() {
    els.btnStartSession.addEventListener('click', startSession);
    els.btnNewSession.addEventListener('click', newSession);
    els.btnSessionsList.addEventListener('click', showSessionsView);
    els.btnBackConversation.addEventListener('click', showConversationView);
    els.btnSettings.addEventListener('click', PanelSettings.openModal);

    els.btnPrepareHandoff.addEventListener('click', prepareHandoff);
    els.btnInterject.addEventListener('click', showInterjection);
    els.btnConsensus.addEventListener('click', markConsensus);

    els.btnSubmitInterject.addEventListener('click', submitInterjection);
    els.btnCancelInterject.addEventListener('click', hideInterjection);

    els.btnSubmitInlineInsert.addEventListener('click', submitInlineInsert);
    els.btnCancelInlineInsert.addEventListener('click', hideInlineInsert);

    // Export dropdown (header icon)
    els.btnExportToggle.addEventListener('click', Exporter.toggleDropdown);
    els.btnExportMdHeader.addEventListener('click', () => {
      Exporter.exportMarkdown();
      Exporter.hideDropdown();
    });
    els.btnExportJsonHeader.addEventListener('click', () => {
      Exporter.exportJSON();
      Exporter.hideDropdown();
    });
    els.btnPushGithubHeader.addEventListener('click', () => {
      Exporter.pushToGitHub();
    });

    // Export modal (keep for History view usage)
    els.btnExportMd.addEventListener('click', Exporter.exportMarkdown);
    els.btnExportJson.addEventListener('click', Exporter.exportJSON);
    els.btnPushGithub.addEventListener('click', Exporter.pushToGitHub);
    els.btnCloseModal.addEventListener('click', Exporter.hideModal);
    els.btnCloseModalX.addEventListener('click', Exporter.hideModal);
    $('#export-modal .modal-backdrop').addEventListener('click', Exporter.hideModal);

    els.btnThemeToggle.addEventListener('click', Appearance.toggleTheme);

    els.btnFontUp.addEventListener('click', () => Appearance.changeZoom(1));
    els.btnFontDown.addEventListener('click', () => Appearance.changeZoom(-1));

    // Gracefully hide brand logo if image fails to load
    const brandLogo = $('#brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('error', () => brandLogo.classList.add('logo-missing'));
    }

    els.btnHelp.addEventListener('click', showHelp);
    els.btnCloseHelp.addEventListener('click', hideHelp);
    $('#help-modal .modal-backdrop').addEventListener('click', hideHelp);

    // Re-render whenever the session changes, here or in the background
    SessionStore.subscribe(render);
    SessionStore.listenForUpdates();

    // Keyboard shortcut for initial context
    els.initialContext.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        startSession();
      }
    });
  }

  // ===== Handoff Prompt =====

  function prepareHandoff() {
    const session = SessionStore.get();
    if (!session || !session.nextTurn) return;

    const target = session.nextTurn;
    const prompt = generateHandoffPrompt(session, target, PanelSettings.get());

    SessionStore.queuePush(prompt).then(() => {
      showToast(`Handoff ready! Click the arrow on ${capitalize(target)}'s page to paste.`, 'success');
    });

    navigator.clipboard.writeText(prompt).catch(() => {});
  }

  // ===== Interjection =====

  function showInterjection() {
    const target = SessionStore.lastAISource();
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

    const target = SessionStore.lastAISource();
    if (!target) return;

    SessionStore.addInterjection(text);

    SessionStore.queuePush(text).then(() => {
      showToast(`Reply ready — click the arrow on ${capitalize(target)}'s page to paste`, 'success');
    });

    hideInterjection();
  }

  // ===== Turn Override =====

  let pendingInsertIndex = null; // tracks where inline insert will splice

  async function toggleTurn() {
    const session = SessionStore.get();
    if (!session || !session.nextTurn) return;
    const newTurn = session.nextTurn === 'claude' ? 'gemini' : 'claude';
    const response = await SessionStore.setNextTurn(newTurn);
    if (response && response.session) {
      showToast(`Switched to ${capitalize(newTurn)}'s turn`, 'success');
    }
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

    SessionStore.insertMessage(source, content, pendingInsertIndex).then((response) => {
      if (response && response.session) {
        showToast('Message inserted', 'success');
      } else {
        showToast(response?.error || 'Insert failed', 'error');
      }
    });

    hideInlineInsert();
  }

  // ===== Consensus =====

  async function markConsensus() {
    const session = SessionStore.get();
    if (!session) return;

    if (session.consensusReached) {
      const response = await SessionStore.reopenConsensus();
      if (response && response.session) {
        showToast('Session reopened', 'success');
      }
    } else {
      if (!confirm('Mark the last response as the consensus result?')) return;
      const response = await SessionStore.markConsensus();
      if (response && response.session) {
        showToast('Consensus marked!', 'success');
      }
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

  // ===== Sessions List =====

  function showSessionsView() {
    HistoryView.show();
    loadSessionsList();
  }

  function showConversationView() {
    HistoryView.hide();
    render();
  }

  async function loadSessionsList() {
    const response = await SessionStore.listAll();
    if (!response || !response.sessions) return;
    HistoryView.render(response.sessions, { onLoad: loadSessionById, onDelete: deleteSessionById });
  }

  async function loadSessionById(id) {
    const response = await SessionStore.loadById(id);
    if (response && response.session) {
      showConversationView();
    }
  }

  async function deleteSessionById(id) {
    if (!confirm('Delete this session?')) return;
    await SessionStore.deleteById(id);
    loadSessionsList();
  }

  // ===== Boot =====
  init();
})();
