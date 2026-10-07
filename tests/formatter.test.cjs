'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../formatter.js');
const sample = fs.readFileSync(path.join(__dirname, '../sample.txt'), 'utf8');
const prose = 'Đây là một đoạn giải thích đủ dài để cung cấp ngữ cảnh cho tiêu đề ở ngay phía trước. Các câu trong đoạn này giúp phân biệt một đề mục của bài viết với một danh sách ngắn thông thường.';
const compact = text => text.replace(/\s+/gu, ' ').trim();

test('sample: four headings, one list, one callout; original wording and numbers survive', () => {
  const parsed = F.parse(sample);
  assert.equal(parsed.stats.headings, 4);
  assert.equal(parsed.stats.lists, 1);
  assert.equal(parsed.blocks.find(b => b.type === 'list').items.length, 2);
  assert.equal(parsed.blocks.filter(b => b.type === 'callout').length, 1);
  assert.ok(parsed.stats.splits > 0);
  const restored = parsed.blocks.map(block => block.type === 'heading' ? block.marker + ' ' + block.text : block.type === 'list' ? block.items.map(item => item.marker + ' ' + item.text).join('\n') : block.text).join('\n');
  assert.equal(compact(restored), compact(sample));
});
test('consecutive numbered items stay a list even before a long paragraph', () => {
  const blocks = F.parse('1. Mở ứng dụng\n2. Dán văn bản\n3. Bắt đầu đọc\n' + prose).blocks;
  assert.equal(blocks[0].type, 'list'); assert.equal(blocks[0].items.length, 3);
  assert.equal(blocks[1].type, 'paragraph');
});
test('numbered section with context is a heading', () => {
  const blocks = F.parse('1. Khi nào cần workflow?\n' + prose).blocks;
  assert.equal(blocks[0].type, 'heading'); assert.equal(blocks[0].number, '1');
});
test('social-media emoji bullets and section labels adapt to context', () => {
  const bullets = F.parse('✅ Đọc bài viết\n👉 Ghi lại điều đáng nhớ\n🔹 Thử áp dụng').blocks;
  assert.equal(bullets.length, 1); assert.equal(bullets[0].items.length, 3);
  assert.ok(F.renderBlock(bullets[0]).includes('✅'));
  for (const label of ['PHẦN 1: Bắt đầu', 'Bước 2 — Kiểm tra', 'II. Một chủ đề', '1️⃣ Một chủ đề', '📌 NHỮNG ĐIỀU CẦN NHỚ']) {
    assert.equal(F.parse(label + '\n' + prose).blocks[0].type, 'heading', label);
  }
});
test('list ordinals, alphabetic labels and styled numeric headings are preserved', () => {
  const numeric = F.parse('2. Mục thứ hai\n5. Mục thứ năm').blocks[0];
  assert.ok(F.renderBlock(numeric).includes('value="5"'));
  const alpha = F.parse('b) Mục B\nc) Mục C').blocks[0];
  assert.ok(F.renderBlock(alpha).includes('type="a" start="2"'));
  const styled = F.parse('𝟏. Chủ đề\n' + prose).blocks[0];
  assert.equal(styled.marker, '𝟏.'); assert.equal(styled.text, 'Chủ đề');
});
test('dates, decimals, versions and ranges remain literal text', () => {
  const text = '07.10.2026 là ngày ghi chú.\n3.14 là số pi gần đúng.\nv2.1.0 là phiên bản đang dùng.\n2024-2026 là khoảng năm.';
  const blocks = F.parse(text).blocks;
  assert.ok(blocks.every(block => block.type === 'paragraph'));
  assert.equal(compact(blocks.map(b => b.text).join('\n')), compact(text));
});
test('Markdown: title, subheading, fenced code, quote, task list', () => {
  const parsed = F.parse('# Tiêu đề\n\n### Mục nhỏ\n\n```js\n  const x = "<script>";\n```\n\n> Trích dẫn\n> Dòng kế tiếp\n\n- [x] Đã đọc\n- [ ] Chưa đọc');
  assert.equal(parsed.inferredTitle, 'Tiêu đề');
  assert.deepEqual(parsed.blocks.map(b => b.type), ['title', 'heading', 'code', 'quote', 'list']);
  assert.equal(parsed.blocks[2].text, '  const x = "<script>";');
  assert.equal(parsed.blocks[4].items[0].checked, true);
  assert.equal(parsed.blocks[4].items[1].checked, false);
});
test('unclosed fenced code is preserved to end of input', () => {
  const blocks = F.parse('```\nlet a = 1;\n\n  literal').blocks;
  assert.equal(blocks.length, 1); assert.equal(blocks[0].text, 'let a = 1;\n\n  literal');
});
test('conservative mode avoids speculative uppercase headings and callouts', () => {
  const text = 'NHỮNG ĐIỀU CẦN NHỚ\n\n' + prose + '\n\nLưu ý: Điều này đáng để đọc kỹ.';
  assert.ok(F.parse(text).blocks.some(b => b.type === 'heading'));
  assert.ok(F.parse(text, { mode: 'conservative' }).blocks.every(b => b.type === 'paragraph'));
});
test('setext title, isolated heading and Unicode styled heading are recognized', () => {
  assert.equal(F.parse('Tiêu đề bài viết\n===\n' + prose).inferredTitle, 'Tiêu đề bài viết');
  assert.equal(F.parse('Một chủ đề mới\n\n' + prose).inferredTitle, 'Một chủ đề mới');
  const styled = '𝗔𝗚𝗘𝗡𝗧 𝗠𝗘𝗠𝗢𝗥𝗬';
  assert.equal(F.parse(styled + '\n' + prose).blocks[0].text, styled);
  assert.equal(F.parse(styled + '\n' + prose).blocks[0].type, 'heading');
});
test('poetry keeps line breaks; wrapped prose joins without changing words', () => {
  const poem = 'Một khoảng trời xanh\nMột ngày thật nhẹ\nMột người thong thả';
  assert.equal(F.parse(poem).blocks[0].type, 'verse');
  assert.equal(F.parse(poem).blocks[0].text, poem);
  const wrapped = 'Đây là một câu văn được ngắt giữa dòng vì giới hạn\nchiều rộng của công cụ xuất văn bản cũ và không phải\nmột đoạn thơ hay một danh sách cần được giữ xuống dòng.';
  assert.equal(F.parse(wrapped).blocks.length, 1);
  assert.equal(F.parse(wrapped).blocks[0].text, compact(wrapped));
});
test('long paragraphs split only at sentence boundaries, never inside abbreviations', () => {
  const text = ('TS. Nguyễn làm việc ở TP. Hồ Chí Minh, dùng v2.1 và kết quả 3.14. ' + prose + ' ').repeat(5).trim();
  const chunks = F.splitLong(text, true);
  assert.ok(chunks.length > 1); assert.equal(compact(chunks.join(' ')), compact(text));
  assert.ok(chunks.every(chunk => !/\b(?:TS|TP)\.$/u.test(chunk)));
  assert.deepEqual(F.splitLong(text, false), [text]);
});
test('quotes are not split halfway through quoted text', () => {
  const text = 'Anh nói “Đây là câu thứ nhất. Đây vẫn là lời trích dẫn.” Sau đó là lời giải thích. Một câu mới.';
  const parts = F.sentences(text);
  assert.ok(parts[0].includes('Đây vẫn là lời trích dẫn.'));
  assert.equal(compact(parts.join(' ')), compact(text));
});
test('HTML, event handlers and JavaScript links cannot become executable markup', () => {
  const html = F.inline('<img src=x onerror=alert(1)> **đậm** [x](javascript:alert(1)) <script>alert(1)</script>');
  assert.ok(!html.includes('<img')); assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('href="javascript:')); assert.ok(html.includes('<strong>đậm</strong>'));
  assert.ok(F.renderBlock({ type: 'code', text: '</code><img onerror=1>' }).includes('&lt;/code&gt;'));
});
test('links retain query parameters and punctuation safely', () => {
  const rendered = F.inline('Xem https://example.com?a=1&b=2. Và [bài viết](https://example.com/read).');
  assert.ok(rendered.includes('href="https://example.com?a=1&amp;b=2"'));
  assert.ok(rendered.includes('rel="noopener noreferrer"'));
  assert.ok(rendered.includes('>bài viết</a>.'));
});
test('large input is handled without dropping any characters', () => {
  const text = ('Một dòng ngắn có dấu chấm.\n').repeat(4000);
  const start = performance.now();
  const parsed = F.parse(text);
  assert.equal(compact(parsed.blocks.map(b => b.text).join('\n')), compact(text));
  assert.ok(performance.now() - start < 5000);
});
test('empty input has no blocks and a stable result', () => {
  const parsed = F.parse(' \n\t'); assert.equal(parsed.blocks.length, 0); assert.equal(parsed.stats.words, 0);
});
