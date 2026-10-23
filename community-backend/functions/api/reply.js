import { authenticateRequest, getJwtSecret } from "./auth/_utils.js";

// ==========================================
// 1. POST /api/reply (发表留言回复)
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

  // 1. 登录会话校验
  const user = await authenticateRequest(request, getJwtSecret(env), env);
  if (!user) {
    return new Response(JSON.stringify({ error: "登录会话已过期，请重新登录账号后再进行回复" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { feedback_id, content, image_url } = await request.json();
    const cleanContent = typeof content === 'string' ? content.trim().slice(0, 500) : '';
    const cleanImageUrl = typeof image_url === 'string' ? image_url.trim().slice(0, 2000) : '';

    if (!feedback_id || (!cleanContent && !cleanImageUrl)) {
      return new Response(JSON.stringify({ error: "回复文字和图片至少需要填写一项" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 自愈创建 replies 数据表
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();
    try { await db.prepare("ALTER TABLE replies ADD COLUMN image_url TEXT").run(); } catch (e) {}

    // 3. 将回复写入表，绑定 JWT 实名身份
    await db.prepare("INSERT INTO replies (feedback_id, username, content, image_url, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(feedback_id, user.username, cleanContent, cleanImageUrl, Date.now())
      .run();

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ==========================================
// 2. DELETE /api/reply (删除子回复，限管理员)
// ==========================================
export async function onRequestDelete(context) {
  const { request, env } = context;
  const db = env.DB || env.db;

  if (!db) {
    return new Response(JSON.stringify({ error: "未绑定 D1 数据库" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 1. 登录会话身份鉴权
  const user = await authenticateRequest(request, getJwtSecret(env), env);
  if (!user) {
    return new Response(JSON.stringify({ error: "登录会话已失效，请重新登录" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(request.url);
    const replyId = url.searchParams.get("id");

    if (!replyId) {
      return new Response(JSON.stringify({ error: "参数不全：缺失要删除的回复ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 查出回复的作者以判断权限
    const reply = await db.prepare("SELECT username FROM replies WHERE id = ?").bind(replyId).first();
    if (!reply) {
      return new Response(JSON.stringify({ error: "要删除的回复不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. 管理员 或 作者本人 均有删除权
    if (user.role !== "admin" && user.username !== reply.username) {
      return new Response(JSON.stringify({ error: "操作被拒绝：您无权删除他人发表的回复。" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. 执行删除
    await db.batch([
      db.prepare('DELETE FROM reply_likes WHERE reply_id = ?').bind(replyId),
      db.prepare('DELETE FROM replies WHERE id = ?').bind(replyId)
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
