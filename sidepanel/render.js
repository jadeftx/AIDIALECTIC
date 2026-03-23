/**
 * Consensus Engine — Rendering & Toast Notifications
 */

window.AID = window.AID || {};

(function () {
  'use strict';

  function render() {
    if (!AID.session) {
      renderNoSession();
    } else {
      renderSession();
    }
  }

  function renderNoSession() {
    AID.els.initialContextSection.classList.remove('hidden');
    AID.els.thread.innerHTML = '';
    AID.els.actionBar.classList.add('hidden');
    AID.els.consensusBar.classList.add('hidden');
    AID.els.interjectionSection.classList.add('hidden');
    AID.els.inlineInsertForm.classList.add('hidden');
    AID.els.roundCounter.textContent = '';
    AID.els.turnIndicator.textContent = 'Start a session';
    AID.els.turnIndicator.className = 'turn-indicator';
  }

  function renderSession() {
    if (AID.session.messages.length > 0 || AID.session.initialContext) {
      AID.els.initialContextSection.classList.add('hidden');
    }

    const roundLabel = AID.session.round > 0 ? `(Round ${AID.session.round})` : '';
    if (AID.session.consensusReached) {
      AID.els.turnIndicator.innerHTML = `CONSENSUS REACHED ${roundLabel} <span class="status-check">&#10004;</span>`;
      AID.els.turnIndicator.className = 'turn-indicator consensus';
      AID.els.turnIndicator.style.color = '';
    } else if (AID.session.nextTurn) {
      AID.els.turnIndicator.innerHTML = `<span class="turn-override" title="Click to switch turn">${capitalize(AID.session.nextTurn)}'s turn ${roundLabel} <span class="turn-override-icon">&#9654;</span></span>`;
      AID.els.turnIndicator.className = `turn-indicator ${AID.session.nextTurn}`;
      AID.els.turnIndicator.style.color = '';
      AID.els.turnIndicator.querySelector('.turn-override').addEventListener('click', AID.toggleTurn);
    } else {
      AID.els.turnIndicator.textContent = `Waiting for first capture ${roundLabel}`;
      AID.els.turnIndicator.className = 'turn-indicator';
      AID.els.turnIndicator.style.color = '';
    }
    AID.els.roundCounter.textContent = AID.session.round > 0 ? `Round ${AID.session.round}` : '';

    renderThread();

    if (AID.session.messages.length > 0) {
      AID.els.actionBar.classList.remove('hidden');
      AID.els.btnPrepareHandoff.classList.remove('hidden');
      if (AID.session.nextTurn) {
        AID.els.handoffTarget.textContent = capitalize(AID.session.nextTurn);
      }
      const lastAI = AID.getLastAISource();
      if (lastAI) {
        AID.els.replyTarget.textContent = capitalize(lastAI);
        AID.els.btnInterject.classList.remove('hidden');
      } else {
        AID.els.btnInterject.classList.add('hidden');
      }
      AID.els.consensusBar.classList.remove('hidden');
      if (AID.session.consensusReached) {
        AID.els.btnConsensus.textContent = 'Reopen Session';
        AID.els.btnConsensus.classList.add('btn-consensus-reopen');
      } else {
        AID.els.btnConsensus.textContent = 'Mark Consensus';
        AID.els.btnConsensus.classList.remove('btn-consensus-reopen');
      }
    } else {
      AID.els.actionBar.classList.add('hidden');
      AID.els.consensusBar.classList.add('hidden');
    }
  }

  function renderThread() {
    if (AID.els.inlineInsertForm.parentNode === AID.els.thread) {
      AID.els.thread.removeChild(AID.els.inlineInsertForm);
    }
    AID.els.thread.innerHTML = '';
    let msgIndex = 0;

    function addInsertBtn(insertIdx) {
      const wrapper = document.createElement('div');
      wrapper.className = 'inline-insert-btn';
      const btn = document.createElement('button');
      btn.textContent = '+';
      btn.title = 'Insert message here';
      btn.addEventListener('click', () => AID.showInlineInsert(insertIdx, wrapper));
      wrapper.appendChild(btn);
      AID.els.thread.appendChild(wrapper);
    }

    addInsertBtn(0);

    if (AID.session.initialContext) {
      msgIndex++;
      const ctxDiv = createMessageElement(
        {
          source: 'user',
          content: AID.session.initialContext,
          timestamp: AID.session.createdAt,
          round: 0,
        },
        'Initial Context',
        msgIndex,
        null,
      );
      AID.els.thread.appendChild(ctxDiv);
      addInsertBtn(0);
    }

    let lastRound = 0;
    for (let i = 0; i < AID.session.messages.length; i++) {
      const msg = AID.session.messages[i];

      if (msg.round && msg.round !== lastRound) {
        lastRound = msg.round;
        const divider = document.createElement('div');
        divider.className = 'round-divider';
        divider.textContent = `Round ${msg.round}`;
        AID.els.thread.appendChild(divider);
      }

      msgIndex++;
      const msgEl = createMessageElement(msg, null, msgIndex, i);
      AID.els.thread.appendChild(msgEl);

      addInsertBtn(i + 1);
    }

    AID.els.thread.scrollTop = AID.els.thread.scrollHeight;
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
              AID.session = response.session;
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

  // ===== Toast Notifications =====

  function showToast(text, type = 'success') {
    const existing = document.querySelector('.toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = text;
    document.body.appendChild(toast);

    setTimeout(() => toast.remove(), 3000);
  }

  // Public API
  AID.render = render;
  AID.showToast = showToast;
})();
