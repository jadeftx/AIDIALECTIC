/**
 * Consensus Engine -- Claude.ai Content Script
 * Provider-specific selectors and paste logic for claude.ai.
 * Shared auto-capture and extraction logic lives in provider-base.js.
 */

(function () {
  'use strict';

  if (!window.__consensusEngine || !window.__providerBase) return;

  const SELECTORS = {
    responseContainers: [
      '[data-is-streaming="false"]',
      '.font-claude-message',
      '[class*="response"], [class*="assistant"], [class*="message"]',
      '.prose, .markdown, [class*="prose"]',
    ],
    inputField: [
      'div.ProseMirror[contenteditable="true"]',
      'fieldset div[contenteditable="true"]',
      'div[contenteditable="true"][data-placeholder]',
    ],
    completionSignal: [
      '[data-is-streaming="false"]',
      'button[aria-label*="opy"]',
      'button[aria-label*="humb"]',
      '[role="toolbar"]',
    ],
    nonContent: 'button, [role="toolbar"], [class*="toolbar"], [class*="action"]',
  };

  // ===== Paste Into Chat =====

  window.pasteIntoClaudeChat = function (text) {
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
      const notCancelled = input.dispatchEvent(pasteEvent);
      if (!notCancelled) return true;
      if (input.textContent.trim()) return true;
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

  window.extractClaudeResponse = function () {
    const { getMessages, extractTextContent } = window.__providerBase;
    const messages = getMessages(SELECTORS);
    if (!messages || !messages.length) return null;
    const lastMessage = messages[messages.length - 1];
    return extractTextContent(lastMessage, SELECTORS);
  };

  // ===== Init =====

  window.__providerBase.initProvider(SELECTORS, 'claude', '__claudeScriptLoaded', '__claudeAutoCaptureInterval');
})();
