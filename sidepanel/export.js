/**
 * Consensus Engine — Export & GitHub Push
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  function hideExportModal() {
    AID.els.exportModal.classList.add('hidden');
  }

  function exportFilename(ext) {
    if (AID.session && AID.session.initialContext) {
      const slug = AID.session.initialContext
        .slice(0, 60)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      if (slug) return `${slug}.${ext}`;
    }
    return `consensus-${AID.session ? AID.session.id.slice(0, 8) : 'export'}.${ext}`;
  }

  function exportMarkdown() {
    if (!AID.session) return;
    const md = generateMarkdownExport(AID.session);
    downloadFile(md, exportFilename('md'), 'text/markdown');
    showExportStatus('Markdown downloaded!', 'success');
  }

  function exportJSON() {
    if (!AID.session) return;
    const json = JSON.stringify(AID.session, null, 2);
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
    await AID.loadSettings();
    if (!AID.settings.githubToken || !AID.settings.githubRepo) {
      showExportStatus('GitHub not configured. Go to Settings.', 'error');
      return;
    }

    showExportStatus('Pushing to GitHub...', 'success');

    chrome.runtime.sendMessage({ type: 'PUSH_GITHUB', session: AID.session, settings: AID.settings }, (response) => {
      if (response && response.ok) {
        showExportStatus(`Pushed! ${response.url || ''}`, 'success');
      } else {
        showExportStatus(response?.error || 'Push failed', 'error');
      }
    });
  }

  function toggleExportDropdown() {
    if (!AID.session) {
      AID.showToast('No session to export', 'error');
      return;
    }
    AID.els.exportDropdown.classList.toggle('hidden');
    if (!AID.els.exportDropdown.classList.contains('hidden')) {
      const close = (e) => {
        if (!AID.els.exportDropdown.contains(e.target) && e.target !== AID.els.btnExportToggle) {
          hideExportDropdown();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  function hideExportDropdown() {
    AID.els.exportDropdown.classList.add('hidden');
    AID.els.exportDropdownStatus.classList.add('hidden');
  }

  function showExportStatus(text, type) {
    AID.els.exportStatus.textContent = text;
    AID.els.exportStatus.className = `export-status ${type}`;
    AID.els.exportStatus.classList.remove('hidden');
    AID.els.exportDropdownStatus.textContent = text;
    AID.els.exportDropdownStatus.className = `export-status ${type}`;
    AID.els.exportDropdownStatus.classList.remove('hidden');
  }

  // Public API
  AID.exportMarkdown = exportMarkdown;
  AID.exportJSON = exportJSON;
  AID.pushToGitHub = pushToGitHub;
  AID.toggleExportDropdown = toggleExportDropdown;
  AID.hideExportDropdown = hideExportDropdown;
  AID.hideExportModal = hideExportModal;
})();
