/**
 * Consensus Engine -- Gemini Content Script
 * Provider-specific selectors and paste logic for gemini.google.com.
 * Shared auto-capture and extraction logic lives in provider-base.js.
 */

(function () {
  'use strict';

  if (!window.__consensusEngine || !window.__providerBase) return;

  const SELECTORS = {
    responseContainers: [
      'message-content.model-response-text',
      '[data-message-author-role="model"], [class*="model-response"]',
      '.response-container .markdown, .model-response .markdown',
      '[class*="response"] .markdown, [class*="message-text"]',
    ],
    inputField: [
      'rich-textarea div[contenteditable="true"]',
      '.ql-editor[contenteditable="true"]',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"][aria-label*="prompt"]',
    ],
    completionSignal: [
      'message-actions',
      'button[aria-label*="opy"]',
      'button[aria-label*="humb"]',
      '[class*="feedback"]',
    ],
    nonContent: 'button, [role="toolbar"], [class*="toolbar"], [class*="action"], [class*="feedback"], [class*="copy"]',
  };

  // ===== Paste Into Chat =====

  window.pasteIntoGeminiChat = function (text) {
    let input = null;
    for (const sel of SELECTORS.inputField) {
      input = document.querySelector(sel);
      if (input) break;
    }

    if (!input) return false;

    input.focus();

    try {
      const dt = new DataTransfer();
      dt.setData('text/plain', text);
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      const handled = input.dispatchEvent(pasteEvent);
      if (handled !== false && input.textContent.trim()) return true;
    } catch (e) {
      /* fall through */
    }

    try {
      const sel = window.getSelection();
      sel.selectAllChildren(input);
      sel.collapseToEnd();
      const ok = document.execCommand('insertText', false, text);
      if (ok && input.textContent.trim()) return true;
    } catch (e) {
      /* fall through */
    }

    input.textContent = text;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  };

  // ===== Response Extraction =====

  window.extractGeminiResponse = function () {
    const { getMessages, extractTextContent } = window.__providerBase;
    const messages = getMessages(SELECTORS);
    if (!messages || !messages.length) return null;
    const lastMessage = messages[messages.length - 1];
    return extractTextContent(lastMessage, SELECTORS);
  };

  // ===== Init =====

  window.__providerBase.initProvider(SELECTORS, 'gemini', '__geminiScriptLoaded', '__geminiAutoCaptureInterval');
})();
