/**
 * Consensus Engine — Provider Base
 * Shared auto-capture, extraction, and lifecycle logic used by both
 * claude.js and gemini.js. Loaded before provider-specific scripts.
 */

(function () {
  'use strict';

  if (!window.__consensusEngine) {
    console.warn('[Consensus Engine] Shared script not loaded');
    return;
  }

  // ===== Hash =====

  function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < Math.min(str.length, 500); i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const tailStart = Math.max(0, str.length - 500);
    for (let i = tailStart; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash + '|' + str.length;
  }

  // ===== DOM Extraction =====

  function extractTextContent(element, selectors) {
    if (!element) return null;
    const clone = element.cloneNode(true);
    clone.querySelectorAll(selectors.nonContent).forEach((el) => el.remove());
    return htmlToText(clone);
  }

  function htmlToText(element) {
    let text = '';
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const tag = node.tagName.toLowerCase();
      const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'br', 'hr'];
      const isBlock = blockTags.includes(tag);

      if (tag === 'br') {
        text += '\n';
        return;
      }
      if (tag === 'hr') {
        text += '\n---\n';
        return;
      }

      if (/^h[1-6]$/.test(tag)) {
        const level = parseInt(tag[1]);
        text += '\n' + '#'.repeat(level) + ' ';
      }

      if (tag === 'li') {
        const parent = node.parentElement;
        if (parent && parent.tagName.toLowerCase() === 'ol') {
          const index = Array.from(parent.children).indexOf(node) + 1;
          text += `\n${index}. `;
        } else {
          text += '\n- ';
        }
      }

      if (tag === 'blockquote') {
        text += '\n> ';
      }

      if (tag === 'pre') {
        const codeEl = node.querySelector('code');
        const lang = codeEl ? codeEl.className.match(/language-(\w+)/)?.[1] || '' : '';
        text += '\n```' + lang + '\n';
        text += (codeEl || node).textContent;
        text += '\n```\n';
        return;
      }

      if (tag === 'code' && (!node.parentElement || node.parentElement.tagName.toLowerCase() !== 'pre')) {
        text += '`' + node.textContent + '`';
        return;
      }

      if (tag === 'strong' || tag === 'b') {
        text += '**';
        for (const child of node.childNodes) walk(child);
        text += '**';
        return;
      }

      if (tag === 'em' || tag === 'i') {
        text += '*';
        for (const child of node.childNodes) walk(child);
        text += '*';
        return;
      }

      if (tag === 'a') {
        const href = node.getAttribute('href');
        text += '[';
        for (const child of node.childNodes) walk(child);
        text += `](${href || ''})`;
        return;
      }

      for (const child of node.childNodes) {
        walk(child);
      }

      if (isBlock && tag !== 'li') {
        text += '\n';
      }
    };

    walk(element);
    return text.replace(/\n{3,}/g, '\n\n').trim();
  }

  // ===== Message Queries =====

  function getMessages(selectors) {
    for (const sel of selectors.responseContainers) {
      const found = document.querySelectorAll(sel);
      if (found.length) return Array.from(found);
    }
    return [];
  }

  // ===== Auto-Capture: Polling + Stabilization =====

  const POLL_MS = 1500;
  const STABLE_MS = 2000;

  function pollForNewResponse(state, selectors, sourceName) {
    const { acDebug } = window.__consensusEngine;
    const messages = getMessages(selectors);
    const count = messages.length;

    if (count === 0) return;

    if (count <= state.lastMessageCount && !state.pendingHash) {
      return;
    }

    const lastMessage = messages[messages.length - 1];
    const content = extractTextContent(lastMessage, selectors);
    if (!content || !content.trim()) {
      acDebug('skip', { reason: 'empty_content', msgCount: count });
      return;
    }

    const hash = simpleHash(content);
    const preview = content.slice(0, 80).replace(/\n/g, ' ');

    if (hash === state.lastCapturedHash) {
      if (count !== state.lastMessageCount) {
        acDebug('skip', { reason: 'already_captured', hash, msgCount: count });
        state.lastMessageCount = count;
      }
      return;
    }

    if (state.pendingHash !== hash) {
      acDebug('changing', { hash, len: content.length, msgCount: count, preview });
      state.pendingHash = hash;
      state.pendingStableSince = Date.now();
      return;
    }

    if (!state.pendingStableSince) return;

    const stableFor = Date.now() - state.pendingStableSince;
    if (stableFor >= STABLE_MS) {
      acDebug('CAPTURE', { hash, len: content.length, stableFor, msgCount: count, preview });
      state.lastCapturedHash = hash;
      state.lastMessageCount = count;
      state.pendingHash = null;
      state.pendingStableSince = null;

      const { safeSendMessage, showToast } = window.__consensusEngine;
      safeSendMessage({ type: 'AUTO_CAPTURED', source: sourceName, content }, (response) => {
        if (response && response.ok) {
          showToast(`Auto-captured ${sourceName === 'claude' ? 'Claude' : 'Gemini'} response`, 'success');
        }
      });
    } else {
      acDebug('stabilizing', { hash, stableFor, needed: STABLE_MS, msgCount: count });
    }
  }

  function setupAutoCapture(state, selectors, sourceName, intervalKey) {
    const { acDebug } = window.__consensusEngine;
    teardownAutoCapture(state);
    state.pendingHash = null;
    state.pendingStableSince = null;

    const messages = getMessages(selectors);
    state.lastMessageCount = messages.length;

    if (messages.length > 0) {
      const content = extractTextContent(messages[messages.length - 1], selectors);
      if (content && content.trim()) {
        state.lastCapturedHash = simpleHash(content);
      }
    }

    acDebug('setup', {
      msgCount: messages.length,
      initHash: state.lastCapturedHash,
      selectors: selectors.responseContainers[0],
    });

    state.pollInterval = setInterval(() => pollForNewResponse(state, selectors, sourceName), POLL_MS);
    window[intervalKey] = state.pollInterval;
    console.log(`[AIDIALECTIC] Auto-capture polling started (${sourceName === 'claude' ? 'Claude' : 'Gemini'})`);
  }

  function teardownAutoCapture(state) {
    if (state.pollInterval) {
      clearInterval(state.pollInterval);
      state.pollInterval = null;
    }
  }

  // ===== Settings Integration =====

  function checkAndStartAutoCapture(state, selectors, sourceName, intervalKey) {
    chrome.storage.local.get('ce_settings', (data) => {
      const settings = data.ce_settings || {};
      if (settings.autoCapture && !state.autoCaptureEnabled) {
        state.autoCaptureEnabled = true;
        setupAutoCapture(state, selectors, sourceName, intervalKey);
      } else if (!settings.autoCapture && state.autoCaptureEnabled) {
        state.autoCaptureEnabled = false;
        teardownAutoCapture(state);
        console.log(`[AIDIALECTIC] Auto-capture disabled (${sourceName === 'claude' ? 'Claude' : 'Gemini'})`);
      }
    });
  }

  function listenForSettingsChanges(state, selectors, sourceName, intervalKey) {
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.ce_settings) {
        const newSettings = changes.ce_settings.newValue || {};
        if (newSettings.autoCapture && !state.autoCaptureEnabled) {
          state.autoCaptureEnabled = true;
          setupAutoCapture(state, selectors, sourceName, intervalKey);
        } else if (!newSettings.autoCapture && state.autoCaptureEnabled) {
          state.autoCaptureEnabled = false;
          teardownAutoCapture(state);
          console.log(`[AIDIALECTIC] Auto-capture disabled (${sourceName === 'claude' ? 'Claude' : 'Gemini'})`);
        }
      }
    });
  }

  // ===== Message Listener =====

  function listenForMessages(state, selectors, sourceName, intervalKey) {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'spa-navigated') {
          state.lastCapturedHash = null;
          if (state.autoCaptureEnabled) {
            setTimeout(() => setupAutoCapture(state, selectors, sourceName, intervalKey), 500);
          }
        }

        if (message.type === 'inject-captured-text') {
          chrome.storage.local.get(['autoCapturedText'], (result) => {
            if (!result.autoCapturedText) {
              window.__consensusEngine.showToast('No captured text to inject', 'error');
              return;
            }

            let inputField = null;
            for (const sel of selectors.inputField) {
              inputField = document.querySelector(sel);
              if (inputField) break;
            }
            if (!inputField) {
              window.__consensusEngine.showToast('Chat input not found', 'error');
              return;
            }

            if (!inputField.contains(document.activeElement)) {
              inputField.focus();
            }

            const success = document.execCommand('insertText', false, result.autoCapturedText);

            if (!success || inputField.textContent.trim() === '') {
              navigator.clipboard.writeText(result.autoCapturedText).then(() => {
                console.log('[AIDIALECTIC] execCommand failed, text copied to clipboard. Use Ctrl+V.');
                window.__consensusEngine.showToast('Copied to clipboard (Ctrl+V to paste)', 'success');
              });
            } else {
              window.__consensusEngine.showToast('Injected captured response', 'success');
            }

            window.__consensusEngine.safeSendMessage({ type: 'CLEAR_BADGE' });
          });
        }
      });
    } catch {
      // Context invalidated
    }
  }

  // ===== Provider Init =====

  function initProvider(selectors, sourceName, scriptLoadedKey, intervalKey) {
    const currentGen = window.__consensusEngineGen || 0;
    if (window[scriptLoadedKey] === currentGen) return false;

    if (window[intervalKey]) {
      clearInterval(window[intervalKey]);
      window[intervalKey] = null;
    }
    window[scriptLoadedKey] = currentGen;

    const state = {
      autoCaptureEnabled: false,
      lastCapturedHash: null,
      pollInterval: null,
      lastMessageCount: 0,
      pendingHash: null,
      pendingStableSince: null,
    };

    listenForSettingsChanges(state, selectors, sourceName, intervalKey);
    listenForMessages(state, selectors, sourceName, intervalKey);

    window.__consensusEngine.createCaptureButton();
    checkAndStartAutoCapture(state, selectors, sourceName, intervalKey);

    return state;
  }

  // ===== Expose to provider scripts =====

  window.__providerBase = {
    simpleHash,
    extractTextContent,
    htmlToText,
    getMessages,
    pollForNewResponse,
    setupAutoCapture,
    teardownAutoCapture,
    checkAndStartAutoCapture,
    listenForSettingsChanges,
    listenForMessages,
    initProvider,
  };
})();
