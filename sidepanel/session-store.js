/**
 * Consensus Engine — Session Store
 * Owns the side panel's copy of the current session and every request to the
 * background service worker. No DOM access: views subscribe and re-render
 * when the session changes.
 */

const SessionStore = (() => {
  let session = null;
  const listeners = [];

  function send(message) {
    return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
  }

  function get() {
    return session;
  }

  function set(next) {
    session = next;
    listeners.forEach((fn) => fn(session));
  }

  function subscribe(fn) {
    listeners.push(fn);
  }

  // Sends a request and adopts the session the background replies with.
  async function apply(message) {
    const response = await send(message);
    if (response && response.session) set(response.session);
    return response;
  }

  // Background broadcasts after captures and edits made outside the panel.
  function listenForUpdates() {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'SESSION_UPDATED') set(message.session);
    });
  }

  // Initial load: adopt quietly, the caller renders once everything is ready.
  async function load() {
    const response = await send({ type: 'GET_SESSION' });
    if (response && response.session) session = response.session;
  }

  async function reset() {
    await send({ type: 'NEW_SESSION' });
    set(null);
  }

  function lastAISource(s = session) {
    if (!s || !s.messages.length) return null;
    for (let i = s.messages.length - 1; i >= 0; i--) {
      const src = s.messages[i].source;
      if (src === 'claude' || src === 'gemini') return src;
    }
    return null;
  }

  return {
    get,
    subscribe,
    send,
    listenForUpdates,
    load,
    reset,
    lastAISource,
    start: (context) => apply({ type: 'START_SESSION', context }),
    loadById: (sessionId) => apply({ type: 'LOAD_SESSION', sessionId }),
    deleteById: (sessionId) => send({ type: 'DELETE_SESSION', sessionId }),
    listAll: () => send({ type: 'GET_ALL_SESSIONS' }),
    addInterjection: (content) => apply({ type: 'CAPTURE_RESPONSE', source: 'user', content }),
    insertMessage: (source, content, insertIndex) => apply({ type: 'INSERT_MESSAGE', source, content, insertIndex }),
    deleteMessage: (messageId) => apply({ type: 'DELETE_MESSAGE', messageId }),
    // The background broadcasts the result, so no reply handling is needed.
    updateMessageSource: (messageId, newSource) => send({ type: 'UPDATE_MESSAGE_SOURCE', messageId, newSource }),
    setNextTurn: (nextTurn) => apply({ type: 'SET_NEXT_TURN', nextTurn }),
    markConsensus: () => apply({ type: 'MARK_CONSENSUS' }),
    reopenConsensus: () => apply({ type: 'REOPEN_CONSENSUS' }),
    queuePush: (content) => send({ type: 'SET_PENDING_PUSH', content }),
  };
})();
