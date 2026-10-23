const test = require('node:test');
const assert = require('node:assert/strict');
const { detectImageMime, MAX_IMAGE_BYTES } = require('../../communityIpc');
const media = require('../../communityMedia');

test('community upload validates image signatures rather than trusting extensions', () => {
  assert.equal(detectImageMime(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])), 'image/png');
  assert.equal(detectImageMime(Buffer.from([0xff,0xd8,0xff,0x00])), 'image/jpeg');
  assert.equal(detectImageMime(Buffer.from('GIF89a', 'ascii')), 'image/gif');
  assert.equal(detectImageMime(Buffer.from('RIFFxxxxWEBP', 'ascii')), 'image/webp');
  assert.equal(detectImageMime(Buffer.from('<script>alert(1)</script>')), '');
  assert.equal(media.MAX_IMAGE_BYTES, MAX_IMAGE_BYTES);
});

test('clipboard helper accepts only pasted image files', () => {
  const image = { name: 'paste.png' };
  assert.equal(media.imageFromClipboardEvent({ clipboardData: { items: [
    { kind: 'string', type: 'text/plain', getAsFile: () => null },
    { kind: 'file', type: 'image/png', getAsFile: () => image }
  ] } }), image);
  assert.equal(media.imageFromClipboardEvent({ clipboardData: { items: [] } }), null);
});
