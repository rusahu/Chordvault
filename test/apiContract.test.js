const test = require('node:test');
const { db, user, serve } = require('./helpers/app');
const { createAuthRouter } = require('../routes/auth');
const { createSongsRouter } = require('../routes/songs');
const { createSetlistsRouter } = require('../routes/setlists');
const { createAdminRouter } = require('../routes/admin');
const { createSettingsRouter } = require('../routes/settings');
const { createOfflineRouter } = require('../routes/offline');
const { encryptApiKey } = require('../lib/geminiKey');

const owner = user('owner', 'owner');
const admin = user('admin', 'admin');
const alice = user('alice');
const bob = user('bob');
const callers = { anon: undefined, alice: alice.token, bob: bob.token, admin: admin.token, owner: owner.token };

const insertSong = db.prepare(`INSERT INTO songs (user_id, title, artist, content, visibility, parent_id, status, tags, language, bpm, created_at, updated_at)
  VALUES (@user, @title, 'Writer', @content, @visibility, @parent, @status, @tags, @language, @bpm, @at, @at)`);
let clock = 0;
function song(by, title, extra = {}) {
  clock += 1;
  return Number(insertSong.run({
    user: by.id, title, content: `{title: ${title}}\n{key: G}\n[G]Amazing ${title}`, visibility: 'public', parent: null,
    status: 'active', tags: null, language: 'en', bpm: null, at: `2026-01-01 00:00:${String(clock).padStart(2, '0')}`, ...extra,
  }).lastInsertRowid);
}
const grace = song(alice, 'Grace', { tags: 'worship,hymn' });
const secret = song(alice, 'Secret', { visibility: 'private' });
const graceLive = song(bob, 'Grace Live', { parent: grace, tags: 'hymn' });
const bobSong = song(bob, 'Morning', { tags: 'praise', bpm: 90 });
const bobPrivate = song(bob, 'Bob Private', { visibility: 'private' });
song(alice, '恩典', { language: 'zh' });
const pending = song(bob, 'Grace', { parent: grace, status: 'pending' });

const insertSetlist = db.prepare('INSERT INTO setlists (user_id, name, visibility, event_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)');
const setlist = (by, name, visibility, eventDate, at) => Number(insertSetlist.run(by.id, name, visibility, eventDate, at, at).lastInsertRowid);
const sunday = setlist(alice, 'Sunday', 'public', '2026-03-01', '2026-01-02 00:00:01');
const rehearsal = setlist(alice, 'Rehearsal', 'private', null, '2026-01-02 00:00:02');
const bobList = setlist(bob, 'Bob Night', 'public', '2026-02-01', '2026-01-02 00:00:03');
const insertEntry = db.prepare('INSERT INTO setlist_songs (setlist_id, song_id, position, target_key, nashville, content_override) VALUES (?, ?, ?, ?, ?, ?)');
insertEntry.run(sunday, grace, 1, 'A', 0, null);
insertEntry.run(sunday, bobPrivate, 2, null, 1, null);
insertEntry.run(sunday, bobSong, 3, null, 0, '{title: Morning}\n[D]Override');
insertEntry.run(bobList, secret, 1, null, 0, null);
insertEntry.run(bobList, bobSong, 1, null, 0, null);

db.prepare('UPDATE users SET gemini_api_key = ?, gemini_prompt = ? WHERE id = ?').run(encryptApiKey('k'.repeat(30)), 'Custom prompt', alice.id);
db.prepare('UPDATE users SET gemini_api_key = ? WHERE id = ?').run(encryptApiKey('k'.repeat(30)), bob.id);
// Rows written during the test get CURRENT_TIMESTAMP; pin them so list order never depends on the wall clock.
const pinClock = () => {
  for (const table of ['users', 'songs', 'setlists']) {
    db.prepare(`UPDATE ${table} SET created_at = datetime('2026-01-01', '+' || id || ' seconds')`).run();
  }
  for (const table of ['songs', 'setlists']) {
    db.prepare(`UPDATE ${table} SET updated_at = datetime('2026-02-01', '+' || id || ' seconds')`).run();
  }
};
db.prepare("UPDATE users SET created_at = datetime('2026-01-01', '+' || id || ' seconds')").run();

const realFetch = globalThis.fetch;
const geminiCalls = [];
let geminiReply = '';
globalThis.fetch = async (url, init) => {
  if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) return realFetch(url, init);
  geminiCalls.push({ url: String(url), body: JSON.parse(init.body) });
  return globalThis.Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: geminiReply }] } }] });
};
test.after(() => { globalThis.fetch = realFetch; db.close(); });

const TIME = /\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?/g;
const stable = text => text.replace(TIME, '<time>').replace(/\b[0-9a-f]{16}\b/g, '<code>');

test('API responses match the recorded contract', async t => {
  const request = await serve(t, app => {
    app.use('/api/auth', createAuthRouter());
    app.use('/api', createSongsRouter());
    app.use('/api', createSetlistsRouter());
    app.use('/api', createAdminRouter());
    app.use('/api', createSettingsRouter());
    app.use('/api', createOfflineRouter());
  });
  const results = [];
  async function call(as, path, { method = 'GET', body } = {}) {
    const res = await request(path, { method, body, token: callers[as] });
    const type = (res.headers.get('content-type') || '').split(';')[0];
    const parsed = type === 'application/json' ? JSON.parse(stable(await res.text())) : (await res.arrayBuffer(), `<${type || 'empty'}>`);
    results.push({ call: `${method} ${path} as ${as}`, status: res.status, body: parsed });
    return parsed;
  }
  const everyone = async (path) => { for (const as of Object.keys(callers)) await call(as, path); };
  const untouched = '2000-01-01 00:00:00';
  const resetTouches = () => db.prepare('UPDATE setlists SET updated_at = ?').run(untouched);
  const recordTouches = label => {
    results.push({ call: `setlists touched by ${label}`, ids: db.prepare('SELECT id FROM setlists WHERE updated_at != ? ORDER BY id').all(untouched).map(r => r.id) });
    resetTouches();
  };
  const entryIds = async id => (await (await request(`/api/setlists/${id}`, { token: alice.token })).json()).entries.map(e => e.entry_id);

  const reads = [
    '/api/auth/config',
    '/api/songs', '/api/songs?page=1&limit=2', '/api/songs?q=grace', '/api/songs?q=gr', '/api/songs?tags=hymn,praise', '/api/songs?language=zh', '/api/songs?page=0',
    '/api/songs/public', '/api/songs/public?page=2&limit=2', '/api/songs/public?q=amazing&tags=hymn',
    '/api/users/alice/songs', '/api/users/bob/songs?page=1&limit=1', '/api/users/nobody/songs',
    '/api/tags',
    ...[grace, secret, graceLive, bobPrivate, pending, 99999].map(id => `/api/songs/${id}`), '/api/songs/abc',
    `/api/songs/${grace}/versions`, `/api/songs/${secret}/versions`, `/api/songs/${pending}/versions`,
    `/api/songs/${grace}/corrections`, `/api/songs/${graceLive}/corrections`,
    '/api/songs/export',
    '/api/setlists', '/api/setlists?q=sun', '/api/setlists?date_from=2026-02-15&date_to=2026-12-31', '/api/setlists?date_from=bad', '/api/setlists?page=1&limit=1',
    '/api/setlists/public', '/api/setlists/public?q=night', '/api/setlists/public?date_to=2026-02-15',
    ...[sunday, rehearsal, bobList].flatMap(id => [`/api/setlists/${id}`, `/api/setlists/public/${id}`]), '/api/setlists/x',
    ...['stats', 'users', 'invites', 'corrections', 'config', 'tags'].map(p => `/api/admin/${p}`),
    ...['gemini-key', 'ocr-prompt', 'languages', 'ocr-model'].map(p => `/api/settings/${p}`),
    '/api/offline-library',
  ];
  for (const path of reads) await everyone(path);
  t.assert.snapshot(results.splice(0));

  const created = await call('alice', '/api/songs', { method: 'POST', body: { content: '{title: New}\n{key: C}\n{tempo: 120}\n{x_tags: Worship, worship ,Kids}\n[C]Hello\n', format_detected: 'chordpro', visibility: 'private' } });
  await call('alice', '/api/songs', { method: 'POST', body: { content: '{title: Weird}\n[C]Hi', visibility: 'secret' } });
  await call('alice', '/api/songs', { method: 'POST', body: { content: '[C]No title' } });
  await call('alice', '/api/songs', { method: 'POST', body: { content: '{title: No chords}\nplain' } });
  await call('alice', '/api/songs', { method: 'POST', body: { content: '{title: Lang}\n{x_language: xx}\n[C]Hi' } });
  await call('alice', '/api/songs', { method: 'POST', body: { content: '{title: Tempo}\n{tempo: 999}\n[C]Hi' } });
  await call('anon', '/api/songs', { method: 'POST', body: { content: '{title: X}\n[C]x' } });
  await call('bob', `/api/songs/${grace}`, { method: 'PUT', body: { content: '{title: Grace}\n[C]Hijack' } });
  await call('alice', `/api/songs/${grace}`, { method: 'PUT', body: { content: '  {title: Grace}\n{key: D}\n[D]Amazing grace  \n', visibility: 'public' } });
  await call('admin', `/api/songs/${bobSong}`, { method: 'PUT', body: { format_detected: 'plain' } });
  const version = await call('bob', `/api/songs/${grace}/version`, { method: 'POST', body: { content: '{title: Grace v2}\n[E]Amazing' } });
  await call('alice', `/api/songs/${bobPrivate}/version`, { method: 'POST', body: { content: '{title: Steal}\n[E]x' } });
  const adminCopy = await call('admin', `/api/songs/${bobPrivate}/version`, { method: 'POST', body: { content: '{title: Admin copy}\n[E]x' } });
  await call('bob', `/api/songs/${secret}/correction`, { method: 'POST', body: { content: '{title: Secret}\n[C]fix' } });
  await call('alice', `/api/songs/${pending}/correction`, { method: 'POST', body: { content: '{title: Grace}\n[C]fix' } });
  await call('bob', `/api/songs/${bobSong}/correction`, { method: 'POST', body: { content: '' } });
  const { id: aliceFix } = await call('alice', `/api/songs/${bobSong}/correction`, { method: 'POST', body: { content: '{title: Morning}\n[C]better' } });
  await call('alice', `/api/songs/${bobSong}/corrections`);
  await call('bob', `/api/songs/${bobSong}/corrections`);
  await call('alice', `/api/songs/${aliceFix}`);
  await call('bob', `/api/corrections/${pending}/approve`, { method: 'PUT' });
  await call('alice', `/api/corrections/${pending}/approve`, { method: 'PUT' });
  await call('alice', `/api/corrections/${pending}/approve`, { method: 'PUT' });
  await call('alice', `/api/songs/${grace}`);
  await call('admin', '/api/songs/import', { method: 'POST', body: { songs: [{ content: '{title: Imp}\n[C]a', visibility: 'private' }, { content: '{title: Imp}\n[C]a  ' }, 'bad', { content: 'no title [C]' }, { content: '{title: V}\n[C]x', visibility: 'odd' }] } });
  await call('admin', '/api/songs/import', { method: 'POST', body: { songs: 'x' } });
  await call('alice', '/api/songs/import', { method: 'POST', body: { songs: [] } });
  const [imported] = await call('admin', '/api/songs?q=imp');
  for (const id of [created.id, version.id, adminCopy.id, imported.id]) await call('admin', `/api/songs/${id}`);

  const easter = await call('alice', '/api/setlists', { method: 'POST', body: { name: '  Easter  ', visibility: 'private', event_date: '2026-04-05' } });
  await call('alice', '/api/setlists', { method: 'POST', body: { name: '' } });
  await call('alice', '/api/setlists', { method: 'POST', body: { name: 'x'.repeat(201) } });
  await call('alice', '/api/setlists', { method: 'POST', body: { name: 'Bad date', event_date: '2026-02-30' } });
  await call('alice', '/api/setlists', { method: 'POST', body: { name: 'Weird vis', visibility: 'secret' } });
  await call('bob', `/api/setlists/${sunday}`, { method: 'PUT', body: { name: 'Mine' } });
  await call('alice', `/api/setlists/${sunday}`, { method: 'PUT', body: { name: 'Sunday AM', visibility: 'public' } });
  await call('alice', '/api/setlists/abc', { method: 'PUT', body: { name: 'x' } });
  resetTouches();
  await call('bob', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: grace } });
  await call('bob', `/api/setlists/${sunday}/songs`, { method: 'POST', body: {} });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: {} });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: 'x' } });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: grace, nashville: 'yes' } });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: bobPrivate } });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: aliceFix } });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: grace, target_key: 'X' } });
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: grace, target_key: 'X', nashville: 'yes' } });
  recordTouches('failed entry adds');
  await call('alice', `/api/setlists/${sunday}/songs`, { method: 'POST', body: { song_id: graceLive, target_key: ' Db ', nashville: true } });
  recordTouches('entry add');
  const [first, , , added] = await entryIds(sunday);
  await call('alice', '/api/setlists/abc/entries/xyz', { method: 'PUT', body: {} });
  await call('alice', '/api/setlists/99999/entries/xyz', { method: 'PUT', body: {} });
  await call('alice', '/api/setlists/99999/entries/1', { method: 'PUT', body: {} });
  await call('bob', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { nashville: 2 } });
  await call('alice', `/api/setlists/${sunday}/entries/99999`, { method: 'PUT', body: {} });
  await call('alice', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { nashville: 2 } });
  await call('alice', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { target_key: 'X', nashville: 2 } });
  recordTouches('failed entry updates');
  await call('alice', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { content_override: 5 } });
  await call('alice', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { content_override: 'x'.repeat(100001) } });
  await call('alice', `/api/setlists/${sunday}/entries/${first}`, { method: 'PUT', body: { target_key: 'Gb', font: 2, two_col: true, content_override: '{title: G}\n[C]o' } });
  recordTouches('entry update');
  await call('alice', `/api/setlists/${sunday}/entries/${added}`, { method: 'PUT', body: { target_key: null, two_col: null } });
  recordTouches('second entry update');
  await call('alice', `/api/setlists/${sunday}`);
  await call('alice', `/api/setlists/${sunday}/entries/99999`, { method: 'DELETE' });
  recordTouches('missing entry delete');
  await call('alice', `/api/setlists/${sunday}/entries/${added}`, { method: 'DELETE' });
  recordTouches('entry delete');
  const ids = await entryIds(sunday);
  await call('bob', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: { entry_ids: ids } });
  await call('alice', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: {} });
  await call('alice', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: { entry_ids: ['a'] } });
  await call('alice', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: { entry_ids: [ids[0], ids[0], ids[1]] } });
  await call('alice', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: { entry_ids: ids.slice(1) } });
  recordTouches('failed reorders');
  await call('alice', `/api/setlists/${sunday}/reorder`, { method: 'PUT', body: { entry_ids: [...ids].reverse() } });
  recordTouches('reorder');
  await call('alice', `/api/setlists/${sunday}`);
  await call('bob', `/api/setlists/${sunday}`, { method: 'DELETE' });
  await call('alice', `/api/setlists/${easter.id}`, { method: 'DELETE' });
  await call('alice', `/api/corrections/${aliceFix}`, { method: 'DELETE' });
  await call('bob', `/api/corrections/${aliceFix}`, { method: 'DELETE' });
  t.assert.snapshot(results.splice(0));

  const adminRoutes = [
    ['PUT', `/api/admin/users/${bob.id}/role`, { role: 'admin' }], ['PUT', `/api/admin/users/${bob.id}/disabled`, { disabled: true }],
    ['PUT', `/api/admin/users/${bob.id}/password`, { password: 'secret12' }], ['POST', '/api/admin/users', { username: 'carol', password: 'secret12' }],
    ['DELETE', `/api/admin/users/${bob.id}`], ['DELETE', `/api/admin/songs/${bobSong}`], ['POST', '/api/admin/invites'],
    ['DELETE', '/api/admin/invites/1'], ['PUT', '/api/admin/tags', { tags: ['a'] }], ['DELETE', '/api/admin/tags'],
    ['PUT', '/api/admin/config', { allowRegistration: true }], ['GET', '/api/admin/nope'],
  ];
  for (const [method, path, body] of adminRoutes) {
    for (const as of ['anon', 'alice']) await call(as, path, { method, body });
  }
  await call('admin', `/api/admin/users/${alice.id}/role`, { method: 'PUT', body: { role: 'admin' } });
  await call('owner', `/api/admin/users/${alice.id}/role`, { method: 'PUT', body: { role: 'superuser' } });
  await call('owner', `/api/admin/users/${alice.id}/role`, { method: 'PUT', body: { role: 'admin' } });
  await call('admin', `/api/admin/users/${alice.id}/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('owner', `/api/admin/users/${alice.id}/role`, { method: 'PUT', body: { role: 'user' } });
  await call('admin', `/api/admin/users/${owner.id}/role`, { method: 'PUT', body: { role: 'user' } });
  await call('owner', `/api/admin/users/${owner.id}/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('admin', `/api/admin/users/${admin.id}/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('owner', `/api/admin/users/${admin.id}/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('owner', '/api/admin/users');
  await call('owner', `/api/admin/users/${admin.id}/disabled`, { method: 'PUT', body: { disabled: false } });
  await call('admin', `/api/admin/users/${bob.id}/disabled`, { method: 'PUT', body: { disabled: 'yes' } });
  await call('admin', `/api/admin/users/abc/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('admin', `/api/admin/users/99999/disabled`, { method: 'PUT', body: { disabled: true } });
  await call('admin', `/api/admin/users/${bob.id}/password`, { method: 'PUT', body: { password: '123' } });
  await call('admin', `/api/admin/users/${bob.id}/password`, { method: 'PUT', body: { password: 'secret12' } });
  await call('admin', '/api/admin/users', { method: 'POST', body: { username: 'ab', password: 'secret12' } });
  const carol = await call('admin', '/api/admin/users', { method: 'POST', body: { username: ' carol ', password: 'secret12' } });
  await call('admin', '/api/admin/users', { method: 'POST', body: { username: 'carol', password: 'secret12' } });
  await call('admin', `/api/admin/users/${carol.id}`, { method: 'DELETE' });
  await call('admin', '/api/admin/invites', { method: 'POST' });
  const [invite] = await call('admin', '/api/admin/invites');
  await call('admin', `/api/admin/invites/${invite.id}`, { method: 'DELETE' });
  await call('admin', `/api/admin/invites/${invite.id}`, { method: 'DELETE' });
  await call('admin', '/api/admin/tags', { method: 'PUT', body: { tags: ['Worship', ' kids ', 'praise'] } });
  await call('admin', '/api/admin/tags', { method: 'PUT', body: { tags: ['a,b'] } });
  await call('anon', '/api/tags');
  await call('admin', '/api/admin/tags', { method: 'DELETE' });
  await call('admin', '/api/admin/config', { method: 'PUT', body: { allowRegistration: 'yes' } });
  await call('admin', '/api/admin/config', { method: 'PUT', body: { allowRegistration: true } });
  await call('anon', '/api/auth/config');
  await call('admin', '/api/admin/songs/99999', { method: 'DELETE' });
  t.assert.snapshot(results.splice(0));

  geminiReply = 'DETECTED_LANGUAGE: en\n```\n{title: Scan}\n[C]Hello\n```';
  await call('alice', '/api/ocr/gemini', { method: 'POST', body: { image: 'data:image/png;base64,AAAA' } });
  geminiReply = 'not json';
  await call('bob', '/api/ocr/gemini', { method: 'POST', body: { image: 'AAAA', model: 'gemini-2.5-flash' } });
  geminiReply = '```\n{title: Scan}\n[D]Fixed\n```';
  await call('alice', '/api/ocr/gemini/refine', { method: 'POST', body: { image: 'data:image/png;base64,AAAA', history: [{ role: 'model', text: '{title: Scan}' }, { role: 'user', text: 'fix' }], message: 'Use D' } });
  await call('admin', '/api/ocr/gemini', { method: 'POST', body: { image: 'AAAA' } });
  await call('alice', '/api/settings/languages', { method: 'PUT', body: { languages: ['en', 'zh'] } });
  await call('alice', '/api/settings/languages', { method: 'PUT', body: { languages: ['qq'] } });
  await call('alice', '/api/settings/languages');
  await call('alice', '/api/settings/ocr-model', { method: 'PUT', body: { model: 'nope' } });
  await call('alice', '/api/settings/ocr-model', { method: 'PUT', body: { model: 'gemini-2.5-flash' } });
  await call('alice', '/api/settings/ocr-prompt', { method: 'PUT', body: { prompt: '  Read it  ' } });
  await call('alice', '/api/settings/ocr-prompt');
  await call('alice', '/api/settings/ocr-prompt', { method: 'DELETE' });
  await call('alice', '/api/settings/gemini-key', { method: 'PUT', body: { api_key: 'short' } });
  await call('alice', '/api/settings/gemini-key', { method: 'DELETE' });
  t.assert.snapshot({ responses: results.splice(0), geminiCalls });

  await call('admin', `/api/admin/songs/${bobPrivate}`, { method: 'DELETE' });
  pinClock();
  for (const path of ['/api/songs', '/api/songs/public', '/api/setlists', '/api/setlists/public', `/api/setlists/${sunday}`, `/api/setlists/public/${bobList}`,
    `/api/songs/${grace}`, `/api/songs/${grace}/versions`, '/api/admin/stats', '/api/admin/users', '/api/tags', '/api/offline-library']) await everyone(path);
  t.assert.snapshot(results.splice(0));
});
