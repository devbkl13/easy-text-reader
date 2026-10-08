'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
// Generate font data from checked-in local WOFF2 files; never download at build time.
require('./build-fonts.cjs');
// Re-embed the supplied sample so both entry points always have the same example.
fs.writeFileSync(path.join(root, 'sample.js'), 'window.SAMPLE_TEXT = ' + JSON.stringify(read('sample.txt')) + ';\n');
let html = read('index.html').replace('  <link rel="stylesheet" href="styles.css">', () => '  <style>\n' + read('styles.css') + '\n</style>');
html = html.replace(/^  <script defer src="(?:fonts|sample|formatter|app|pwa)\.js"><\/script>\r?\n/gm, '');
// PWA chỉ có ý nghĩa khi phục vụ qua http(s); bản một file mở bằng file:// không cần các thẻ này.
html = html.replace(/^  <(?:link rel="(?:manifest|apple-touch-icon)"|meta name="apple-mobile-web-app-[a-z-]+")[^\n]*\r?\n/gm, '');
const scripts = ['fonts.js', 'sample.js', 'formatter.js', 'app.js'].map(file => '<script>\n' + read(file).replace(/<\/script/gi, '<\\/script') + '\n</script>').join('\n');
html = html.replace('</body>', () => scripts + '\n</body>');
fs.writeFileSync(path.join(root, 'easy-text-reader-standalone.html'), html);
console.log('Đã tạo easy-text-reader-standalone.html — một tệp, mở trực tiếp, không cần server.');
