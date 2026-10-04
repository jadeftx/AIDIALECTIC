/**
 * Consensus Engine — History View
 * Switches between the conversation and the past-sessions list, and renders
 * that list. Loading and deleting are passed to the controller's handlers.
 *
 * handlers: { onLoad(sessionId), onDelete(sessionId) }
 */

const HistoryView = (() => {
  function show() {
    els.viewConversation.classList.remove('active');
    els.viewSessions.classList.add('active');
  }

  function hide() {
    els.viewSessions.classList.remove('active');
    els.viewConversation.classList.add('active');
  }

  function render(sessions, handlers) {
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
        handlers.onLoad(s.id);
      });

      item.querySelector('.btn-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.onDelete(s.id);
      });

      els.sessionsList.appendChild(item);
    }
  }

  return { show, hide, render };
})();
