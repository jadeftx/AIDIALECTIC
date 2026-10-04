/**
 * Consensus Engine — Export
 * Markdown/JSON downloads, GitHub push, and the export dropdown and modal.
 */

const Exporter = (() => {
  function hideModal() {
    els.exportModal.classList.add('hidden');
  }

  function exportFilename(session, ext) {
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
    const session = SessionStore.get();
    if (!session) return;
    const md = generateMarkdownExport(session);
    downloadFile(md, exportFilename(session, 'md'), 'text/markdown');
    showStatus('Markdown downloaded!', 'success');
  }

  function exportJSON() {
    const session = SessionStore.get();
    if (!session) return;
    const json = JSON.stringify(session, null, 2);
    downloadFile(json, exportFilename(session, 'json'), 'application/json');
    showStatus('JSON downloaded!', 'success');
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
    const settings = await PanelSettings.load();
    if (!settings.githubToken || !settings.githubRepo) {
      showStatus('GitHub not configured. Go to Settings.', 'error');
      return;
    }

    showStatus('Pushing to GitHub...', 'success');

    const response = await SessionStore.send({ type: 'PUSH_GITHUB', session: SessionStore.get(), settings });
    if (response && response.ok) {
      showStatus(`Pushed! ${response.url || ''}`, 'success');
    } else {
      showStatus(response?.error || 'Push failed', 'error');
    }
  }

  function toggleDropdown() {
    if (!SessionStore.get()) {
      showToast('No session to export', 'error');
      return;
    }
    els.exportDropdown.classList.toggle('hidden');
    if (!els.exportDropdown.classList.contains('hidden')) {
      const close = (e) => {
        if (!els.exportDropdown.contains(e.target) && e.target !== els.btnExportToggle) {
          hideDropdown();
          document.removeEventListener('click', close);
        }
      };
      setTimeout(() => document.addEventListener('click', close), 0);
    }
  }

  function hideDropdown() {
    els.exportDropdown.classList.add('hidden');
    els.exportDropdownStatus.classList.add('hidden');
  }

  function showStatus(text, type) {
    els.exportStatus.textContent = text;
    els.exportStatus.className = `export-status ${type}`;
    els.exportStatus.classList.remove('hidden');
    els.exportDropdownStatus.textContent = text;
    els.exportDropdownStatus.className = `export-status ${type}`;
    els.exportDropdownStatus.classList.remove('hidden');
  }

  // ===== Markdown Export Generator =====
  // NOTE: Duplicated in background.js for MV3 service worker stability. Keep in sync.

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
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  }

  return {
    exportMarkdown,
    exportJSON,
    downloadFile,
    pushToGitHub,
    toggleDropdown,
    hideDropdown,
    hideModal,
  };
})();
