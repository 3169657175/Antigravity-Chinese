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

    const user = await db.prepare(
      "SELECT username, password_hash, role FROM users WHERE username = ?"
    ).bind(username).first();
    if (!user) return json({ error: "账号或密码错误" }, 400);

    const passwordCheck = await verifyPassword(password, user.password_hash);
    if (!passwordCheck.valid) return json({ error: "账号或密码错误" }, 400);

    if (passwordCheck.needsRehash) {
      const upgradedHash = await hashPassword(password);
      await db.prepare("UPDATE users SET password_hash = ? WHERE username = ?")
        .bind(upgradedHash, user.username)
        .run();
    }

    const token = await generateJWT({
      username: user.username,
      role: user.role
    }, jwtSecret);
    return json({ success: true, token, username: user.username, role: user.role });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
