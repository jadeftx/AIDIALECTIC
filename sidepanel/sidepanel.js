/**
 * Consensus Engine — Side Panel Orchestrator
 * Boots the app, wires top-level events, and listens for background messages.
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  async function init() {
    AID.initEls();
    await AID.initTheme();
    await AID.initUIZoom();
    await AID.loadSettings();
    await AID.loadCurrentSession();
    bindEvents();
    AID.bindSettingsEvents();
    AID.render();
  }

  function bindEvents() {
    AID.els.btnStartSession.addEventListener('click', AID.startSession);
    AID.els.btnNewSession.addEventListener('click', AID.newSession);
    AID.els.btnSessionsList.addEventListener('click', AID.showSessionsView);
    AID.els.btnBackConversation.addEventListener('click', AID.showConversationView);
    AID.els.btnSettings.addEventListener('click', AID.openSettingsModal);

    AID.els.btnPrepareHandoff.addEventListener('click', AID.prepareHandoff);
    AID.els.btnInterject.addEventListener('click', AID.showInterjection);
    AID.els.btnConsensus.addEventListener('click', AID.markConsensus);

    AID.els.btnSubmitInterject.addEventListener('click', AID.submitInterjection);
    AID.els.btnCancelInterject.addEventListener('click', AID.hideInterjection);

    AID.els.btnSubmitInlineInsert.addEventListener('click', AID.submitInlineInsert);
    AID.els.btnCancelInlineInsert.addEventListener('click', AID.hideInlineInsert);

    // Export dropdown (header icon)
    AID.els.btnExportToggle.addEventListener('click', AID.toggleExportDropdown);
    AID.els.btnExportMdHeader.addEventListener('click', () => {
      AID.exportMarkdown();
      AID.hideExportDropdown();
    });
    AID.els.btnExportJsonHeader.addEventListener('click', () => {
      AID.exportJSON();
      AID.hideExportDropdown();
    });
    AID.els.btnPushGithubHeader.addEventListener('click', () => {
      AID.pushToGitHub();
    });

    // Export modal
    AID.els.btnExportMd.addEventListener('click', AID.exportMarkdown);
    AID.els.btnExportJson.addEventListener('click', AID.exportJSON);
    AID.els.btnPushGithub.addEventListener('click', AID.pushToGitHub);
    AID.els.btnCloseModal.addEventListener('click', AID.hideExportModal);
    AID.els.btnCloseModalX.addEventListener('click', AID.hideExportModal);
    $('#export-modal .modal-backdrop').addEventListener('click', AID.hideExportModal);

    AID.els.btnThemeToggle.addEventListener('click', AID.toggleTheme);

    AID.els.btnFontUp.addEventListener('click', () => AID.changeZoom(1));
    AID.els.btnFontDown.addEventListener('click', () => AID.changeZoom(-1));

    // Gracefully hide brand logo if image fails to load
    const brandLogo = $('#brand-logo');
    if (brandLogo) {
      brandLogo.addEventListener('error', () => brandLogo.classList.add('logo-missing'));
    }

    AID.els.btnHelp.addEventListener('click', showHelp);
    AID.els.btnCloseHelp.addEventListener('click', hideHelp);
    $('#help-modal .modal-backdrop').addEventListener('click', hideHelp);

    // Listen for session updates from background
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SESSION_UPDATED') {
        AID.session = message.session;
        AID.render();
      }
    });

    // Keyboard shortcut for initial context
    AID.els.initialContext.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        AID.startSession();
      }
    });
  }

  // ===== Help =====

  function showHelp() {
    const v = $('#help-version');
    if (v) v.textContent = 'v' + chrome.runtime.getManifest().version;
    AID.els.helpModal.classList.remove('hidden');
  }

  function hideHelp() {
    AID.els.helpModal.classList.add('hidden');
  }

  // ===== Boot =====
  init();
})();
