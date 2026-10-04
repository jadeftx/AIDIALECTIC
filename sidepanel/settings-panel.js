/**
 * Consensus Engine — Settings
 * Loads saved settings and drives the settings modal, including bulk
 * export, import and clearing of saved sessions.
 */

const PanelSettings = (() => {
  let settings = {};

  function get() {
    return settings;
  }

  async function load() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['ce_settings', 'ce_modifiers'], (data) => {
        settings = data.ce_settings || {};
        const legacy = data.ce_modifiers;
        if (legacy) {
          if (!settings.modLength && legacy.length) settings.modLength = legacy.length;
          if (!settings.modTone && legacy.tone) settings.modTone = legacy.tone;
          chrome.storage.local.remove('ce_modifiers');
        }
        resolve(settings);
      });
    });
  }

  // ===== Settings Modal =====

  function openModal() {
    const modal = $('#settings-modal');
    $('#settings-github-repo').value = settings.githubRepo || '';
    $('#settings-github-path').value = settings.githubPath || '';
    $('#settings-github-token').value = settings.githubToken || '';
    $('#settings-system-context').value = settings.systemContext || '';
    els.modLength.value = settings.modLength || 'normal';
    els.modTone.value = settings.modTone || 'default';
    const toggle = $('#settings-toggle-autocapture');
    toggle.classList.toggle('active', !!settings.autoCapture);
    modal.classList.remove('hidden');
  }

  function closeModal() {
    $('#settings-modal').classList.add('hidden');
  }

  function saveModal() {
    // Merge with existing settings so we never lose keys not shown in the modal
    settings = {
      ...settings,
      githubRepo: $('#settings-github-repo').value.trim(),
      githubPath: $('#settings-github-path').value.trim(),
      githubToken: $('#settings-github-token').value.trim(),
      systemContext: $('#settings-system-context').value.trim(),
      modLength: els.modLength.value,
      modTone: els.modTone.value,
      autoCapture: $('#settings-toggle-autocapture').classList.contains('active'),
    };
    chrome.storage.local.set({ ce_settings: settings }, () => {
      showStatus('Settings saved!', 'success');
    });
  }

  function showStatus(text, type) {
    const el = $('#settings-status');
    el.textContent = text;
    el.className = `settings-status show ${type}`;
    setTimeout(() => el.classList.remove('show'), 3000);
  }

  async function exportAll() {
    const response = await SessionStore.send({ type: 'EXPORT_ALL_DATA' });
    if (!response || !response.ok) {
      showStatus('Export failed', 'error');
      return;
    }
    const json = JSON.stringify(response.payload, null, 2);
    Exporter.downloadFile(json, `aidialectic-backup-${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    showStatus('All sessions exported!', 'success');
  }

  function importAll() {
    $('#settings-import-file').click();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        SessionStore.send({ type: 'IMPORT_ALL_DATA', data }).then((response) => {
          if (response && response.ok) {
            showStatus(`Imported ${response.imported} new session(s)!`, 'success');
          } else {
            showStatus(response?.error || 'Import failed', 'error');
          }
        });
      } catch (err) {
        showStatus('Invalid JSON file', 'error');
      }
      $('#settings-import-file').value = '';
    };
    reader.readAsText(file);
  }

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

  function bindEvents() {
    $('#btn-close-settings').addEventListener('click', closeModal);
    $('#settings-modal .modal-backdrop').addEventListener('click', closeModal);
    $('#settings-btn-save').addEventListener('click', saveModal);
    $('#settings-btn-export-all').addEventListener('click', exportAll);
    $('#settings-btn-import-all').addEventListener('click', importAll);
    $('#settings-import-file').addEventListener('change', handleImport);
    $('#settings-btn-clear-data').addEventListener('click', clearData);
    $('#settings-toggle-autocapture').addEventListener('click', () => {
      $('#settings-toggle-autocapture').classList.toggle('active');
    });
  }

  return { get, load, openModal, bindEvents };
})();
