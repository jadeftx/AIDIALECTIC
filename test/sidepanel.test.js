const test = require('node:test');
const assert = require('node:assert');
const { loadSidepanel } = require('./sidepanel-harness');

const hidden = (el) => el.classList.contains('hidden');

async function startSession(panel, context = 'Is a hot dog a sandwich?') {
  panel.$('#initial-context').value = context;
  await panel.click('#btn-start-session');
}

test('empty panel shows the start form', async () => {
  const p = await loadSidepanel();

  assert.ok(!hidden(p.$('#initial-context-section')));
  assert.ok(hidden(p.$('#action-bar')));
  assert.ok(hidden(p.$('#consensus-bar')));
  assert.strictEqual(p.$('#turn-indicator').textContent, 'Start a session');
  assert.strictEqual(p.$('#thread').children.length, 0);
});

test('starting a session renders the context and queues the initial prompt', async () => {
  const p = await loadSidepanel();
  await startSession(p);

  assert.ok(hidden(p.$('#initial-context-section')));
  assert.deepStrictEqual(p.messages(), [{ label: 'Initial Context', body: 'Is a hot dog a sandwich?' }]);
  assert.strictEqual(p.$('#turn-indicator').textContent, 'Waiting for first capture ');
  assert.ok(p.storage.data.pendingPush.includes('Is a hot dog a sandwich?'));
  assert.match(p.$('.toast').textContent, /Session started/);
});

test('captured responses render with rounds, turn and action bar', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'Yes, structurally.');
  await p.capture('gemini', 'No, culturally.');
  await p.capture('claude', 'Fair point.');

  assert.deepStrictEqual(
    p.messages().map((m) => m.label),
    ['Initial Context', 'Claude', 'Gemini', 'Claude'],
  );
  assert.deepStrictEqual(
    p.$$('.round-divider').map((d) => d.textContent),
    ['Round 1', 'Round 2'],
  );
  assert.match(p.$('#turn-indicator').textContent, /Gemini's turn \(Round 2\)/);
  assert.strictEqual(p.$('#round-counter').textContent, 'Round 2');
  assert.ok(!hidden(p.$('#action-bar')));
  assert.strictEqual(p.$('#handoff-target').textContent, 'Gemini');
  assert.strictEqual(p.$('#reply-target').textContent, 'Claude');
  assert.strictEqual(p.$('#btn-consensus').textContent, 'Mark Consensus');
  // One insert button before the context, one after it, one after each message
  assert.strictEqual(p.$$('.inline-insert-btn').length, 5);
});

test('prepare handoff queues a prompt for the next model', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'Yes, structurally.');
  await p.click('#btn-prepare-handoff');

  assert.ok(p.storage.data.pendingPush.includes('Yes, structurally.'));
  assert.strictEqual(p.clipboard.at(-1), p.storage.data.pendingPush);
  assert.match(p.$('.toast').textContent, /Gemini's page/);
});

test('turn indicator click switches the turn', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'Yes.');
  await p.click('.turn-override');

  assert.match(p.$('#turn-indicator').textContent, /Claude's turn/);
  assert.strictEqual(p.bg.storage.data[`session_${p.storage.data.currentSessionId}`].nextTurn, 'claude');
});

test('reply to the last model adds a user interjection', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('gemini', 'No.');
  await p.click('#btn-interject');

  assert.ok(!hidden(p.$('#interjection-section')));
  assert.strictEqual(p.$('#interject-target').textContent, 'Gemini');

  p.$('#interjection-text').value = 'Consider tacos.';
  await p.click('#btn-submit-interject');

  assert.ok(hidden(p.$('#interjection-section')));
  assert.deepStrictEqual(p.messages().at(-1), { label: 'User Interjection', body: 'Consider tacos.' });
  assert.strictEqual(p.storage.data.pendingPush, 'Consider tacos.');
});

test('inline insert splices a message at the chosen position', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'First.');
  await p.capture('gemini', 'Second.');

  // Insert buttons: [before ctx, after ctx (0), after msg 0 (1), after msg 1 (2)]
  const form = p.$('#inline-insert-form');
  await p.click(p.$$('.inline-insert-btn button')[2]);
  assert.ok(!hidden(form));
  assert.strictEqual(form.previousElementSibling, p.$$('.inline-insert-btn')[2]);
  p.$('#inline-insert-source').value = 'user';
  p.$('#inline-insert-content').value = 'Middle.';
  await p.click('#btn-submit-inline-insert');

  assert.deepStrictEqual(
    p.messages().map((m) => m.body),
    ['Is a hot dog a sandwich?', 'First.', 'Middle.', 'Second.'],
  );
  assert.ok(hidden(form));
});

test('messages can be deleted and relabelled', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'First.');
  await p.capture('gemini', 'Second.');

  await p.click(p.$$('.btn-delete-msg')[0]);
  assert.deepStrictEqual(
    p.messages().map((m) => m.body),
    ['Is a hot dog a sandwich?', 'Second.'],
  );

  await p.click(p.$$('.source-label')[1]);
  const options = p.$$('.source-dropdown .source-option');
  assert.deepStrictEqual(
    options.map((o) => o.textContent),
    ['Claude', 'Gemini', 'User'],
  );
  await p.click(options[0]);
  assert.strictEqual(p.messages()[1].label, 'Claude');
});

test('consensus can be marked and reopened', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', 'Agreed.');

  await p.click('#btn-consensus');
  assert.match(p.$('#turn-indicator').textContent, /CONSENSUS REACHED/);
  assert.strictEqual(p.$('#btn-consensus').textContent, 'Reopen Session');
  assert.ok(p.$('#thread .message.consensus'));

  await p.click('#btn-consensus');
  assert.match(p.$('#turn-indicator').textContent, /Gemini's turn/);
  assert.strictEqual(p.$('#btn-consensus').textContent, 'Mark Consensus');
});

test('markdown and JSON export download the session', async () => {
  const p = await loadSidepanel();
  await startSession(p, 'Hot dogs & sandwiches!');
  await p.capture('claude', 'Yes.');

  await p.click('#btn-export-toggle');
  assert.ok(!hidden(p.$('#export-dropdown')));
  await p.click('#btn-export-md-header');
  assert.ok(hidden(p.$('#export-dropdown')));

  await p.click('#btn-export-toggle');
  await p.click('#btn-export-json-header');

  const [md, json] = p.downloads;
  assert.strictEqual(md.filename, 'hot-dogs-sandwiches.md');
  const mdText = await p.readBlob(md.blob);
  assert.match(mdText, /^# AIDIALECTIC Transcript/);
  assert.match(mdText, /## Initial Context\n\nHot dogs & sandwiches!/);
  assert.match(mdText, /### Round 1\n\n#### \[Claude\] — .*\n\nYes\./);

  assert.strictEqual(json.filename, 'hot-dogs-sandwiches.json');
  assert.strictEqual(JSON.parse(await p.readBlob(json.blob)).messages[0].content, 'Yes.');
  assert.strictEqual(p.$('#export-status').textContent, 'JSON downloaded!');
});

test('export with no session shows an error toast', async () => {
  const p = await loadSidepanel();
  await p.click('#btn-export-toggle');

  assert.ok(hidden(p.$('#export-dropdown')));
  assert.strictEqual(p.$('.toast').textContent, 'No session to export');
});

test('GitHub push without settings asks for configuration', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.click('#btn-export-toggle');
  await p.click('#btn-push-github-header');

  assert.strictEqual(p.$('#export-dropdown-status').textContent, 'GitHub not configured. Go to Settings.');
});

test('settings modal saves and keeps unrelated keys', async () => {
  const p = await loadSidepanel();
  p.storage.data.ce_settings = { somethingElse: 1 };
  await p.click('#btn-settings');
  assert.ok(!hidden(p.$('#settings-modal')));

  p.$('#settings-github-repo').value = ' me/logs ';
  p.$('#mod-tone').value = 'sassy';
  await p.click('#settings-toggle-autocapture');
  await p.click('#settings-btn-save');

  assert.deepStrictEqual(p.storage.data.ce_settings, {
    githubRepo: 'me/logs',
    githubPath: '',
    githubToken: '',
    systemContext: '',
    modLength: 'normal',
    modTone: 'sassy',
    autoCapture: true,
  });
  assert.strictEqual(p.$('#settings-status').textContent, 'Settings saved!');

  await p.click('#btn-close-settings');
  assert.ok(hidden(p.$('#settings-modal')));
});

test('saved modifiers shape the initial prompt', async () => {
  const p = await loadSidepanel();
  await p.click('#btn-settings');
  p.$('#mod-length').value = 'short';
  await p.click('#settings-btn-save');
  await startSession(p);

  assert.match(p.storage.data.pendingPush, /RUNTIME MODIFIERS/);
});

test('theme and zoom controls persist', async () => {
  const p = await loadSidepanel();
  assert.strictEqual(p.window.document.documentElement.getAttribute('data-theme'), 'light');

  await p.click('#btn-theme-toggle');
  assert.strictEqual(p.window.document.documentElement.getAttribute('data-theme'), 'dark');
  assert.strictEqual(p.storage.data.ce_theme, 'dark');
  assert.match(p.$('#brand-logo').src, /socrates-head-dark\.png$/);

  await p.click('#btn-font-up');
  assert.strictEqual(p.storage.data.ce_ui_zoom, 0.91);
});

test('help modal shows the extension version', async () => {
  const p = await loadSidepanel();
  await p.click('#btn-help');
  assert.ok(!hidden(p.$('#help-modal')));
  assert.strictEqual(p.$('#help-version').textContent, 'v9.9.9');
  await p.click('#btn-close-help');
  assert.ok(hidden(p.$('#help-modal')));
});

test('history lists, loads and deletes past sessions', async () => {
  const p = await loadSidepanel();
  await startSession(p, 'Older topic');
  await p.capture('claude', 'Old reply.');
  await p.click('#btn-new-session');
  assert.ok(!hidden(p.$('#initial-context-section')));
  assert.strictEqual(p.$('#initial-context').value, '');

  await startSession(p, 'Newer topic');

  await p.click('#btn-sessions-list');
  assert.ok(p.$('#view-sessions').classList.contains('active'));
  const titles = p.$$('.session-item-title').map((t) => t.textContent);
  assert.strictEqual(titles.length, 2);
  assert.ok(titles.includes('Older topic') && titles.includes('Newer topic'));

  const older = p.$$('.session-item').find((i) => i.textContent.includes('Older topic'));
  assert.match(older.querySelector('.session-item-meta').textContent, /1 rounds\s+1 messages/);
  await p.click(older.querySelector('.btn-load'));
  assert.ok(p.$('#view-conversation').classList.contains('active'));
  assert.deepStrictEqual(
    p.messages().map((m) => m.body),
    ['Older topic', 'Old reply.'],
  );

  await p.click('#btn-sessions-list');
  const newer = p.$$('.session-item').find((i) => i.textContent.includes('Newer topic'));
  await p.click(newer.querySelector('.btn-delete'));
  assert.deepStrictEqual(
    p.$$('.session-item-title').map((t) => t.textContent),
    ['Older topic'],
  );
});

test('the panel re-renders when the background broadcasts an update', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.bg.send({ type: 'INSERT_MESSAGE', source: 'gemini', content: 'Pushed from elsewhere.', insertIndex: 0 });
  await new Promise((r) => setTimeout(r, 10));

  assert.deepStrictEqual(p.messages().at(-1), { label: 'Gemini', body: 'Pushed from elsewhere.' });
});

test('long messages are collapsed', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.capture('claude', ['one', 'two', 'three', 'four', 'five'].join('\n'));

  const last = p.$$('#thread .message').at(-1);
  assert.ok(last.querySelector('.collapse-container'));
});

test('settings can export all sessions and clear saved data', async () => {
  const p = await loadSidepanel();
  await startSession(p);
  await p.click('#settings-btn-export-all');

  const backup = JSON.parse(await p.readBlob(p.downloads[0].blob));
  assert.match(p.downloads[0].filename, /^aidialectic-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.strictEqual(Object.keys(backup.sessions).length, 1);
  assert.strictEqual(p.$('#settings-status').textContent, 'All sessions exported!');

  await p.click('#settings-btn-clear-data');
  assert.deepStrictEqual(
    Object.keys(p.storage.data).filter((k) => k.startsWith('session_') || k === 'currentSessionId'),
    [],
  );
  assert.strictEqual(p.$('#settings-status').textContent, 'All sessions cleared.');
});
