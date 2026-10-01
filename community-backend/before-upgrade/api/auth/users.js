import { authenticateRequest, getJwtSecret } from "./_utils.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json;charset=utf-8",
    "Cache-Control": "no-store"
  }
});

export async function onRequestGet({ request, env }) {
  const db = env.DB || env.db;
  if (!db) return json({ error: "未绑定 D1 数据库" }, 500);

  try {
    const user = await authenticateRequest(request, getJwtSecret(env));
    if (!user || user.role !== "admin") return json({ error: "仅管理员可以访问用户中心" }, 403);

    const targetUsername = new URL(request.url).searchParams.get("username");
    if (targetUsername) {
      const { results } = await db.prepare(
        "SELECT id, content, image_url, created_at FROM feedbacks WHERE username = ? ORDER BY id DESC"
      ).bind(targetUsername).all();
      return json(results || []);
    }

    const { results } = await db.prepare(`
      SELECT
        u.username,
        u.role,
        u.created_at,
        (SELECT COUNT(*) FROM feedbacks f WHERE f.username = u.username) AS feedback_count
      FROM users u
      ORDER BY u.created_at DESC
    `).all();
    return json(results || []);
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
