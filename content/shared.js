/**
 * Consensus Engine — Shared Content Script Utilities
 * Bidirectional transfer button: push content to chat or pull responses to sidebar.
 */

(function () {
  'use strict';

  // Prevent double-injection within the same extension lifecycle.
  // After extension update/reload, the old content script is orphaned
  // (contextInvalid=true), so allow re-injection to take over.
  if (window.__consensusEngineLoaded && !window.__consensusEngineStale) return;

  // Clean up any previous instance (old button, old state)
  const oldBtn = document.getElementById('ce-capture-btn');
  if (oldBtn) oldBtn.remove();

  window.__consensusEngineLoaded = true;
  window.__consensusEngineStale = false;
  window.__consensusEngineGen = (window.__consensusEngineGen || 0) + 1;

  let currentMode = 'pull'; // 'push' | 'pull'
  let contextInvalid = false;

  // Detect when extension context is invalidated (e.g. after extension update).
  // Content scripts from the old version lose their connection to the new
  // background service worker, so all chrome.runtime calls silently fail.
  function checkContextValid() {
    try {
      // chrome.runtime.id can still be defined after invalidation;
      // the only reliable test is to attempt an actual runtime call.
      if (!chrome.runtime?.id) throw new Error('no id');
      return true;
    } catch {
      if (!contextInvalid) {
        contextInvalid = true;
        showStaleWarning();
      }
      return false;
    }
  }

  // Safe wrapper for chrome.runtime.sendMessage — catches context-invalidated errors.
  function safeSendMessage(msg, callback) {
    if (contextInvalid) return;
    try {
      chrome.runtime.sendMessage(msg, (response) => {
        try {
          if (chrome.runtime.lastError) {
            // Check if context just became invalid
            if (String(chrome.runtime.lastError.message).includes('invalidated')) {
              contextInvalid = true;
              showStaleWarning();
            }
            if (callback) callback(null);
            return;
          }
          if (callback) callback(response);
        } catch {
          contextInvalid = true;
          showStaleWarning();
          if (callback) callback(null);
        }
      });
    } catch {
      contextInvalid = true;
      showStaleWarning();
    }
  }

  function showStaleWarning() {
    window.__consensusEngineStale = true;
    const btn = document.getElementById('ce-capture-btn');
    if (btn) {
      btn.classList.add('stale');
      btn.setAttribute('data-tooltip', 'Extension updated - refresh page');
    }
    showToast('Extension updated - please refresh this page', 'error');
  }

  // ===== SVG Arrow Icons =====

  function arrowSVG(mode) {
    if (mode === 'push') {
      // Left arrow — pointing toward chat
      return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>';
    }
    // Right arrow — pointing toward sidebar
    return '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>';
  }

  // ===== Button Creation =====

  function createCaptureButton() {
    const btn = document.createElement('button');
    btn.id = 'ce-capture-btn';
    btn.innerHTML = arrowSVG('pull');
    btn.setAttribute('data-tooltip', 'Capture response');
    document.body.appendChild(btn);

    // Initialize mode from background
    safeSendMessage({ type: 'GET_BUTTON_MODE' }, (response) => {
      if (response && response.mode) {
        setMode(btn, response.mode);
      }
    });

    // Click handler
    btn.addEventListener('click', (e) => {
      if (btn.dataset.dragged === 'true') {
        btn.dataset.dragged = 'false';
        return;
      }
      handleClick();
    });

    // Drag support
    makeDraggable(btn);

    // Listen for mode changes from background.
    // Wrap in try-catch — listener throws if context is already invalid.
    try {
      chrome.runtime.onMessage.addListener((message) => {
        if (contextInvalid) return;
        if (message.type === 'BUTTON_MODE') {
          setMode(btn, message.mode);
        }
      });
    } catch {
      contextInvalid = true;
      showStaleWarning();
    }

    // Re-check mode when tab becomes visible (user switching tabs)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && checkContextValid()) {
        safeSendMessage({ type: 'GET_BUTTON_MODE' }, (response) => {
          if (response && response.mode) {
            setMode(btn, response.mode);
          }
        });
      }
    });

    return btn;
  }

  function setMode(btn, mode) {
    currentMode = mode;
    btn.innerHTML = arrowSVG(mode);
    if (mode === 'push') {
      btn.setAttribute('data-tooltip', 'Send to chat');
      btn.classList.add('push-mode');
      btn.classList.remove('pull-mode');
    } else {
      btn.setAttribute('data-tooltip', 'Capture response');
      btn.classList.remove('push-mode');
      btn.classList.add('pull-mode');
    }
  }

  // ===== Click Handler =====

  function handleClick() {
    if (!checkContextValid()) return;
    if (currentMode === 'push') {
      pushToChat();
    } else {
      captureLastResponse();
    }
  }

  // ===== Push Logic =====

  function pushToChat() {
    safeSendMessage({ type: 'GET_PUSH_CONTENT' }, (response) => {
      if (!response) {
        showToast('Extension error — is the side panel open?', 'error');
        return;
      }

      const content = response.content;
      if (!content) {
        showToast('No content to send', 'error');
        return;
      }

      const site = detectSite();
      let success = false;

      if (site === 'claude') {
        success = typeof window.pasteIntoClaudeChat === 'function' && window.pasteIntoClaudeChat(content);
      } else if (site === 'gemini') {
        success = typeof window.pasteIntoGeminiChat === 'function' && window.pasteIntoGeminiChat(content);
      }

      if (success) {
        safeSendMessage({ type: 'PUSH_COMPLETE' }, () => {
          const btn = document.getElementById('ce-capture-btn');
          if (btn) {
            btn.classList.add('captured');
            setTimeout(() => btn.classList.remove('captured'), 1500);
          }
          showToast('Pasted into chat!', 'success');
        });
      } else {
        // Fallback: copy to clipboard so user can paste manually
        navigator.clipboard
          .writeText(content)
          .then(() => {
            showToast('Could not find input — copied to clipboard instead', 'error');
          })
          .catch(() => {
            showToast('Could not find chat input', 'error');
          });
      }
    });
  }

  // ===== Capture Logic =====

  function captureLastResponse() {
    const source = detectSite();
    if (!source) {
      showToast('Not on a supported site', 'error');
      return;
    }

    let content;
    if (source === 'claude') {
      content = extractClaudeResponse();
    } else {
      content = extractGeminiResponse();
    }

    if (!content || !content.trim()) {
      showToast('No response found to capture', 'error');
      return;
    }

    // Send to background
    safeSendMessage({ type: 'CAPTURE_RESPONSE', source, content }, (response) => {
      if (!response) {
        showToast('Extension error — is the side panel open?', 'error');
        return;
      }
      if (response.ok) {
        showToast('Response captured!', 'success');
        const btn = document.getElementById('ce-capture-btn');
        if (btn) {
          btn.classList.add('captured');
          setTimeout(() => btn.classList.remove('captured'), 1500);
        }
      } else {
        showToast(response.error || 'Capture failed', 'error');
      }
    });
  }

  // ===== Drag Support =====

  function makeDraggable(el) {
    let isDragging = false;
    let startX, startY, origRight, origBottom;
    const DRAG_THRESHOLD = 5;

    el.addEventListener('mousedown', (e) => {
      isDragging = false;
      startX = e.clientX;
      startY = e.clientY;
      const rect = el.getBoundingClientRect();
      origRight = window.innerWidth - rect.right;
      origBottom = window.innerHeight - rect.bottom;
      el.dataset.dragged = 'false';

      const onMove = (e) => {
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        if (!isDragging && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
          isDragging = true;
          el.classList.add('dragging');
        }
        if (isDragging) {
          el.style.right = Math.max(0, origRight - dx) + 'px';
          el.style.bottom = Math.max(0, origBottom - dy) + 'px';
        }
      };

      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        el.classList.remove('dragging');
        if (isDragging) {
          el.dataset.dragged = 'true';
        }
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }

  // ===== Helpers =====

  function detectSite() {
    const host = window.location.hostname;
    if (host.includes('claude.ai')) return 'claude';
    if (host.includes('gemini.google.com')) return 'gemini';
    return null;
  }

  function showToast(text, type = 'success') {
    const existing = document.getElementById('ce-capture-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'ce-capture-toast';
    toast.className = type;
    toast.textContent = text;

    // Position to the left of the arrow button
    const btn = document.getElementById('ce-capture-btn');
    if (btn) {
      const rect = btn.getBoundingClientRect();
      toast.style.top = rect.top + 'px';
      toast.style.right = window.innerWidth - rect.left + 10 + 'px';
    }

    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  }

  // ===== Debug Log (ring buffer for auto-capture diagnostics) =====

  const DEBUG_LOG_MAX = 200;
  const debugLog = [];

  function acDebug(event, data) {
    const entry = {
      t: new Date().toISOString().slice(11, 23), // HH:MM:SS.mmm
      site: detectSite(),
      event,
      ...data,
    };
    debugLog.push(entry);
    if (debugLog.length > DEBUG_LOG_MAX) debugLog.shift();
    // Also log to console for real-time monitoring
    console.log('[AC]', entry.t, event, data || '');
  }

  function getDebugLog() {
    return debugLog;
  }

  function dumpDebugLog() {
    // Copy to clipboard as formatted JSON for easy sharing
    const text = JSON.stringify(debugLog, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      console.log('[AC] Debug log copied to clipboard (' + debugLog.length + ' entries)');
    });
    return debugLog;
  }

  // Expose globally so it can be called from the browser console
  window.__acDebugLog = getDebugLog;
  window.__acDumpLog = dumpDebugLog;

  // ===== Expose to site-specific scripts =====

  window.__consensusEngine = {
    createCaptureButton,
    showToast,
    detectSite,
    safeSendMessage,
    acDebug,
  };
})();
