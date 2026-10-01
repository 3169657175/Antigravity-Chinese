export async function onRequest(context) {
  const db = context.env.DB;
  if (!db) {
    return new Response(JSON.stringify({ error: "D1 数据库绑定未激活" }), { status: 500 });
  }

  try {
    // 0. 自愈创建正确的 feedbacks 与 replies 表（带 s 复数）
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS feedbacks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        image_url TEXT,
        created_at INTEGER NOT NULL
      )
    `).run();

    await db.prepare(`
      CREATE TABLE IF NOT EXISTS replies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        feedback_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run();

    // 1. 清空已有的真实旧数据
    await db.prepare("DELETE FROM feedbacks").run();
    await db.prepare("DELETE FROM replies").run();

    // 2. 灌入 5 条带有汉化说明真实截图图片链接的展示帖子
    const posts = [
      {
        username: "niu1029",
        content: "📸 核心功能 1：菜单与设置项完全中文化。补丁包含系统菜单栏、托盘菜单、侧边设置项、新手向导提示以及窗口标题栏，提供完整的本土化视觉体验。",
        image_url: "https://github.com/user-attachments/assets/3758b0dd-8e85-47a4-bda4-0d921fa5b89f",
        created_at: Date.now() - 50000
      },
      {
        username: "niu1029",
        content: "📸 核心功能 2：左下角常驻智能额度看板。自动在侧边栏左下角直观集成 Gemini 和 Claude 额度配额小组件，随时掌控使用配额，活跃时 5s 心跳，闲置自动降频降阻抗。",
        image_url: "https://github.com/user-attachments/assets/24b8632f-1640-488e-b430-16027b4db58b",
        created_at: Date.now() - 40000
      },
      {
        username: "niu1029",
        content: "📸 核心功能 3：登录界面完全汉化。支持一键 Google 快捷登录，界面语言贴近国人习惯，扫除一切登录注册阻碍。",
        image_url: "https://github.com/user-attachments/assets/670b81e0-ec00-4d00-9adc-0a5a1f255ebe",
        created_at: Date.now() - 30000
      },
      {
        username: "niu1029",
        content: "📸 核心功能 4：多账号侧边栏极速切换。左下角常驻多账号下拉菜单，点击即可在一秒内重置证书并平滑热重启底层，独立账号切换极速无感。",
        image_url: "https://github.com/user-attachments/assets/b35ecaaa-3be5-42c2-97c7-770b9ef557f0",
        created_at: Date.now() - 20000
      },
      {
        username: "niu1029",
        content: "📸 核心功能 5：安全凭据一键清理与清除提示。自带安全验证弹窗，百分之百保障本地密钥证书不残留，防范任何隐私泄露风险。",
        image_url: "https://github.com/user-attachments/assets/c159a5d3-e53d-41d1-bbac-2ecf7c3b2176",
        created_at: Date.now() - 10000
      }
    ];

    for (const p of posts) {
      await db.prepare(
        "INSERT INTO feedbacks (username, content, image_url, created_at) VALUES (?, ?, ?, ?)"
      ).bind(p.username, p.content, p.image_url, p.created_at).run();
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "5 张说明书真实截图已成功写入官方 D1 数据库 feedbacks 表！" 
      }), 
      {
        headers: { "Content-Type": "application/json; charset=utf-8" }
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
