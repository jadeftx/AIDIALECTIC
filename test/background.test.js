const test = require('node:test');
const assert = require('node:assert');
const { createStorage, loadBackground } = require('./background-harness');

const claudeTab = { tab: { id: 10, windowId: 1 } };

async function sessionKeys(storage) {
  return Object.keys(storage.data).filter((k) => k.startsWith('session_'));
}

// ===== #6: loaded session survives a service worker restart =====

test('loading a past session persists it as the current session', async () => {
  const storage = createStorage();
  const bg = loadBackground({ storage });

  const { session: older } = await bg.send({ type: 'START_SESSION', context: 'older topic' });
  await bg.send({ type: 'NEW_SESSION' });
  const { session: newer } = await bg.send({ type: 'START_SESSION', context: 'newer topic' });
  assert.strictEqual(storage.data.currentSessionId, newer.id);

  await bg.send({ type: 'LOAD_SESSION', sessionId: older.id });
  assert.strictEqual(storage.data.currentSessionId, older.id);
});

test('auto-capture after a restart lands in the loaded session, not a new one', async () => {
  const storage = createStorage();
  const bg = loadBackground({ storage });

  const { session: older } = await bg.send({ type: 'START_SESSION', context: 'older topic' });
  await bg.send({ type: 'NEW_SESSION' });
  await bg.send({ type: 'START_SESSION', context: 'newer topic' });
  await bg.send({ type: 'LOAD_SESSION', sessionId: older.id });

  // Service worker goes idle and is restarted: in-memory state is gone.
  const restarted = loadBackground({ storage });
  const res = await restarted.send({ type: 'AUTO_CAPTURED', source: 'claude', content: 'reply' }, claudeTab);

  assert.ok(res.ok);
  assert.strictEqual(res.session.id, older.id);
  assert.strictEqual(storage.data[`session_${older.id}`].messages.length, 1);
  assert.strictEqual((await sessionKeys(storage)).length, 2);
});

// ===== #5: no auto-capture with the side panel closed or no session =====

test('auto-capture is ignored while the side panel is closed', async () => {
  const bg = loadBackground({ sidePanelOpen: false });
  const { session } = await bg.send({ type: 'START_SESSION', context: 'topic' });

  const res = await bg.send({ type: 'AUTO_CAPTURED', source: 'claude', content: 'reply' }, claudeTab);

  assert.ok(!res.ok);
  assert.strictEqual(bg.storage.data[`session_${session.id}`].messages.length, 0);
  assert.strictEqual(bg.storage.data.autoCapturedText, undefined);
});

test('auto-capture does not create a session when none is loaded', async () => {
  const bg = loadBackground();
  await bg.send({ type: 'START_SESSION', context: 'topic' });
  await bg.send({ type: 'NEW_SESSION' });

  const before = await sessionKeys(bg.storage);
  const res = await bg.send({ type: 'AUTO_CAPTURED', source: 'gemini', content: 'reply' }, claudeTab);

  assert.ok(!res.ok);
  assert.deepStrictEqual(await sessionKeys(bg.storage), before);
  assert.strictEqual(bg.storage.data.currentSessionId, undefined);
});

test('auto-capture is recorded when the panel is open and a session is loaded', async () => {
  const bg = loadBackground({ sidePanelOpen: true });
  const { session } = await bg.send({ type: 'START_SESSION', context: 'topic' });

  const res = await bg.send({ type: 'AUTO_CAPTURED', source: 'claude', content: 'reply' }, claudeTab);

  assert.ok(res.ok);
  assert.strictEqual(bg.storage.data[`session_${session.id}`].messages[0].content, 'reply');
  assert.strictEqual(bg.storage.data.autoCapturedText, 'reply');
});

test('manual capture still auto-creates a session', async () => {
  const bg = loadBackground({ sidePanelOpen: false });

  const res = await bg.send({ type: 'CAPTURE_RESPONSE', source: 'claude', content: 'reply' }, claudeTab);

  assert.ok(res.ok);
  assert.strictEqual(res.session.messages.length, 1);
});
