import { ensureManagement } from './_management.js';
import { generateJWT, getJwtSecret, hashPassword, verifyPassword } from "./_utils.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" }
});

export async function onRequestPost({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: "未绑定 D1 数据库" }, 500);

  try {
    const jwtSecret = getJwtSecret(env);
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!username || !password) return json({ error: "账号和密码不能为空" }, 400);

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at INTEGER NOT NULL
      )
    `).run();

    await ensureManagement(db);
    const user = await db.prepare(
      "SELECT u.username, u.password_hash, u.role, COALESCE(m.status, 'active') AS status, COALESCE(m.session_version, 0) AS session_version FROM users u LEFT JOIN user_management m ON m.username = u.username WHERE u.username = ?"
    ).bind(username).first();
    if (!user) return json({ error: "账号或密码错误" }, 400);

    const passwordCheck = await verifyPassword(password, user.password_hash);
    if (!passwordCheck.valid) return json({ error: "账号或密码错误" }, 400);

    if (user.status !== "active") return json({ error: "账号已禁用，请联系管理员" }, 403);

    if (passwordCheck.needsRehash) {
      const upgradedHash = await hashPassword(password);
      await db.prepare("UPDATE users SET password_hash = ? WHERE username = ?")
        .bind(upgradedHash, user.username)
        .run();
    }

    await db.prepare('INSERT INTO user_management (username, last_login_at) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET last_login_at = excluded.last_login_at').bind(user.username, Date.now()).run();
    const token = await generateJWT({
      username: user.username,
      role: user.role,
      session_version: Number(user.session_version) || 0
    }, jwtSecret);
    return json({ success: true, token, username: user.username, role: user.role });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
