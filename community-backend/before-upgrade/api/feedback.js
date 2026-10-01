import { authenticateRequest, getJwtSecret } from "./auth/_utils.js";

// ==========================================
// 1. GET /api/feedback (联表读取留言及全部子回复)
// ==========================================
export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB || env.db;

  if (!db) {
    return new Response(JSON.stringify({ error: "未绑定 D1 数据库" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }

  // 解密获取当前的登录用户用户名 (如果没登录则留空)
  let currentUsername = "";
  try {
    const user = await authenticateRequest(request, getJwtSecret(env));
    if (user) {
      currentUsername = user.username;
    }
  } catch (e) {}

  try {
    // 1. D1 数据库架构自愈
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS feedbacks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL,
          content TEXT NOT NULL,
          image_url TEXT,
          created_at INTEGER NOT NULL
        )
      `).run();
    } catch (e) {}

    try {
      await db.prepare("ALTER TABLE feedbacks ADD COLUMN image_url TEXT").run();
    } catch (e) {}

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS feedback_likes (
        username TEXT NOT NULL,
        feedback_id INTEGER NOT NULL,
        PRIMARY KEY (username, feedback_id)
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS reply_likes (
        username TEXT NOT NULL,
        reply_id INTEGER NOT NULL,
        PRIMARY KEY (username, reply_id)
      )
    `).run();

    // 2. 联合查询反馈主帖子：高优先级按点赞数量降序排序，点赞数量一样按创建时间降序排序
    const { results: feedbacks } = await db.prepare(`
      SELECT 
        f.id, 
        f.username, 
        f.content, 
        f.image_url, 
        f.created_at,
        (SELECT COUNT(*) FROM feedback_likes WHERE feedback_id = f.id) as likes_count,
        (SELECT COUNT(*) FROM feedback_likes WHERE feedback_id = f.id AND username = ?) as has_liked
      FROM feedbacks f
      ORDER BY likes_count DESC, f.created_at DESC
      LIMIT 50
    `).bind(currentUsername).all();

    if (feedbacks.length === 0) {
      return new Response(JSON.stringify([]), {
        headers: { "Content-Type": "application/json;charset=utf-8" }
      });
    }

    // 3. 联合检索二级回复：支持回复点赞与高赞置顶排序 (点赞降序，时间升序)
    const feedbackIds = feedbacks.map(f => f.id).join(',');
    const { results: allReplies } = await db.prepare(`
      SELECT 
        r.id, 
        r.feedback_id, 
        r.username, 
        r.content, 
        r.created_at,
        (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r.id) as likes_count,
        (SELECT COUNT(*) FROM reply_likes WHERE reply_id = r.id AND username = ?) as has_liked
      FROM replies r 
      WHERE r.feedback_id IN (${feedbackIds})
      ORDER BY likes_count DESC, r.created_at ASC
    `).bind(currentUsername).all();

    // 4. 将子回复嵌套拼装
    const mergedList = feedbacks.map(fb => {
      return {
        ...fb,
        replies: allReplies.filter(r => r.feedback_id === fb.id)
      };
    });

    return new Response(JSON.stringify(mergedList), {
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        "Cache-Control": "no-cache"
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ==========================================
// 2. POST /api/feedback (安全提交留言，自动绑定登录人)
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

  // 身份鉴权验证 JWT
  const user = await authenticateRequest(request, getJwtSecret(env));
  if (!user) {
    return new Response(JSON.stringify({ error: "登录会话已过期，请重新登录账号后再发帖" }), {
      status: 401,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { content, image_url } = await request.json();

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ error: "反馈内容不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 再次执行自愈，确保建列无误
    try {
      await db.prepare("ALTER TABLE feedbacks ADD COLUMN image_url TEXT").run();
    } catch (e) {}

    // 将经 JWT 验签的真实登录名 user.username 写入 D1，彻底根除冒充他人
    await db.prepare("INSERT INTO feedbacks (username, content, image_url, created_at) VALUES (?, ?, ?, ?)")
      .bind(user.username, content.trim().slice(0, 500), image_url ? image_url.trim() : null, Date.now())
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
// 3. DELETE /api/feedback (级联物理删除留言与所有回复，限管理员)
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
    const feedbackId = url.searchParams.get("id");

    if (!feedbackId) {
      return new Response(JSON.stringify({ error: "参数不全：缺失要删除的留言ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 查出留言的作者以判断权限
    const post = await db.prepare("SELECT username FROM feedbacks WHERE id = ?").bind(feedbackId).first();
    if (!post) {
      return new Response(JSON.stringify({ error: "要删除的留言不存在" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 3. 管理员 或 作者本人 均有删除权
    if (user.role !== "admin" && user.username !== post.username) {
      return new Response(JSON.stringify({ error: "操作被拒绝：您无权删除他人发表的反馈。" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 4. 级联执行物理删除
    await db.prepare("DELETE FROM feedbacks WHERE id = ?").bind(feedbackId).run();
    await db.prepare("DELETE FROM replies WHERE feedback_id = ?").bind(feedbackId).run();

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
