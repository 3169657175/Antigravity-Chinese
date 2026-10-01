import { authenticateRequest, getJwtSecret } from "./auth/_utils.js";

// ==========================================
// 1. GET /api/announcement (获取公告，支持 ?all=true 获取历史全部)
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

  const url = new URL(request.url);
  const all = url.searchParams.get("all") === "true";

  try {
    // 数据库表自愈
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();

    let announcement;
    if (all) {
      // 查出所有公告
      announcement = await db.prepare(
        "SELECT id, content, image_url, created_at FROM announcements ORDER BY id DESC"
      ).all();
      return new Response(JSON.stringify(announcement.results || []), {
        headers: { 
          "Content-Type": "application/json;charset=utf-8",
          "Cache-Control": "no-cache"
        }
      });
    } else {
      // 查出最新的一条公告
      announcement = await db.prepare(
        "SELECT id, content, image_url, created_at FROM announcements ORDER BY id DESC LIMIT 1"
      ).first();
      return new Response(JSON.stringify(announcement || null), {
        headers: { 
          "Content-Type": "application/json;charset=utf-8",
          "Cache-Control": "no-cache"
        }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ==========================================
// 2. POST /api/announcement (发布或编辑公告，限管理员)
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

  // 1. 登录会话与管理员身份鉴权
  const user = await authenticateRequest(request, getJwtSecret(env));
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "操作被拒绝：您无权发布或修改公告。" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const { id, content, image_url } = await request.json();

    if (!content || !content.trim()) {
      return new Response(JSON.stringify({ error: "公告内容不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (id) {
      // 执行 UPDATE 编辑更新
      await db.prepare("UPDATE announcements SET content = ?, image_url = ? WHERE id = ?")
        .bind(content.trim(), image_url ? image_url.trim() : null, id)
        .run();
      return new Response(JSON.stringify({ success: true, updated: true }), {
        headers: { "Content-Type": "application/json" }
      });
    } else {
      // 执行 INSERT 插入新公告
      await db.prepare("INSERT INTO announcements (content, image_url, created_at) VALUES (?, ?, ?)")
        .bind(content.trim(), image_url ? image_url.trim() : null, Date.now())
        .run();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ==========================================
// 3. DELETE /api/announcement (物理删除公告，限管理员)
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

  // 1. 登录会话与管理员身份鉴权
  const user = await authenticateRequest(request, getJwtSecret(env));
  if (!user || user.role !== "admin") {
    return new Response(JSON.stringify({ error: "操作被拒绝：您无权删除公告。" }), {
      status: 403,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return new Response(JSON.stringify({ error: "请提供目标公告的 ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. 物理删除
    await db.prepare("DELETE FROM announcements WHERE id = ?")
      .bind(parseInt(id))
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
