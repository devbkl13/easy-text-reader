/* Pure local formatter. No network, model, dependency or DOM required. */
(function (root) {
  'use strict';
  const END_SENTENCE = /[.!?…][”’"')\]]*$/u;
  const BULLET = /^(\s*)([-+*•●▪◦‣–—]|✅|☑️?|✔️?|❌|☐|🔹|🔸|🔺|🔻|📌|👉|➡️?|➜|→|\d+[.)]|[a-zA-Z][.)])\s+(.+)$/u;
  const NUMBERED = /^(\d{1,3})[.)]\s+(.+)$/u;
  const CALLOUT = /^(ý quan trọng(?: nhất)?|lưu ý|chú ý|ghi nhớ|quan trọng|kết luận|tóm lại|mẹo|note|tip|warning|takeaway)\s*:/iu;
  const normalize = value => value.normalize('NFKC');
  const words = value => (value.match(/[\p{L}\p{N}]+(?:['’_-][\p{L}\p{N}]+)*/gu) || []).length;
  const short = (value, max = 120) => value.length <= max && words(value) <= 20;

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  // Match tokens before escaping. Generated HTML is never fed into a second replacement.
  function inline(value, depth = 0) {
    if (depth > 3) return escapeHtml(value);
    const token = /(`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|(?<![\p{L}\p{N}])\*[^*\n]+\*(?![\p{L}\p{N}])|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\)|https?:\/\/[^\s<>"`]+)/gu;
    let result = '', last = 0;
    for (const match of value.matchAll(token)) {
      result += escapeHtml(value.slice(last, match.index));
      const item = match[0];
      if (item.startsWith('`')) result += '<code>' + escapeHtml(item.slice(1, -1)) + '</code>';
      else if (item.startsWith('**') || item.startsWith('__')) result += '<strong>' + inline(item.slice(2, -2), depth + 1) + '</strong>';
      else if (item.startsWith('*')) result += '<em>' + inline(item.slice(1, -1), depth + 1) + '</em>';
      else if (item.startsWith('[')) {
        const link = item.match(/^\[([^\]]+)\]\((.+)\)$/u);
        result += '<a href="' + escapeHtml(link[2]) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(link[1]) + '</a>';
      } else {
        let url = item, tail = '';
        while (/[.,!?;:…]$/u.test(url) || (url.endsWith(')') && (url.match(/\)/g) || []).length > (url.match(/\(/g) || []).length)) { tail = url.slice(-1) + tail; url = url.slice(0, -1); }
        result += '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(url) + '</a>' + escapeHtml(tail);
      }
      last = match.index + item.length;
    }
    return result + escapeHtml(value.slice(last));
  }

  function sentences(value) {
    // Deliberately cautious around abbreviations, decimals, versions, URLs and quotations.
    const parts = [];
    let start = 0, quote = null;
    const pairs = { '“': '”', '‘': '’', '"': '"' };
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (quote) { if (char === quote) quote = null; }
      else if (pairs[char]) quote = pairs[char];
      if (quote || !/[.!?…]/u.test(char)) continue;
      if (char === '.' && (/[\d.]/u.test(value[i + 1] || '') || /\d/u.test(value[i - 1] || ''))) continue;
      const preceding = value.slice(Math.max(start, i - 20), i + 1);
      if (/(?:\b(?:TS|ThS|PGS|GS|TP|HCM|Mr|Mrs|Ms|Dr|Prof|vs|etc|e\.g|i\.e)|\b[A-ZĐ])\.$/u.test(preceding)) continue;
      let end = i + 1;
      while (/[.!?…”’"')\]]/u.test(value[end] || '\0')) end++;
      if (end < value.length && !/\s/u.test(value[end])) continue;
      let next = end;
      while (/\s/u.test(value[next] || '\0')) next++;
      if (next < value.length && !/[\p{Lu}\p{N}“"(]/u.test(value[next])) continue;
      parts.push(value.slice(start, end).trim());
      start = next;
      i = next - 1;
    }
    if (value.slice(start).trim()) parts.push(value.slice(start).trim());
    return parts;
  }

  function splitLong(value, enabled) {
    if (!enabled || value.length < 640) return [value];
    const chunks = sentences(value);
    if (chunks.length < 3) return [value];
    const groups = [];
    let current = '';
    chunks.forEach(sentence => {
      if (current.length >= 280 && current.length + sentence.length > 560) { groups.push(current); current = sentence; }
      else current += (current ? ' ' : '') + sentence;
    });
    if (current) {
      if (groups.length && current.length < 110) groups[groups.length - 1] += ' ' + current;
      else groups.push(current);
    }
    return groups;
  }

  function parse(source, options = {}) {
    const mode = options.mode === 'conservative' ? 'conservative' : 'balanced';
    const split = options.split !== false;
    const lines = String(source).replace(/\r\n?/g, '\n').replace(/^\uFEFF/u, '').split('\n');
    const blocks = [];
    let inferredTitle = '', splits = 0;
    const emit = block => { block.id = 'block-' + blocks.length; blocks.push(block); };
    const nextContent = from => { for (let j = from + 1; j < lines.length; j++) if (lines[j].trim()) return { text: lines[j].trim(), index: j }; return null; };
    const isDivider = text => /^(?:[-*_]\s*){3,}$|^[─━═]{3,}$/u.test(text);
    const isExplicit = text => /^(?:#{1,6}\s|>|```|~~~)/u.test(text) || BULLET.test(normalize(text)) || isDivider(text);
    const nextHasBody = index => {
      const next = nextContent(index);
      return next && !isExplicit(next.text) && next.text.length >= 100;
    };

    function headingAt(index) {
      const original = lines[index].trim(), text = normalize(original);
      const markdown = original.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?$/u);
      if (markdown) return { type: 'heading', level: Math.min(4, Math.max(2, markdown[1].length)), text: markdown[2], title: markdown[1].length === 1, reason: 'Dấu # của Markdown', confidence: 'cao' };
      if (index + 1 < lines.length && /^\s*(?:={3,}|-{3,})\s*$/u.test(lines[index + 1]) && short(text) && /\p{L}/u.test(text) && !BULLET.test(text)) return { type: 'heading', level: 2, text: original, consume: 1, title: /^\s*=/.test(lines[index + 1]), reason: 'Tiêu đề có dòng gạch chân', confidence: 'cao' };
      const numbered = text.match(NUMBERED);
      // Consecutive numbered lines are a list. A long paragraph after a short numbered line is a section.
      const previousNumbered = index > 0 && NUMBERED.test(normalize(lines[index - 1].trim()));
      if (numbered && !previousNumbered && short(numbered[2], 155) && nextHasBody(index)) {
        const boundary = Array.from(original).findIndex(char => /\s/u.test(char));
        return { type: 'heading', level: 2, text: Array.from(original).slice(boundary).join('').trim(), number: numbered[1], marker: Array.from(original).slice(0, boundary).join(''), reason: 'Mục có số, theo sau là đoạn giải thích dài', confidence: 'cao' };
      }
      const namedSection = /^(?:phần|chương|bước|mục|chapter|part|step)\s+(?:\d{1,3}|[IVXLCDM]{1,7})(?:\s*[:.\-–—]\s*|\s+)\S/iu.test(text);
      const romanSection = /^[IVXLCDM]{1,7}[.)]\s+\S/u.test(text) && !(index > 0 && /^[IVXLCDM]{1,7}[.)]\s/u.test(normalize(lines[index - 1].trim())));
      const keycapSection = /^\d\uFE0F?\u20E3\s*\S/u.test(text);
      if ((namedSection || romanSection || keycapSection) && short(text, 140) && nextHasBody(index)) return { type: 'heading', level: 2, text: original, reason: 'Nhãn đề mục và đoạn giải thích phía sau', confidence: 'cao' };
      if (/^(?:>|[-+*•●▪◦‣–—]\s)/u.test(text)) return null;
      if (mode === 'conservative') return null;
      const decorated = text.replace(/^(?:📌|👉|🔹|🔸|💡|🔥|✨|🎯|🌿)\s*/u, '');
      const decoratedLetters = decorated.match(/\p{L}/gu) || [];
      if (decorated !== text && short(text, 110) && decoratedLetters.length >= 4 && decoratedLetters.every(letter => /\p{Lu}/u.test(letter)) && nextHasBody(index)) return { type: 'heading', level: 2, text: original, reason: 'Tiêu đề viết hoa có biểu tượng, theo sau là đoạn dài', confidence: 'vừa' };
      const letters = text.match(/\p{L}/gu) || [];
      const uppercase = letters.filter(letter => /\p{Lu}/u.test(letter)).length;
      if (short(text, 110) && letters.length >= 4 && uppercase / letters.length > .88 && !/[.!?]$/u.test(text) && !BULLET.test(text)) return { type: 'heading', level: 2, text: original, reason: 'Dòng ngắn viết hoa', confidence: 'vừa' };
      if (/^\*\*[^*]+\*\*$|^__[^_]+__$/u.test(original) && short(text) && nextHasBody(index)) return { type: 'heading', level: 2, text: original.slice(2, -2), reason: 'Dòng ngắn được nhấn mạnh, theo sau là nội dung', confidence: 'vừa' };
      const isolated = (index === 0 || !lines[index - 1].trim()) && nextContent(index)?.index > index + 1;
      if (isolated && short(text, 95) && words(text) >= 2 && !END_SENTENCE.test(text) && !BULLET.test(text) && nextHasBody(index)) return { type: 'heading', level: 2, text: original, title: blocks.length === 0, reason: 'Dòng ngắn đứng riêng trước một đoạn dài', confidence: 'vừa' };
      if (/^.{4,75}:$/u.test(text) && words(text) <= 12 && nextHasBody(index)) return { type: 'heading', level: 3, text: original, reason: 'Nhãn ngắn kết thúc bằng dấu hai chấm', confidence: 'vừa' };
      return null;
    }

    for (let i = 0; i < lines.length; i++) {
      const text = lines[i].trim();
      if (!text) continue;
      const line = i + 1;
      const fence = text.match(/^(`{3,}|~{3,})(.*)$/u);
      if (fence) {
        const content = [], marker = fence[1][0];
        let end = i + 1;
        for (; end < lines.length; end++) { if (new RegExp('^\\s*' + marker + '{' + fence[1].length + ',}\\s*$').test(lines[end])) break; content.push(lines[end]); }
        emit({ type: 'code', text: content.join('\n'), language: fence[2].trim(), line, reason: 'Khối mã có hàng rào Markdown', confidence: 'cao' });
        i = Math.min(end, lines.length - 1); continue;
      }
      const heading = headingAt(i);
      if (heading) {
        if (heading.title && !inferredTitle && blocks.length === 0) { inferredTitle = heading.text; emit({ ...heading, type: 'title', line }); }
        else emit({ ...heading, type: 'heading', line });
        i += heading.consume || 0; continue;
      }
      if (isDivider(text)) { emit({ type: 'rule', text, line, reason: 'Dòng phân cách', confidence: 'cao' }); continue; }
      const bullet = normalize(lines[i]).match(BULLET);
      if (bullet) {
        const listKind = marker => /^\d+[.)]$/u.test(marker) ? '1' : /^[a-z][.)]$/u.test(marker) ? 'a' : /^[A-Z][.)]$/u.test(marker) ? 'A' : '';
        const kind = listKind(bullet[2]), ordered = !!kind, items = [];
        const ordinal = marker => kind === '1' ? parseInt(marker, 10) : marker[0].toLowerCase().charCodeAt(0) - 96;
        let j = i;
        for (; j < lines.length; j++) {
          const item = normalize(lines[j]).match(BULLET);
          if (!item || listKind(item[2]) !== kind || (j !== i && headingAt(j))) break;
          // Keep original Unicode; the normalized form is only used to identify syntax.
          const original = lines[j].trim();
          const prefixLength = Array.from(original).findIndex(char => /\s/u.test(char));
          let content = prefixLength >= 0 ? Array.from(original).slice(prefixLength).join('').trim() : item[3];
          const task = content.match(/^\[([ xX])\]\s+(.*)$/u);
          const entry = { text: task ? task[2] : content, checked: task ? task[1] !== ' ' : null, marker: item[2], value: ordered ? ordinal(item[2]) : null };
          // Indented continuation belongs to the same item; blank lines end the list.
          while (j + 1 < lines.length && /^\s{2,}\S/u.test(lines[j + 1]) && !BULLET.test(normalize(lines[j + 1])) && !headingAt(j + 1)) { entry.text += '\n' + lines[++j].trim(); }
          items.push(entry);
        }
        emit({ type: 'list', ordered, kind, start: ordered ? ordinal(bullet[2]) : 1, items, text: items.map(item => (item.checked === null ? '' : item.checked ? '[x] ' : '[ ] ') + item.text).join('\n'), line, reason: ordered ? 'Các dòng bắt đầu bằng số hoặc chữ thứ tự' : 'Các dòng bắt đầu bằng ký hiệu danh sách', confidence: 'cao' });
        i = j - 1; continue;
      }
      if (/^>\s?/u.test(text)) {
        const content = [text.replace(/^>\s?/u, '')];
        while (i + 1 < lines.length && /^\s*>/u.test(lines[i + 1])) content.push(lines[++i].trim().replace(/^>\s?/u, ''));
        emit({ type: 'quote', text: content.join('\n'), line, reason: 'Dấu > của trích dẫn', confidence: 'cao' }); continue;
      }
      if (mode !== 'conservative' && /^(?:“[\s\S]+”|"[\s\S]+")$/u.test(text) && text.length > 45) { emit({ type: 'quote', text, line, reason: 'Cả đoạn nằm trong dấu ngoặc kép', confidence: 'vừa' }); continue; }
      if (mode !== 'conservative' && CALLOUT.test(normalize(text))) { emit({ type: 'callout', text, line, reason: 'Nhãn báo hiệu ý cần chú ý', confidence: 'vừa' }); continue; }

      let combined = text, merged = false;
      // Detect a paragraph wrapped to a fixed column, not arbitrary short social-media lines.
      const run = [text];
      let j = i + 1;
      while (j < lines.length && run.length < 40 && lines[j].trim() && !isExplicit(lines[j].trim()) && !headingAt(j) && !CALLOUT.test(normalize(lines[j].trim()))) { run.push(lines[j].trim()); j++; }
      const wrap = run.length >= 3 && run.slice(0, -1).every(item => item.length >= 45 && item.length <= 110 && !END_SENTENCE.test(item));
      const verse = run.length >= 3 && run.every(item => item.length < 75) && run.filter(item => END_SENTENCE.test(item)).length < run.length / 2;
      if (wrap) { combined = run.join(' '); merged = true; i = j - 1; }
      else if (verse) { emit({ type: 'verse', text: run.join('\n'), line, reason: 'Nhóm dòng ngắn: giữ nguyên ngắt dòng', confidence: 'vừa' }); i = j - 1; continue; }
      const paragraphs = splitLong(combined, split);
      splits += paragraphs.length - 1;
      for (const paragraph of paragraphs) emit({ type: 'paragraph', text: paragraph, line, reason: paragraphs.length > 1 ? 'Thêm khoảng nghỉ tại ranh giới câu hoàn chỉnh' : merged ? 'Nối các dòng bị xuống hàng giữa câu' : 'Giữ đoạn văn gốc', confidence: 'cao', split: paragraphs.length > 1 });
    }
    const headings = blocks.filter(block => block.type === 'heading').length;
    return { blocks, inferredTitle, stats: { words: words(source), characters: source.length, minutes: Math.max(1, Math.ceil(words(source) / 220)), headings, lists: blocks.filter(block => block.type === 'list').length, splits }, options: { mode, split } };
  }

  function renderBlock(block) {
    const content = inline(block.text);
    if (block.type === 'title') return '';
    if (block.type === 'heading') {
      const level = Math.min(4, Math.max(2, block.level || 2));
      return '<h' + level + ' id="' + escapeHtml(block.id) + '">' + (block.number ? '<span class="heading-number">' + escapeHtml(block.marker || block.number + '.') + '</span>' : '') + content + '</h' + level + '>';
    }
    if (block.type === 'list' && block.items) {
      const tag = block.ordered ? 'ol' : 'ul';
      return '<' + tag + (block.ordered ? ' type="' + (block.kind === 'a' || block.kind === 'A' ? block.kind : '1') + '" start="' + Number(block.start || 1) + '"' : '') + '>' + block.items.map(item => {
        const symbol = !block.ordered && !/^[-+*•●▪◦‣–—]$/u.test(item.marker || '') ? item.marker : '';
        return '<li' + (block.ordered ? ' value="' + Number(item.value || 1) + '"' : '') + (item.checked !== null ? ' class="task-item"' : symbol ? ' class="symbol-item"' : '') + '>' + (item.checked !== null ? '<span class="task-box" aria-label="' + (item.checked ? 'Đã hoàn thành' : 'Chưa hoàn thành') + '">' + (item.checked ? '☑' : '☐') + '</span>' : symbol ? '<span class="list-symbol">' + escapeHtml(symbol) + '</span>' : '') + inline(item.text).replace(/\n/g, '<br>') + '</li>';
      }).join('') + '</' + tag + '>';
    }
    if (block.type === 'quote') return '<blockquote>' + content + '</blockquote>';
    if (block.type === 'callout') return '<aside class="callout">' + content + '</aside>';
    if (block.type === 'code') return '<pre><code>' + escapeHtml(block.text) + '</code></pre>';
    if (block.type === 'rule') return '<hr>';
    return '<p' + (block.type === 'verse' ? ' class="verse"' : block.text.includes('\n') ? ' class="preserve-lines"' : '') + '>' + content.replace(/\n/g, '<br>') + '</p>';
  }

  const api = { parse, renderBlock, inline, escapeHtml, words, sentences, splitLong };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.TextFormatter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
