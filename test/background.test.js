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
