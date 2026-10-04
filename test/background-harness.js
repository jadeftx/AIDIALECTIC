/**
 * Loads background.js into a sandbox with a minimal chrome.* mock so the
 * service worker's message handlers can be exercised from node:test.
 *
 * `storage` is passed in so a test can simulate a service worker restart:
 * load a second background against the same storage object.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto } = require('node:crypto');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', 'background.js'), 'utf8');

// Supports both the promise style (background) and callback style (sidepanel).
function createStorage(initial = {}) {
  const data = structuredClone(initial);
  const done = (result, cb) => {
    if (cb) cb(result);
    return Promise.resolve(result);
  };
  return {
    data,
    get(keys, cb) {
      if (keys == null) return done(structuredClone(data), cb);
      const list = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of list) if (k in data) out[k] = structuredClone(data[k]);
      return done(out, cb);
    },
    set(items, cb) {
      Object.assign(data, structuredClone(items));
      return done(undefined, cb);
    },
    remove(keys, cb) {
      for (const k of Array.isArray(keys) ? keys : [keys]) delete data[k];
      return done(undefined, cb);
    },
  };
}

function loadBackground({ storage = createStorage(), sidePanelOpen = true, onBroadcast = () => {} } = {}) {
  const noopEvent = { addListener() {} };
  let onMessage = null;

  const chrome = {
    storage: { local: storage },
    runtime: {
      onMessage: { addListener: (fn) => (onMessage = fn) },
      onStartup: noopEvent,
      onInstalled: noopEvent,
      sendMessage: async (message) => onBroadcast(structuredClone(message)),
      getManifest: () => ({ version: 'test' }),
      // Chrome reports side panel contexts with windowId -1.
      getContexts: async ({ contextTypes }) =>
        contextTypes.includes('SIDE_PANEL') && sidePanelOpen ? [{ contextType: 'SIDE_PANEL', windowId: -1 }] : [],
    },
    webNavigation: { onHistoryStateUpdated: noopEvent },
    commands: { onCommand: noopEvent },
    action: { onClicked: noopEvent, setBadgeText() {}, setBadgeBackgroundColor() {} },
    sidePanel: { setPanelBehavior() {}, open() {} },
    tabs: { query: (_q, cb) => cb && cb([]), sendMessage: async () => {} },
  };

  const context = vm.createContext({ chrome, crypto: webcrypto, console, structuredClone });
  vm.runInContext(SOURCE, context, { filename: 'background.js' });

  const bg = {
    storage,
    chrome,
    send(message, sender = {}) {
      return new Promise((resolve) => onMessage(message, sender, resolve));
    },
  };
  return bg;
}

module.exports = { createStorage, loadBackground };
