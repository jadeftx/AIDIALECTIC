/**
 * Boots sidepanel.html in jsdom, wired to a real background.js (see
 * background-harness.js) so tests drive the panel the way a user would.
 * Scripts load in the order sidepanel.html lists them, as classic scripts
 * sharing one global scope, like the browser.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { JSDOM, VirtualConsole } = require('jsdom');
const { createStorage, loadBackground } = require('./background-harness');

const PANEL_DIR = path.join(__dirname, '..', 'sidepanel');
const HTML = fs.readFileSync(path.join(PANEL_DIR, 'sidepanel.html'), 'utf8');

const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

async function loadSidepanel({ storage = createStorage() } = {}) {
  const panelListeners = [];
  const bg = loadBackground({
    storage,
    onBroadcast: (message) => panelListeners.forEach((fn) => fn(message)),
  });

  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (e) => {
    if (!String(e.message).includes('navigation')) throw e;
  });
  const dom = new JSDOM(HTML, { runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole });
  const { window } = dom;

  const downloads = [];
  const clipboard = [];
  window.URL.createObjectURL = (blob) => {
    downloads.push({ blob });
    return 'blob:test';
  };
  window.URL.revokeObjectURL = () => {};
  window.HTMLAnchorElement.prototype.click = function () {
    if (this.download) downloads[downloads.length - 1].filename = this.download;
  };
  Object.defineProperty(window.navigator, 'clipboard', {
    value: { writeText: async (text) => clipboard.push(text) },
  });
  window.confirm = () => true;

  window.chrome = {
    storage: { local: storage },
    runtime: {
      sendMessage: (message, cb) => {
        bg.send(structuredClone(message)).then((res) => cb && cb(structuredClone(res)));
      },
      onMessage: { addListener: (fn) => panelListeners.push(fn) },
      getManifest: () => ({ version: '9.9.9' }),
    },
  };

  const context = dom.getInternalVMContext();
  const scripts = [...HTML.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
  for (const src of scripts) {
    const file = path.join(PANEL_DIR, src);
    new vm.Script(fs.readFileSync(file, 'utf8'), { filename: file }).runInContext(context);
  }
  await flush();

  const $ = (sel) => window.document.querySelector(sel);
  const $$ = (sel) => [...window.document.querySelectorAll(sel)];
  return {
    window,
    bg,
    storage,
    downloads,
    clipboard,
    $,
    $$,
    async click(target) {
      const el = typeof target === 'string' ? $(target) : target;
      el.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
      await flush();
    },
    // A provider tab capturing a response, as the content script would.
    async capture(source, content) {
      await bg.send({ type: 'CAPTURE_RESPONSE', source, content }, { tab: { id: 1, windowId: 1 } });
      await flush();
    },
    readBlob(blob) {
      return new Promise((resolve) => {
        const reader = new window.FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsText(blob);
      });
    },
    messages() {
      return $$('#thread .message').map((m) => ({
        label: m.querySelector('.source-label').textContent,
        body: m.querySelector('.message-body').textContent.trim(),
      }));
    },
  };
}

module.exports = { loadSidepanel, flush };
