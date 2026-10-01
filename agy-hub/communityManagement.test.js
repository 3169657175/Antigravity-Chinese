const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const data = require('./communityData');

test('community ordering uses real creation dates and stable ids, popularity is opt-in', () => {
  const rows = [{ id: 1, username: 'old', content: 'a', created_at: 1700000000, likes_count: 99, replies: [{}] }, { id: 3, username: 'new', content: 'b', created_at: 1800000000000, likes_count: 0, replies: [] }, { id: 2, username: 'same', content: 'c', created_at: '1800000000000', replies: [] }];
  assert.deepEqual(data.feedbacks(rows).map(r => r.id), [3, 2, 1]);
  assert.equal(data.feedbacks(rows, 'popular')[0].id, 1);
  assert.deepEqual(data.feedbacks(rows, 'unanswered').map(r => r.id), [3, 2]);
  assert.deepEqual(data.feedbacks(rows, 'newest', 'NEW').map(r => r.id), [3]);
  assert.equal(data.timestamp(1700000000), data.timestamp(1700000000000));
  assert.equal(data.timestamp('invalid'), 0);
  assert.deepEqual(data.announcements(rows).map(r => r.id), [3, 2, 1]);
  assert.equal(rows[0].id, 1, 'sorting must not mutate cached data');
});

async function fixture() {
  const management = await import('./community-backend/functions/api/auth/_management.js');
  const auth = await import('./community-backend/functions/api/auth/_utils.js');
  const users = await import('./community-backend/functions/api/auth/users.js');
  const sql = new DatabaseSync(':memory:');
  const db = {
    prepare(query) {
      let values = [];
      return { bind(...v) { values = v; return this; }, async first() { return sql.prepare(query).get(...values) || null; }, async all() { return { results: sql.prepare(query).all(...values) }; }, async run() { return { meta: { changes: Number(sql.prepare(query).run(...values).changes) } }; } };
    },
    async batch(statements) { sql.exec('BEGIN'); try { const results = []; for (const statement of statements) results.push(await statement.run()); sql.exec('COMMIT'); return results; } catch (e) { sql.exec('ROLLBACK'); throw e; } }
  };
  sql.exec('CREATE TABLE users (username TEXT PRIMARY KEY, password_hash TEXT, role TEXT, created_at INTEGER)');
  sql.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('owner', 'not-a-real-hash', 'admin', 1);
  sql.prepare('INSERT INTO users VALUES (?, ?, ?, ?)').run('member', 'not-a-real-hash', 'user', 2);
  await management.ensureManagement(db); await management.ensureContent(db);
  const env = { DB: db, JWT_SECRET: 'isolated-test-secret-with-at-least-thirty-two-characters' };
  const token = await auth.generateJWT({ username: 'owner', role: 'admin' }, env.JWT_SECRET);
  const request = (body, query = '') => new Request('https://example.test/api/auth/users' + query, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { management, auth, users, sql, db, env, request };
}

test('admin user details expose metadata and replies but never credentials; nonadmins cannot mutate', async () => {
  const f = await fixture();
  const res = await f.users.onRequestGet({ request: f.request(null, '?username=member&detail=true'), env: f.env });
  const body = await res.json(); assert.equal(res.status, 200); assert.equal(body.user.status, 'active'); assert.ok(Array.isArray(body.replies)); assert.ok(!JSON.stringify(body).includes('password_hash'));
  const memberToken = await f.auth.generateJWT({ username: 'member', role: 'user' }, f.env.JWT_SECRET);
  const denied = await f.users.onRequestPost({ request: new Request('https://example.test/api/auth/users', { method: 'POST', headers: { Authorization: `Bearer ${memberToken}` }, body: JSON.stringify({ username: 'owner', action: 'delete' }) }), env: f.env });
  assert.equal(denied.status, 403); f.sql.close();
});

test('disable, role changes and password resets invalidate existing sessions, including after restoration', async () => {
  const f = await fixture();
  const token = await f.auth.generateJWT({ username: 'member', role: 'user' }, f.env.JWT_SECRET);
  const req = new Request('https://example.test/api', { headers: { Authorization: `Bearer ${token}` } });
  assert.ok(await f.auth.authenticateRequest(req, f.env.JWT_SECRET, f.env));
  for (const action of ['disable', 'enable']) { const res = await f.users.onRequestPost({ request: f.request({ username: 'member', action }), env: f.env }); assert.equal(res.status, 200); assert.equal(await f.auth.authenticateRequest(req, f.env.JWT_SECRET, f.env), null); }
  const reset = await import('./community-backend/functions/api/auth/reset-password.js');
  const before = f.sql.prepare('SELECT session_version FROM user_management WHERE username = ?').get('member').session_version;
  const res = await reset.onRequestPost({ request: f.request({ username: 'member', new_password: 'test-new-password' }), env: f.env });
  assert.equal(res.status, 200); assert.equal(f.sql.prepare('SELECT session_version FROM user_management WHERE username = ?').get('member').session_version, before + 1);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM admin_audit WHERE action = ?').get('reset-password').n, 1); f.sql.close();
});

test('self-management and admin deletion are rejected and content cleanup is complete', async () => {
  const f = await fixture();
  for (const action of ['disable', 'delete', 'role']) assert.equal((await f.users.onRequestPost({ request: f.request({ username: 'owner', action, role: 'user' }), env: f.env })).status, 409);
  f.sql.exec("INSERT INTO users VALUES ('admin2','hash','admin',3)");
  assert.equal((await f.users.onRequestPost({ request: f.request({ username: 'admin2', action: 'delete' }), env: f.env })).status, 409);
  f.sql.exec("INSERT INTO feedbacks VALUES (1,'member','owned',NULL,1),(2,'owner','keep',NULL,2); INSERT INTO replies VALUES (1,1,'owner','thread',1),(2,2,'member','own reply',2),(3,2,'owner','keep reply',3); INSERT INTO feedback_likes VALUES ('owner',1),('member',2); INSERT INTO reply_likes VALUES ('owner',1),('member',3),('owner',2)");
  assert.equal((await f.users.onRequestPost({ request: f.request({ username: 'member', action: 'delete' }), env: f.env })).status, 200);
  assert.deepEqual(f.sql.prepare('SELECT id FROM feedbacks').all().map(r => r.id), [2]);
  assert.deepEqual(f.sql.prepare('SELECT id FROM replies').all().map(r => r.id), [3]);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM reply_likes').get().n, 0);
  assert.equal(f.sql.prepare('SELECT COUNT(*) AS n FROM feedback_likes').get().n, 0);
  assert.equal(f.sql.prepare('SELECT status FROM user_management WHERE username = ?').get('member').status, 'deleted'); f.sql.close();
});

test('feedback server selects newest, popular and unanswered before applying the row limit', async () => {
  const f = await fixture();
  f.sql.exec("INSERT INTO feedbacks VALUES (1,'member','old',NULL,1),(2,'member','new',NULL,2); INSERT INTO replies VALUES (1,1,'owner','answered',1); INSERT INTO feedback_likes VALUES ('owner',1)");
  const handler = await import('./community-backend/functions/api/feedback.js');
  for (const [sort, ids] of [['newest', [2,1]], ['popular', [1,2]], ['unanswered', [2]]]) { const res = await handler.onRequestGet({ request: new Request('https://example.test/api/feedback?sort=' + sort), env: f.env }); assert.equal(res.status, 200); assert.deepEqual((await res.json()).map(r => r.id), ids); }
  f.sql.close();
});
