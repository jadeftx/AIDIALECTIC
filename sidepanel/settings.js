/**
 * Consensus Engine — Settings Management
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ce_settings', 'ce_modifiers'], (data) => {
        AID.settings = data.ce_settings || {};
        const legacy = data.ce_modifiers;
        if (legacy) {
          if (!AID.settings.modLength && legacy.length) AID.settings.modLength = legacy.length;
          if (!AID.settings.modTone && legacy.tone) AID.settings.modTone = legacy.tone;
          chrome.storage.local.remove('ce_modifiers');
        }
        resolve();
      });
    });
  }

  function openSettingsModal() {
    const modal = $('#settings-modal');
    $('#settings-github-repo').value = AID.settings.githubRepo || '';
    $('#settings-github-path').value = AID.settings.githubPath || '';
    $('#settings-github-token').value = AID.settings.githubToken || '';
    $('#settings-system-context').value = AID.settings.systemContext || '';
    AID.els.modLength.value = AID.settings.modLength || 'normal';
    AID.els.modTone.value = AID.settings.modTone || 'default';
    const toggle = $('#settings-toggle-autocapture');
    toggle.classList.toggle('active', !!AID.settings.autoCapture);
    modal.classList.remove('hidden');
  }

  function closeSettingsModal() {
    $('#settings-modal').classList.add('hidden');
  }

  function saveSettingsModal() {
    AID.settings = {
      ...AID.settings,
      githubRepo: $('#settings-github-repo').value.trim(),
      githubPath: $('#settings-github-path').value.trim(),
      githubToken: $('#settings-github-token').value.trim(),
      systemContext: $('#settings-system-context').value.trim(),
      modLength: AID.els.modLength.value,
      modTone: AID.els.modTone.value,
      autoCapture: $('#settings-toggle-autocapture').classList.contains('active'),
    };
    chrome.storage.local.set({ ce_settings: AID.settings }, () => {
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
  }

  // Public API
  AID.loadSettings = loadSettings;
  AID.openSettingsModal = openSettingsModal;
  AID.bindSettingsEvents = bindSettingsEvents;
})();
