import { authenticateRequest, getJwtSecret } from "./auth/_utils.js";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif"
};

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" }
});

export async function onRequestPost({ request, env }) {
  const images = env.IMAGES || env.images;
  if (!images) return json({ error: "未绑定 R2 图片存储桶" }, 500);

  try {
    const user = await authenticateRequest(request, getJwtSecret(env));
    if (!user) return json({ error: "请先登录后再上传图片" }, 401);

    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ error: "没有选择上传文件" }, 400);
    }

    const extension = ALLOWED_IMAGE_TYPES[file.type];
    if (!extension) return json({ error: "仅允许 JPG、PNG、WebP 或 GIF 图片" }, 400);
    if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
      return json({ error: "图片大小必须在 1 字节到 5MB 之间" }, 400);
    }

    const objectKey = `${crypto.randomUUID()}.${extension}`;
    await images.put(objectKey, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type }
    });

    const publicUrlPrefix = "https://pub-8a91b6e9bc6246279bd3d001f8f137b8.r2.dev";
    return json({ url: `${publicUrlPrefix}/${objectKey}` });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}
