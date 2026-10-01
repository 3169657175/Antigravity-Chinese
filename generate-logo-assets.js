const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const path = require('path');

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  const entries = Buffer.alloc(images.length * 16);
  let offset = 6 + entries.length;
  images.forEach(({ size, buffer }, index) => {
    const entry = index * 16;
    entries.writeUInt8(size >= 256 ? 0 : size, entry);
    entries.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    entries.writeUInt8(0, entry + 2);
    entries.writeUInt8(0, entry + 3);
    entries.writeUInt16LE(1, entry + 4);
    entries.writeUInt16LE(32, entry + 6);
    entries.writeUInt32LE(buffer.length, entry + 8);
    entries.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });
  return Buffer.concat([header, entries, ...images.map(item => item.buffer)]);
}

app.whenReady().then(async () => {
  const assets = path.join(__dirname, 'assets');
  const window = new BrowserWindow({ width: 512, height: 512, show: false, frame: false, transparent: true, webPreferences: { backgroundThrottling: false } });
  await window.loadFile(path.join(assets, 'logo.svg'));
  const source = await window.webContents.capturePage({ x: 0, y: 0, width: 512, height: 512 });
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const rendered = sizes.map(size => {
    const buffer = nativeImage.createFromBuffer(source.toPNG()).resize({ width: size, height: size, quality: 'best' }).toPNG();
    fs.writeFileSync(path.join(assets, `logo-${size}.png`), buffer);
    return { size, buffer };
  });
  fs.writeFileSync(path.join(assets, 'icon.ico'), buildIco(rendered.filter(item => item.size !== 512)));
  window.destroy();
  app.quit();
}).catch(error => {
  console.error(error);
  app.exit(1);
});
