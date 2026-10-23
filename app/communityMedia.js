(function exposeCommunityMedia(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.AgyCommunityMedia = api;
})(typeof window !== 'undefined' ? window : globalThis, function createCommunityMedia() {
  const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

  function validateImageFile(file) {
    if (!file || typeof file.arrayBuffer !== 'function') return { ok: false, error: '没有可用的图片内容' };
    if (!ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) return { ok: false, error: '只支持 PNG、JPG、GIF 或 WebP 图片' };
    if (!Number.isFinite(file.size) || file.size <= 0) return { ok: false, error: '图片内容为空' };
    if (file.size > MAX_IMAGE_BYTES) return { ok: false, error: '图片不能超过 8MB' };
    return { ok: true };
  }

  function imageFromClipboardEvent(event) {
    const items = Array.from(event?.clipboardData?.items || []);
    const item = items.find(entry => entry.kind === 'file' && String(entry.type || '').startsWith('image/'));
    return item?.getAsFile?.() || null;
  }

  async function upload(file, api, context) {
    const validation = validateImageFile(file);
    if (!validation.ok) return { success: false, code: 'INVALID_IMAGE', error: validation.error };
    const bytes = new Uint8Array(await file.arrayBuffer());
    return api.uploadImageData(bytes, file.name || `clipboard-${Date.now()}.png`, context);
  }

  function avatarInitial(name) {
    return String(name || '?').trim().charAt(0).toUpperCase() || '?';
  }

  return { MAX_IMAGE_BYTES, validateImageFile, imageFromClipboardEvent, upload, avatarInitial };
});
