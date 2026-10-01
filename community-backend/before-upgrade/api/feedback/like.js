import { authenticateRequest, getJwtSecret } from "../auth/_utils.js";

// ==========================================
// POST /api/feedback/like (主留言双向点赞切换，限登录用户)
// ==========================================
export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB || env.db;

  if (!db) {
    return new Response(JSON.stringify({ error: "未绑定 D1 数据库" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 1. 鉴权，只有登录的极客才能点赞
  const user = await authenticateRequest(request, getJwtSecret(env));
  if (!user) {
    return new Response(JSON.stringify({ error: "🔒 请先登录您的极客账号后再进行点赞操作！" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { feedback_id } = await request.json();
    if (!feedback_id) {
      return new Response(JSON.stringify({ error: "缺少 feedback_id 参数" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 双自愈检查，建 Likes 关联表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_likes (
        username TEXT NOT NULL,
        feedback_id INTEGER NOT NULL,
        PRIMARY KEY (username, feedback_id)
      )
    `).run();

    // 3. 校验此用户先前是否已经赞过此帖
    const hasLiked = await db.prepare(
      "SELECT 1 FROM feedback_likes WHERE username = ? AND feedback_id = ?"
    ).bind(user.username, feedback_id).first();

    let liked = false;
    if (hasLiked) {
      // 取消赞 (Toggle Off)
      await db.prepare("DELETE FROM feedback_likes WHERE username = ? AND feedback_id = ?")
        .bind(user.username, feedback_id)
        .run();
      liked = false;
    } else {
      // 进行赞 (Toggle On)
      await db.prepare("INSERT INTO feedback_likes (username, feedback_id) VALUES (?, ?)")
        .bind(user.username, feedback_id)
        .run();
      liked = true;
    }

    // 4. 统计最新的点赞总数返回给前端，供前端零时局部刷新，增强响应感受
    const countRow = await db.prepare(
      "SELECT COUNT(*) as likes_count FROM feedback_likes WHERE feedback_id = ?"
    ).bind(feedback_id).first();

    return new Response(JSON.stringify({
      success: true,
      liked,
      likes_count: countRow ? countRow.likes_count : 0
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
