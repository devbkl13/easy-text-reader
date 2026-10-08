'use strict';
// Đóng gói site để deploy: node scripts/build-pwa.cjs [thư-mục-đầu-ra]   (mặc định: _site)
// Chép các file trong PRECACHE của sw.js và gắn BUILD_ID = mã băm nội dung vào sw.js.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.join(__dirname, '..');
const out = path.resolve(process.argv[2] || path.join(root, '_site'));
const EXTRA = ['easy-text-reader-standalone.html'];

const template = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const list = /const PRECACHE = \[([\s\S]*?)\];/.exec(template);
if (!list) throw new Error('Không tìm thấy PRECACHE trong sw.js');
const precache = [...list[1].matchAll(/'([^']+)'/g)].map(match => match[1]);
if (!precache.length || !template.includes("'__BUILD_ID__'")) throw new Error('sw.js thiếu PRECACHE hoặc BUILD_ID');

const hash = crypto.createHash('sha256');
hash.update(template);
for (const file of precache) hash.update(file + '\0').update(fs.readFileSync(path.join(root, file)));
const buildId = hash.digest('hex').slice(0, 12);

fs.rmSync(out, { recursive: true, force: true });
for (const file of [...precache, ...EXTRA]) {
  fs.mkdirSync(path.dirname(path.join(out, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(out, file));
}
fs.writeFileSync(path.join(out, 'sw.js'), template.replace("'__BUILD_ID__'", "'" + buildId + "'"));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log('Đã tạo ' + out + ' (' + (precache.length + EXTRA.length + 1) + ' file, build ' + buildId + ')');
