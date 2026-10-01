export const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json;charset=utf-8', 'Cache-Control': 'no-store' } });
export async function ensureManagement(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS user_management (username TEXT PRIMARY KEY, status TEXT NOT NULL DEFAULT 'active', admin_note TEXT NOT NULL DEFAULT '', last_login_at INTEGER, session_version INTEGER NOT NULL DEFAULT 0)").run();
  await db.prepare('CREATE TABLE IF NOT EXISTS admin_audit (id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT NOT NULL, target TEXT NOT NULL, action TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
}
export async function ensureContent(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS feedbacks (id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL, content TEXT NOT NULL, image_url TEXT, created_at INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS replies (id INTEGER PRIMARY KEY AUTOINCREMENT, feedback_id INTEGER NOT NULL, username TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL)').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS feedback_likes (username TEXT NOT NULL, feedback_id INTEGER NOT NULL, PRIMARY KEY (username, feedback_id))').run();
  await db.prepare('CREATE TABLE IF NOT EXISTS reply_likes (username TEXT NOT NULL, reply_id INTEGER NOT NULL, PRIMARY KEY (username, reply_id))').run();
}
export function audit(db, actor, target, action) {
  return db.prepare('INSERT INTO admin_audit (actor, target, action, created_at) VALUES (?, ?, ?, ?)').bind(actor, target, action, Date.now());
}
export function clearContent(db, username) {
  return [
    db.prepare('DELETE FROM reply_likes WHERE username = ? OR reply_id IN (SELECT id FROM replies WHERE username = ? OR feedback_id IN (SELECT id FROM feedbacks WHERE username = ?))').bind(username, username, username),
    db.prepare('DELETE FROM feedback_likes WHERE username = ? OR feedback_id IN (SELECT id FROM feedbacks WHERE username = ?)').bind(username, username),
    db.prepare('DELETE FROM replies WHERE username = ? OR feedback_id IN (SELECT id FROM feedbacks WHERE username = ?)').bind(username, username),
    db.prepare('DELETE FROM feedbacks WHERE username = ?').bind(username)
  ];
}
export const USER_FIELDS = `u.username, u.role, u.created_at, COALESCE(m.status, 'active') AS status, COALESCE(m.admin_note, '') AS admin_note, m.last_login_at,
  (SELECT COUNT(*) FROM feedbacks f WHERE f.username = u.username) AS feedback_count,
  (SELECT COUNT(*) FROM replies r WHERE r.username = u.username) AS reply_count`;
