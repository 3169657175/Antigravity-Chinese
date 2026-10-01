import { hashPassword } from "./_utils.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" }
});

export async function onRequestPost({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: "未绑定 D1 数据库" }, 500);

  try {
    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    if (!username || !password) return json({ error: "账号和密码不能为空" }, 400);
    if (username.length < 3 || username.length > 20) {
      return json({ error: "账号长度必须在 3 到 20 个字符之间" }, 400);
    }
    if (password.length < 6) return json({ error: "密码长度不能少于 6 位" }, 400);

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at INTEGER NOT NULL
      )
    `).run();

    const existing = await db.prepare("SELECT username FROM users WHERE username = ?")
      .bind(username)
      .first();
    if (existing) return json({ error: "该账号已被注册，请直接登录" }, 400);

    const passwordHash = await hashPassword(password);
    await db.prepare(
      "INSERT INTO users (username, password_hash, role, created_at) VALUES (?, ?, 'user', ?)"
    ).bind(username, passwordHash, Date.now()).run();
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
