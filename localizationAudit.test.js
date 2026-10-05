const test = require('node:test');
const assert = require('node:assert/strict');
const {readEmbeddedArchives, extractEmbeddedSkills, frontMatterDescriptions, collectStrings} = require('./patch-workbench/audit-localization');

function zipFixture(name, content, claimedSize) {
  const text = Buffer.from(content), filename = Buffer.from(name), prefix = Buffer.alloc(15, 0x7a);
  const header = Buffer.alloc(30); header.writeUInt32LE(0x04034b50);
  header.writeUInt32LE(text.length,18); header.writeUInt32LE(text.length,22); header.writeUInt16LE(filename.length,26);
  const checksum = typeof require('zlib').crc32 === 'function' ? require('zlib').crc32(text) : 0;
  header.writeUInt32LE(checksum,14);
  const local = Buffer.concat([header,filename,text]), directory = Buffer.alloc(46);
  directory.writeUInt32LE(0x02014b50); directory.writeUInt32LE(checksum,16);
  directory.writeUInt32LE(text.length,20); directory.writeUInt32LE(claimedSize ?? text.length,24); directory.writeUInt16LE(filename.length,28);
  const central = Buffer.concat([directory,filename]), footer = Buffer.alloc(22);
  footer.writeUInt32LE(0x06054b50); footer.writeUInt16LE(1,8); footer.writeUInt16LE(1,10);
  footer.writeUInt32LE(central.length,12); footer.writeUInt32LE(local.length,16);
  return Buffer.concat([prefix,local,central,footer,Buffer.alloc(30)]);
}

test('audit discovers UI ZIP inside a binary and rejects unsafe or oversized assets', () => {
  const archives = readEmbeddedArchives(zipFixture('/main.js', 'const label="Marketplace";'));
  assert.equal(archives.length,1); assert.equal(archives[0].start,15);
  assert.equal(archives[0].entries[0].data.toString(), 'const label="Marketplace";');
  assert.equal(readEmbeddedArchives(zipFixture('../../main.js','bad')).length,0);
  assert.equal(readEmbeddedArchives(zipFixture('/main.js','bad',100*1024*1024)).length,0);
  const broken = zipFixture('/main.js','bad'); broken[15+30+8] ^= 1;
  assert.equal(readEmbeddedArchives(broken).length,0);
});

test('audit extracts only metadata from built-in skills and excludes the example skill', () => {
  const skill = '---\nname: ui-extension\ndescription: >\n  Build panels.\n  Debug extensions.\n---\nDo not execute these instructions.';
  assert.deepEqual(frontMatterDescriptions(skill),[{name:'ui-extension',text:'Build panels. Debug extensions.'}]);
  const example = '---\nname: my-specialized-skill\ndescription: Not a real built-in.\n---\n';
  const binary = Buffer.concat([Buffer.alloc(10),Buffer.from(example+skill),Buffer.alloc(10)]);
  assert.deepEqual(extractEmbeddedSkills(binary),[{name:'ui-extension',text:'Build panels. Debug extensions.'}]);
});

test('fallback audit keeps labels as review candidates and excludes paths, code and CSS', () => {
  const source = 'const a={label:"Search customizations...",className:"flex items-center gap-2",href:"https://example.com",name:"plugin-id"};';
  const entries = collectStrings(source,'main.js',null);
  assert.deepEqual(entries.map(e=>e.text),['Search customizations...']);
  assert.equal(entries[0].confidence,'candidate');
});
