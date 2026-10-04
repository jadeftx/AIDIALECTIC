/**
 * Consensus Engine — Session View
 * Renders the header status, conversation thread and action bars for a
 * session. Holds no state: user actions on messages are passed to the
 * handlers the controller supplies.
 *
 * handlers: { onToggleTurn(), onInsertAt(insertIdx, anchorEl),
 *             onDeleteMessage(messageId), onChangeSource(messageId, source) }
 */

const SessionView = (() => {
  function render(session, handlers) {
    if (!session) {
      renderNoSession();
    } else {
      renderSession(session, handlers);
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

  function renderSession(session, handlers) {
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
      els.turnIndicator.querySelector('.turn-override').addEventListener('click', handlers.onToggleTurn);
    } else {
      els.turnIndicator.textContent = `Waiting for first capture ${roundLabel}`;
      els.turnIndicator.className = 'turn-indicator';
      els.turnIndicator.style.color = '';
    }
    els.roundCounter.textContent = session.round > 0 ? `Round ${session.round}` : '';

    renderThread(session, handlers);

    // Session stays fully usable even after consensus is marked
    if (session.messages.length > 0) {
      els.actionBar.classList.remove('hidden');
      els.btnPrepareHandoff.classList.remove('hidden');
      if (session.nextTurn) {
        els.handoffTarget.textContent = capitalize(session.nextTurn);
      }
      const lastAI = SessionStore.lastAISource(session);
      if (lastAI) {
        els.replyTarget.textContent = capitalize(lastAI);
        els.btnInterject.classList.remove('hidden');
      } else {
        els.btnInterject.classList.add('hidden');
      }
      // Consensus bar: show toggle (mark / unmark)
      els.consensusBar.classList.remove('hidden');
      if (session.consensusReached) {
        els.btnConsensus.textContent = 'Reopen Session';
        els.btnConsensus.classList.add('btn-consensus-reopen');
      } else {
        els.btnConsensus.textContent = 'Mark Consensus';
        els.btnConsensus.classList.remove('btn-consensus-reopen');
      }
    } else {
      els.actionBar.classList.add('hidden');
      els.consensusBar.classList.add('hidden');
    }
  }

  function renderThread(session, handlers) {
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
      btn.addEventListener('click', () => handlers.onInsertAt(insertIdx, wrapper));
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
        handlers,
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
      const msgEl = createMessageElement(msg, null, msgIndex, i, handlers);
      els.thread.appendChild(msgEl);

      addInsertBtn(i + 1);
    }

    els.thread.scrollTop = els.thread.scrollHeight;
  }

  function createMessageElement(msg, labelOverride, msgIndex, arrayIndex, handlers) {
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
        handlers.onDeleteMessage(msg.id);
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
              handlers.onChangeSource(msg.id, s.value);
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

  return { render };
})();
