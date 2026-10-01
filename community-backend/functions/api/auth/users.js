import { authenticateRequest, getJwtSecret } from './_utils.js';
import { json, ensureContent, audit, clearContent, USER_FIELDS } from './_management.js';
export async function onRequestGet({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: '未绑定 D1 数据库' }, 500);
  try {
    const actor = await authenticateRequest(request, getJwtSecret(env), env);
    if (!actor || actor.role !== 'admin') return json({ error: '仅管理员可以访问用户中心' }, 403);
    await ensureContent(db);
    const url = new URL(request.url), username = url.searchParams.get('username');
    if (username) {
      const user = await db.prepare(`SELECT ${USER_FIELDS} FROM users u LEFT JOIN user_management m ON m.username = u.username WHERE u.username = ?`).bind(username).first();
      if (!user) return json({ error: '用户不存在' }, 404);
      const { results: feedbacks } = await db.prepare('SELECT id, content, image_url, created_at FROM feedbacks WHERE username = ? ORDER BY created_at DESC, id DESC').bind(username).all();
      if (url.searchParams.get('detail') !== 'true') return json(feedbacks || []);
      const { results: replies } = await db.prepare('SELECT id, feedback_id, content, created_at FROM replies WHERE username = ? ORDER BY created_at DESC, id DESC').bind(username).all();
      const { results: events } = await db.prepare('SELECT actor, action, created_at FROM admin_audit WHERE target = ? ORDER BY id DESC LIMIT 20').bind(username).all();
      return json({ user, feedbacks: feedbacks || [], replies: replies || [], events: events || [], capabilities: ['status', 'role', 'note', 'clear-content', 'delete'] });
    }
    const { results } = await db.prepare(`SELECT ${USER_FIELDS} FROM users u LEFT JOIN user_management m ON m.username = u.username ORDER BY u.created_at DESC, u.username ASC`).all();
    return json(results || []);
  } catch { return json({ error: '用户数据读取失败，请稍后重试' }, 500); }
}
export async function onRequestPost({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: '未绑定 D1 数据库' }, 500);
  try {
    const actor = await authenticateRequest(request, getJwtSecret(env), env);
    if (!actor || actor.role !== 'admin') return json({ error: '仅管理员可以管理用户' }, 403);
    const body = await request.json(), username = typeof body.username === 'string' ? body.username.trim() : '', action = body.action;
    if (!username || !['disable', 'enable', 'role', 'note', 'delete', 'clear-content'].includes(action)) return json({ error: '无效的管理操作' }, 400);
    const target = await db.prepare('SELECT username, role FROM users WHERE username = ?').bind(username).first();
    if (!target) return json({ error: '用户不存在' }, 404);
    if (username === actor.username && ['disable', 'delete', 'role'].includes(action)) return json({ error: '不能禁用、删除当前账号或修改自己的角色' }, 409);
    if (target.role === 'admin' && ['disable', 'delete'].includes(action)) return json({ error: '请先将该管理员调整为普通用户，再执行禁用或删除' }, 409);
    await ensureContent(db);
    let statements;
    if (action === 'role') {
      if (!['admin', 'user'].includes(body.role)) return json({ error: '无效的用户角色' }, 400);
      // Conditional SQL prevents concurrent demotions of the final admin.
      const result = await db.prepare(`UPDATE users SET role = ? WHERE username = ? AND (role != 'admin' OR ? = 'admin' OR (SELECT COUNT(*) FROM users u LEFT JOIN user_management m ON m.username = u.username WHERE u.role = 'admin' AND COALESCE(m.status, 'active') = 'active') > 1)`).bind(body.role, username, body.role).run();
      if (!result.meta?.changes) return json({ error: '不能撤销最后一位管理员的权限' }, 409);
      statements = [db.prepare('INSERT INTO user_management (username, session_version) VALUES (?, 1) ON CONFLICT(username) DO UPDATE SET session_version = session_version + 1').bind(username)];
    } else if (action === 'disable' || action === 'enable') {
      statements = [db.prepare('INSERT INTO user_management (username, status, session_version) VALUES (?, ?, 1) ON CONFLICT(username) DO UPDATE SET status = excluded.status, session_version = session_version + 1').bind(username, action === 'disable' ? 'disabled' : 'active')];
    } else if (action === 'note') {
      if (typeof body.note !== 'string' || body.note.length > 500) return json({ error: '备注最多 500 字' }, 400);
      statements = [db.prepare('INSERT INTO user_management (username, admin_note) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET admin_note = excluded.admin_note').bind(username, body.note.trim())];
    } else {
      statements = clearContent(db, username);
      if (action === 'delete') statements.push(db.prepare("INSERT INTO user_management (username, status, session_version) VALUES (?, 'deleted', 1) ON CONFLICT(username) DO UPDATE SET status = 'deleted', session_version = session_version + 1, admin_note = ''").bind(username), db.prepare("DELETE FROM users WHERE username = ? AND role != 'admin'").bind(username));
    }
    statements.push(audit(db, actor.username, username, action));
    await db.batch(statements);
    return json({ success: true });
  } catch { return json({ error: '管理操作失败，请刷新后重试' }, 500); }
}
