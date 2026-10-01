import { authenticateRequest, getJwtSecret, hashPassword } from "./_utils.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" }
});

export async function onRequestPost({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: "未绑定 D1 数据库" }, 500);

  try {
    const user = await authenticateRequest(request, getJwtSecret(env));
    if (!user || user.role !== "admin") {
      return json({ error: "仅管理员有权重置用户密码" }, 403);
    }

    const body = await request.json();
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const newPassword = typeof body.new_password === "string" ? body.new_password.trim() : "";
    if (!username || !newPassword) return json({ error: "用户名与新密码不能为空" }, 400);
    if (newPassword.length < 6) return json({ error: "新密码长度不能少于 6 位" }, 400);

    const target = await db.prepare("SELECT username FROM users WHERE username = ?")
      .bind(username)
      .first();
    if (!target) return json({ error: `用户 @${username} 不存在` }, 404);

    await db.prepare("UPDATE users SET password_hash = ? WHERE username = ?")
      .bind(await hashPassword(newPassword), username)
      .run();
    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
