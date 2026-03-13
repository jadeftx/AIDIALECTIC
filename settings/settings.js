/**
 * Consensus Engine — Settings Page
 */

(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);

  const els = {
    githubRepo: $('#github-repo'),
    githubPath: $('#github-path'),
    githubToken: $('#github-token'),
    systemContext: $('#system-context'),
    toggleAutocapture: $('#toggle-autocapture'),
    btnSave: $('#btn-save'),
    btnClearData: $('#btn-clear-data'),
    btnExportAll: $('#btn-export-all'),
    btnImportAll: $('#btn-import-all'),
    importFile: $('#import-file'),
    status: $('#status'),
  };

  // ===== Load =====

  function load() {
    chrome.storage.local.get('ce_settings', (data) => {
      const s = data.ce_settings || {};
      els.githubRepo.value = s.githubRepo || '';
      els.githubPath.value = s.githubPath || '';
      els.githubToken.value = s.githubToken || '';
      els.systemContext.value = s.systemContext || '';

      if (s.autoCapture) {
        els.toggleAutocapture.classList.add('active');
      }
    });
  }

  // ===== Save =====

  function save() {
    const settings = {
      githubRepo: els.githubRepo.value.trim(),
      githubPath: els.githubPath.value.trim(),
      githubToken: els.githubToken.value.trim(),
      systemContext: els.systemContext.value.trim(),
      autoCapture: els.toggleAutocapture.classList.contains('active'),
    };

    chrome.storage.local.set({ ce_settings: settings }, () => {
      showStatus('Settings saved!', 'success');
    });
  }

  // ===== Clear Data =====

  function clearData() {
    if (!confirm('Delete ALL saved sessions? This cannot be undone.')) return;

    chrome.storage.local.get(null, (data) => {
      const sessionKeys = Object.keys(data).filter((k) => k.startsWith('session_'));
      sessionKeys.push('currentSessionId');
      chrome.storage.local.remove(sessionKeys, () => {
        showStatus('All sessions cleared.', 'success');
      });
    });
  }

  // ===== UI Helpers =====

  function showStatus(text, type) {
    els.status.textContent = text;
    els.status.className = `status show ${type}`;
    setTimeout(() => {
      els.status.classList.remove('show');
    }, 3000);
  }

  // ===== Export / Import =====

  function exportAll() {
    chrome.runtime.sendMessage({ type: 'EXPORT_ALL_DATA' }, (response) => {
      if (!response || !response.ok) {
        showStatus('Export failed', 'error');
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
      showStatus('All sessions exported!', 'success');
    });
  }

  function importAll() {
    els.importFile.click();
  }

  function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        chrome.runtime.sendMessage({ type: 'IMPORT_ALL_DATA', data }, (response) => {
          if (response && response.ok) {
            showStatus(`Imported ${response.imported} new session(s)!`, 'success');
          } else {
            showStatus(response?.error || 'Import failed', 'error');
          }
        });
      } catch (err) {
        showStatus('Invalid JSON file', 'error');
      }
      els.importFile.value = '';
    };
    reader.readAsText(file);
  }

  // ===== Events =====

  els.btnSave.addEventListener('click', save);
  els.btnClearData.addEventListener('click', clearData);
  els.btnExportAll.addEventListener('click', exportAll);
  els.btnImportAll.addEventListener('click', importAll);
  els.importFile.addEventListener('change', handleImportFile);

  els.toggleAutocapture.addEventListener('click', () => {
    els.toggleAutocapture.classList.toggle('active');
  });

  // ===== Theme =====
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
  }

  chrome.storage.local.get('ce_theme', (data) => {
    const saved = data.ce_theme;
    if (saved) {
      applyTheme(saved);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(prefersDark ? 'dark' : 'light');
    }
  });

  // ===== Close =====
  $('#btn-close-settings').addEventListener('click', () => {
    window.close();
  });

  // ===== Init =====
  load();
})();
