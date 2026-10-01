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
  const user = await authenticateRequest(request, getJwtSecret(env));
  if (!user) {
    return new Response(JSON.stringify({ error: "登录会话已过期，请重新登录账号后再进行回复" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { feedback_id, content } = await request.json();

    if (!feedback_id || !content || !content.trim()) {
      return new Response(JSON.stringify({ error: "参数不全：回复内容及目标留言ID不能为空" }), {
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
        created_at INTEGER NOT NULL
      )
    `).run();

    // 3. 将回复写入表，绑定 JWT 实名身份
    await db.prepare("INSERT INTO replies (feedback_id, username, content, created_at) VALUES (?, ?, ?, ?)")
      .bind(feedback_id, user.username, content.trim().slice(0, 500), Date.now())
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
  const user = await authenticateRequest(request, getJwtSecret(env));
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
    await db.prepare("DELETE FROM replies WHERE id = ?").bind(replyId).run();

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
