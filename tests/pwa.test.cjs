'use strict';
// Kiểm tra PWA: build, cài service worker, chạy offline và tự cập nhật khi có bản mới.
// Set PLAYWRIGHT_MODULE to an existing Playwright installation if it isn't on NODE_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const site = fs.mkdtempSync(path.join(os.tmpdir(), 'khoang-doc-pwa-'));
const build = () => execFileSync(process.execPath, [path.join(root, 'scripts', 'build-pwa.cjs'), site], { encoding: 'utf8' }).match(/build (\w+)/)[1];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

(async () => {
  // 1. Manifest hợp lệ và mọi file trong PRECACHE (cùng icon của manifest) đều tồn tại.
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.display, 'standalone');
  assert.ok(manifest.start_url.startsWith('.') && manifest.scope.startsWith('.'), 'start_url/scope phải là đường dẫn tương đối');
  for (const icon of manifest.icons) assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src);
  assert.ok(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512' && i.purpose === 'maskable'));

  const id1 = build();
  const swText = () => fs.readFileSync(path.join(site, 'sw.js'), 'utf8');
  assert.ok(!swText().includes('__BUILD_ID__') && swText().includes(id1));
  assert.equal(build(), id1, 'cùng nội dung phải cho cùng build id');

  const server = http.createServer((req, res) => {
    const name = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.join(site, name);
    if (!file.startsWith(site) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'max-age=600' });
    res.end(fs.readFileSync(file));
  }).listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port + '/';

  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const controlled = () => page.evaluate(async () => { await navigator.serviceWorker.ready; return !!navigator.serviceWorker.controller; });
    const cacheNames = () => page.evaluate(async () => (await caches.keys()).sort());

    // 2. Lần đầu: service worker cài, precache đủ file, giành quyền điều khiển, không tải lại trang.
    await page.goto(origin);
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    assert.deepEqual(await cacheNames(), ['khoang-doc-' + id1]);
    const precached = (/const PRECACHE = \[([\s\S]*?)\];/.exec(swText())[1].match(/'[^']+'/g) || []).length;
    assert.equal(await page.evaluate(async () => (await (await caches.open((await caches.keys())[0])).keys()).length), precached + 1, 'precache gồm mọi file trong PRECACHE và gốc ./');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1);
    const link = await page.evaluate(() => document.querySelector('link[rel=manifest]').href);
    assert.equal(link, origin + 'manifest.webmanifest');

    // 3. Offline: tải lại vẫn chạy, bản nháp vẫn còn.
    await page.fill('#sourceText', 'Tiêu đề thử\n\nNội dung dùng để kiểm tra bản nháp offline.');
    await page.waitForTimeout(400);
    await context.setOffline(true);
    await page.reload();
    assert.ok((await page.inputValue('#sourceText')).includes('kiểm tra bản nháp offline'));
    await page.goto(origin + 'duong-dan-la-trong-pham-vi'); // điều hướng lạ khi offline → vẫn hiện app
    assert.ok(await page.locator('#sourceText').count(), 'đường dẫn lạ khi offline phải rơi về app');
    await page.goto(origin);
    await context.setOffline(false);

    // 4. Deploy bản mới: sửa một file rồi build lại → build id đổi.
    const appFile = path.join(root, 'app.js');
    const original = fs.readFileSync(appFile);
    let id2;
    try {
      fs.appendFileSync(appFile, '\n/* pwa-test-marker */\n');
      id2 = build();
    } finally { fs.writeFileSync(appFile, original); }
    assert.notEqual(id2, id1);

    // Trang đang hiển thị: cập nhật diễn ra nền, trang KHÔNG bị tải lại ngay mà hiện thông báo.
    await page.evaluate(() => { window.__stillHere = true; });
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
    await page.waitForFunction(() => /phiên bản mới/.test(document.getElementById('toast').textContent), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => window.__stillHere), true, 'không được tải lại khi trang còn hiển thị');
    for (let i = 0; i < 40 && (await cacheNames()).length > 1; i++) await page.waitForTimeout(250); // dọn cache cũ chạy sau controllerchange
    assert.deepEqual(await cacheNames(), ['khoang-doc-' + id2], 'cache cũ phải bị xóa');

    // Khi người dùng rời trang (ẩn), trang tự tải lại và dùng bản mới.
    const reloaded = page.waitForEvent('load');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await reloaded;
    assert.equal(await page.evaluate(() => window.__stillHere), undefined, 'trang phải được tải lại');
    assert.ok((await page.evaluate(() => fetch('app.js').then(r => r.text()))).includes('pwa-test-marker'), 'phải chạy bản mới');
    assert.ok((await page.inputValue('#sourceText')).includes('kiểm tra bản nháp offline'), 'bản nháp được giữ sau cập nhật');
    assert.equal(await controlled(), true);

    assert.deepEqual(errors, []);
    console.log('PWA OK: precache, offline, tự cập nhật (' + id1 + ' → ' + id2 + ')');
  } finally {
    await browser.close();
    server.close();
    fs.rmSync(site, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
