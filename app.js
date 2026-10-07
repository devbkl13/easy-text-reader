(function () {
  'use strict';
  const F = window.TextFormatter;
  const $ = id => document.getElementById(id);
  const storageKey = 'khoang-doc-v1';
  const defaults = { fontSize: 20, lineHeight: 1.85, readingWidth: 720, fontFamily: 'serif', theme: 'paper' };
  const fonts = {
    serif: "Cambria,Georgia,'Times New Roman',serif",
    sans: "'Segoe UI',Arial,sans-serif",
    beVietnam: "'Be Vietnam Pro','Segoe UI',Arial,sans-serif",
    manrope: "'Manrope','Segoe UI',Arial,sans-serif",
    mono: "ui-monospace,'Cascadia Mono',Consolas,'Liberation Mono',Menlo,monospace"
  };
  const themes = { paper: 'Giấy', white: 'Trắng', night: 'Ban đêm', sepia: 'Giấy ấm', mist: 'Sương xanh' };
  let settings = { ...defaults }, parsed = F.parse(''), overrides = {}, reading = false, switchingView = false, pending = false, draftTimer, toastTimer, observer, savedPosition = 0;
  let focused = false;
  let storageAvailable = true;
  const motion = () => matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  const clockIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const bookIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 5h6l3 2 3-2h6v14h-6l-3 2-3-2H3zM12 7v14"/></svg>';

  function toast(message) {
    $('toast').textContent = message;
    $('toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 3600);
  }

  function effectiveBlocks() {
    return parsed.blocks.map(block => {
      if (overrides[block.id]) {
        let text = block.text;
        if (block.number && overrides[block.id] !== 'heading') text = (block.marker || block.number + '.') + ' ' + text;
        if (block.type === 'list' && overrides[block.id] !== 'list') text = block.items.map(item => item.marker + ' ' + (item.checked === null ? '' : item.checked ? '[x] ' : '[ ] ') + item.text).join('\n');
        return { ...block, text, type: overrides[block.id], level: 2 };
      }
      if (block.type === 'title' && $('articleTitle').value.trim() && $('articleTitle').value.trim() !== parsed.inferredTitle) return { ...block, type: 'heading', level: 2, reason: 'Giữ tiêu đề gốc khi bạn đặt tên hiển thị khác' };
      return block;
    });
  }

  function title() {
    return $('articleTitle').value.trim() || parsed.inferredTitle || 'Bài viết của bạn';
  }

  function articleHeader() {
    return '<div class="article-kicker">MỘT KHOẢNG ĐỌC</div><h1>' + F.escapeHtml(title()) + '</h1>' +
      '<div class="article-metadata"><span>' + clockIcon + parsed.stats.minutes + ' phút đọc</span><span>' + bookIcon + parsed.stats.words.toLocaleString('vi-VN') + ' từ</span><span>Giữ nguyên lời văn</span></div>';
  }

  function contentHtml(inspect = false, preview = false) {
    return effectiveBlocks().map(block => {
      const rendered = F.renderBlock(preview ? { ...block, id: 'preview-' + block.id } : block);
      if (!inspect || block.type === 'title') return rendered;
      const types = { paragraph: 'Đoạn văn', heading: 'Tiêu đề mục', list: 'Danh sách', quote: 'Trích dẫn', callout: 'Ý cần chú ý', verse: 'Giữ ngắt dòng', code: 'Khối mã', rule: 'Dòng phân cách' };
      const choices = Object.entries(types).filter(([type]) => !['list', 'rule'].includes(type) || type === block.type);
      return '<div class="inspected-block">' +
        '<div class="inspection"><select data-block="' + block.id + '" aria-label="Kiểu định dạng ở dòng ' + block.line + '">' + choices.map(([type, name]) => '<option value="' + type + '"' + (block.type === type ? ' selected' : '') + '>' + name + '</option>').join('') + '</select>' +
        '<span>Dòng ' + block.line + ' · ' + F.escapeHtml(overrides[block.id] ? 'Bạn đã chọn lại kiểu trình bày' : block.reason) + '</span>' +
        (overrides[block.id] ? '<button data-reset="' + block.id + '">Hoàn tác</button>' : '') + '</div>' + rendered + '</div>';
    }).join('');
  }

  function render() {
    const hasContent = parsed.blocks.length > 0;
    $('readTab').disabled = !hasContent;
    $('startReading').disabled = !hasContent;
    $('formatButton').disabled = !$('sourceText').value.trim();
    if (!hasContent) {
      $('previewArticle').innerHTML = '<div class="empty-state">' + bookIcon + '<h3>Những dòng chữ đang đợi bạn.</h3><p>Dán nội dung vào ô bên cạnh,<br>hoặc thử bài mẫu để bắt đầu.</p></div>';
      $('readerArticle').replaceChildren();
      $('formatSummary').textContent = 'Một trang đọc gọn gàng, bắt đầu từ đây.';
      return;
    }
    $('previewArticle').innerHTML = articleHeader() + contentHtml($('inspectToggle').checked, true);
    $('readerArticle').innerHTML = articleHeader() + contentHtml();
    const blocks = effectiveBlocks();
    const headings = blocks.filter(block => block.type === 'heading');
    const lists = blocks.filter(block => block.type === 'list').length;
    $('formatSummary').textContent = [headings.length + ' đề mục', lists + ' danh sách', parsed.stats.splits + ' khoảng nghỉ mới'].join(' · ');
    $('readerMeta').textContent = parsed.stats.minutes + ' phút cho một khoảng đọc · ' + parsed.stats.words.toLocaleString('vi-VN') + ' từ';
    $('tableOfContents').innerHTML = headings.length ? headings.map(block => '<a href="#' + block.id + '"' + (block.level > 2 ? ' class="toc-sub"' : '') + '>' + F.escapeHtml((block.number ? block.marker || block.number + '.' : '') + ' ' + block.text.replace(/\*\*|__|`/g, '')) + '</a>').join('') : '<span class="toc-empty">Bài này không có đề mục.<br>Cứ thong thả đọc từ đầu nhé.</span>';
    document.title = reading ? title() + ' — Khoảng đọc' : 'Khoảng đọc — Cho những dòng chữ một khoảng thở';
    if (reading) observeSections();
  }

  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ source: $('sourceText').value, title: $('articleTitle').value, mode: $('formatMode').value, split: $('splitParagraphs').checked, settings, overrides, position: savedPosition }));
      storageAvailable = true;
      $('saveStatus').textContent = 'Đã lưu trên trình duyệt này';
    } catch {
      storageAvailable = false;
      $('saveStatus').textContent = 'Trình duyệt không cho lưu bản nháp';
    }
  }

  function format(notify = false, reset = true) {
    clearTimeout(draftTimer);
    if (reset) overrides = {};
    parsed = F.parse($('sourceText').value, { mode: $('formatMode').value, split: $('splitParagraphs').checked });
    pending = false;
    $('sourceCount').textContent = parsed.stats.words.toLocaleString('vi-VN') + ' từ · ' + parsed.stats.characters.toLocaleString('vi-VN') + ' ký tự';
    render();
    saveDraft();
    if (notify) toast('Đã tạo khoảng đọc. Lời văn của bạn được giữ nguyên.');
  }

  function queueFormat() {
    pending = true;
    $('formatButton').disabled = !$('sourceText').value.trim();
    $('sourceCount').textContent = F.words($('sourceText').value).toLocaleString('vi-VN') + ' từ';
    $('saveStatus').textContent = 'Đang cập nhật…';
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => format(), 550);
  }

  function observeSections() {
    if (observer) observer.disconnect();
    const headings = [...$('readerArticle').querySelectorAll('h2[id], h3[id], h4[id]')];
    if (!headings.length) return;
    observer = new IntersectionObserver(() => {
      let active = headings[0];
      for (const heading of headings) { if (heading.getBoundingClientRect().top <= innerHeight * .4) active = heading; }
      for (const link of $('tableOfContents').querySelectorAll('a')) {
        const current = link.getAttribute('href') === '#' + active.id;
        link.classList.toggle('active', current);
        if (current) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      }
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    headings.forEach(heading => observer.observe(heading));
  }

  function showReader(enable) {
    if (pending) format();
    if (enable && !parsed.blocks.length) { toast('Dán một bài viết để bắt đầu nhé.'); $('sourceText').focus(); return; }
    if (reading && !enable) savedPosition = window.scrollY;
    if (!enable && focused) setFocusMode(false, false);
    const restorePosition = savedPosition;
    switchingView = true;
    reading = enable;
    document.body.classList.toggle('is-reading', reading);
    $('intro').hidden = reading;
    $('workspace').hidden = reading;
    $('siteFooter').hidden = reading;
    $('reader').hidden = !reading;
    $('editTab').classList.toggle('active', !reading);
    $('readTab').classList.toggle('active', reading);
    $('editTab').setAttribute('aria-pressed', String(!reading));
    $('readTab').setAttribute('aria-pressed', String(reading));
    $('readingSettings').hidden = true;
    $('settingsButton').setAttribute('aria-expanded', 'false');
    document.title = reading ? title() + ' — Khoảng đọc' : 'Khoảng đọc — Cho những dòng chữ một khoảng thở';
    if (reading) { observeSections(); requestAnimationFrame(() => { window.scrollTo({ top: restorePosition, behavior: 'instant' }); switchingView = false; updateProgress(); }); }
    else { if (observer) observer.disconnect(); window.scrollTo({ top: 0, behavior: 'instant' }); switchingView = false; }
    saveDraft();
  }

  function setFocusMode(enable, preservePosition = true) {
    if (!reading || enable === focused) return;
    // Preserve the visible paragraph when controls are removed or restored.
    const anchorTop = focused ? 16 : document.querySelector('.site-header').getBoundingClientRect().bottom + 16;
    const anchor = [...$('readerArticle').querySelectorAll('h1,h2,h3,h4,p,li,blockquote,pre,.callout')].find(element => element.getBoundingClientRect().bottom > anchorTop);
    const before = anchor?.getBoundingClientRect().top;
    const scrollTop = window.scrollY;
    focused = enable;
    closeSettings();
    document.body.classList.toggle('is-focused', focused);
    $('focusButton').setAttribute('aria-pressed', String(focused));
    $('exitFocusButton').hidden = !focused;
    if (!preservePosition) return;
    (focused ? $('readerArticle') : $('focusButton')).focus({ preventScroll: true });
    requestAnimationFrame(() => {
      if (scrollTop > 0 && anchor) window.scrollBy({ top: anchor.getBoundingClientRect().top - before, behavior: 'instant' });
      updateProgress();
      saveDraft();
    });
  }

  function updateProgress() {
    if (!reading || switchingView) return;
    const top = $('readerArticle').getBoundingClientRect().top + window.scrollY;
    const end = $('readerArticle').getBoundingClientRect().bottom + window.scrollY - innerHeight * .65;
    const ratio = Math.min(1, Math.max(0, (window.scrollY - top + 100) / Math.max(1, end - top + 100)));
    $('progressBar').style.width = (ratio * 100).toFixed(1) + '%';
    savedPosition = window.scrollY;
  }

  function applySettings() {
    document.body.dataset.theme = settings.theme;
    document.documentElement.style.setProperty('--article-size', settings.fontSize + 'px');
    document.documentElement.style.setProperty('--reader-size', settings.fontSize + 'px');
    document.documentElement.style.setProperty('--article-leading', settings.lineHeight);
    document.documentElement.style.setProperty('--reading-width', settings.readingWidth + 'px');
    document.documentElement.style.setProperty('--article-font', fonts[settings.fontFamily]);
    $('themeName').textContent = themes[settings.theme];
    document.querySelector('meta[name="theme-color"]').setAttribute('content', getComputedStyle(document.body).getPropertyValue('--bg').trim());
    $('fontSize').value = settings.fontSize;
    $('fontSizeValue').textContent = settings.fontSize;
    $('lineHeight').value = settings.lineHeight;
    $('lineHeightValue').textContent = Number(settings.lineHeight).toFixed(2);
    $('readingWidth').value = settings.readingWidth;
    $('readingWidthValue').textContent = settings.readingWidth;
    $('fontFamily').value = settings.fontFamily;
    document.querySelectorAll('[data-theme]').forEach(button => {
      if (button.tagName !== 'BUTTON') return;
      const current = settings.theme === button.dataset.theme;
      button.classList.toggle('active', current);
      button.setAttribute('aria-pressed', String(current));
    });
  }

  function loadSample() {
    if ($('sourceText').value.trim() && $('sourceText').value !== window.SAMPLE_TEXT && !confirm('Thay nội dung đang soạn bằng bài mẫu? Bạn có thể chọn Hủy để giữ bài hiện tại.')) return;
    $('sourceText').value = window.SAMPLE_TEXT;
    $('articleTitle').value = 'Một vài điều học được khi làm agent';
    savedPosition = 0;
    format();
    toast('Đã mở bài mẫu từ sample.txt. Bạn có thể dán bài khác vào bất cứ lúc nào.');
  }

  function exportHtml() {
    const style = getComputedStyle(document.body);
    const color = property => style.getPropertyValue(property).trim();
    const colors = { bg: color('--bg'), fg: color('--article-ink'), muted: color('--muted'), rule: color('--border'), box: color('--accent-soft') };
    const font = fonts[settings.fontFamily];
    const fontCss = window.LOCAL_FONTS?.cssByFamily[settings.fontFamily] || '';
    const toc = effectiveBlocks().filter(block => block.type === 'heading').map(block => '<a href="#' + block.id + '">' + F.escapeHtml((block.marker ? block.marker + ' ' : '') + block.text) + '</a>').join('');
    const html = '<!doctype html>\n<html lang="vi"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="' + (settings.theme === 'night' ? 'dark' : 'light') + '"><title>' + F.escapeHtml(title()) + '</title><style>' + fontCss +
      '*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:' + colors.bg + ';color:' + colors.fg + ';font-family:' + font + ';font-size:' + settings.fontSize + 'px;line-height:' + settings.lineHeight + '}main{max-width:' + (settings.readingWidth + 60) + 'px;margin:auto;padding:55px 30px 80px;overflow-wrap:anywhere}h1{font-family:inherit;font-size:2.2em;font-weight:400;line-height:1.3;letter-spacing:-.5px;margin:.3em 0}h2{font-size:1.3em;line-height:1.5;margin:1.8em 0 .8em}h3{font-size:1.15em}p{margin:0 0 1.25em}p:not(.verse):not(.preserve-lines),.callout{text-align:justify;text-align-last:start;text-justify:inter-word}.verse,.preserve-lines,blockquote,pre,li,h1,h2,h3,h4{text-align:start}a{color:' + colors.muted + ';text-underline-offset:3px}.article-kicker{font:10px Arial;letter-spacing:2px;color:' + colors.muted + '}.article-metadata{font:11px Arial;color:' + colors.muted + ';display:flex;flex-wrap:wrap;gap:18px;padding:20px 0 25px;margin-bottom:30px;border-bottom:1px solid ' + colors.rule + '}.article-metadata span{display:flex;gap:6px;align-items:center}svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5}blockquote{border-left:3px solid ' + colors.muted + ';padding-left:1.2em;margin:1.5em 0;font-style:italic;white-space:pre-line}.callout{background:' + colors.box + ';padding:18px;border-radius:6px;margin:1.5em 0}.heading-number{font: .65em Arial;background:' + colors.box + ';padding:5px 8px;margin-right:10px;border-radius:5px}.verse{white-space:pre-line}li{margin-bottom:.6em}pre{font-size:.75em;padding:20px;background:' + colors.box + ';overflow:auto;white-space:pre;border-radius:6px}code{font-family:Consolas,monospace;font-size:.85em;background:' + colors.box + ';padding:2px 4px}pre code{padding:0;font-size:inherit}.task-item,.symbol-item{list-style:none}.task-box,.list-symbol{display:inline-block;margin-left:-1.5em;width:1.5em}hr{border:0;border-top:1px solid ' + colors.rule + ';margin:2em 0}details{margin:0 0 35px;padding:15px;border:1px solid ' + colors.rule + ';border-radius:6px;font:12px/1.8 Arial}summary{cursor:pointer}nav{display:flex;flex-direction:column;gap:10px;padding-top:15px}footer{border-top:1px solid ' + colors.rule + ';padding-top:25px;margin-top:45px;font:12px Arial;color:' + colors.muted + '}@media(max-width:520px){main{padding:30px 22px 55px}h1{font-size:1.8em}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{body{background:#fff;color:#222;font-size:12pt}main{padding:0;max-width:none}details,footer{display:none}h2,h3{break-after:avoid}@page{margin:20mm}}</style></head><body><main><article>' + articleHeader() + (toc ? '<details><summary>Trong bài viết</summary><nav>' + toc + '</nav></details>' : '') + contentHtml() + '</article><footer>khoảng đọc. · Được định dạng trên thiết bị. Giữ nguyên lời văn.</footer></main></body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = (title().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 100) || 'khoang-doc') + '.html';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Đã tải trang HTML. Mở file đó để đọc trên mọi thiết bị.');
  }

  $('sourceText').addEventListener('input', () => { savedPosition = 0; queueFormat(); });
  $('articleTitle').addEventListener('input', () => { render(); saveDraft(); });
  $('formatButton').addEventListener('click', () => {
    format(true, pending);
    if (matchMedia('(max-width:820px)').matches && parsed.blocks.length) $('previewArticle').closest('.preview-panel').scrollIntoView({ behavior: motion(), block: 'start' });
  });
  $('formatMode').addEventListener('change', () => format());
  $('splitParagraphs').addEventListener('change', () => format());
  $('sampleButton').addEventListener('click', loadSample);
  $('inspectToggle').addEventListener('change', render);
  $('previewArticle').addEventListener('change', event => {
    if (!event.target.matches('[data-block]')) return;
    const top = $('previewScroll').scrollTop;
    overrides[event.target.dataset.block] = event.target.value;
    render(); saveDraft();
    $('previewScroll').scrollTop = top;
  });
  $('previewArticle').addEventListener('click', event => {
    const button = event.target.closest('[data-reset]');
    if (!button) return;
    const top = $('previewScroll').scrollTop;
    delete overrides[button.dataset.reset];
    render(); saveDraft();
    $('previewScroll').scrollTop = top;
  });
  $('clearButton').addEventListener('click', () => {
    if ($('sourceText').value && !confirm('Xóa bài đang soạn và bản nháp đã lưu trên trình duyệt này?')) return;
    $('sourceText').value = ''; $('articleTitle').value = ''; savedPosition = 0; format(); $('sourceText').focus();
  });
  $('importButton').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    event.target.value = '';
    if (file.size > 2 * 1024 * 1024) { toast('Vui lòng chọn tệp văn bản nhỏ hơn 2 MB.'); return; }
    if ($('sourceText').value.trim() && !confirm('Thay nội dung đang soạn bằng tệp “' + file.name + '”?')) return;
    try {
      const text = await file.text();
      if (text.includes('\0')) { toast('Tệp này có vẻ không phải văn bản thuần. Hãy chọn tệp UTF-8 .txt hoặc .md.'); return; }
      $('sourceText').value = text;
      $('articleTitle').value = '';
      savedPosition = 0; format();
      if (!parsed.inferredTitle) { $('articleTitle').value = file.name.replace(/\.(txt|md)$/iu, ''); render(); saveDraft(); }
      toast('Đã mở tệp “' + file.name + '”.');
    } catch { toast('Không đọc được tệp này. Bạn có thể dán văn bản trực tiếp.'); }
  });
  $('readTab').addEventListener('click', () => showReader(true));
  $('homeLink').addEventListener('click', event => { event.preventDefault(); showReader(false); });
  $('startReading').addEventListener('click', () => showReader(true));
  $('focusButton').addEventListener('click', () => setFocusMode(!focused));
  $('exitFocusButton').addEventListener('click', () => setFocusMode(false));
  $('editTab').addEventListener('click', () => showReader(false));
  $('backToEdit').addEventListener('click', () => showReader(false));
  $('nextArticle').addEventListener('click', () => { showReader(false); $('sourceText').focus(); $('sourceText').select(); });
  $('tableOfContents').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    $('readerArticle').querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: motion(), block: 'start' });
  });
  $('settingsButton').addEventListener('click', () => {
    const open = $('readingSettings').hidden;
    $('readingSettings').hidden = !open;
    $('settingsButton').setAttribute('aria-expanded', String(open));
    if (open) { positionReadingSettings(); $('fontSize').focus({ preventScroll: true }); }
  });
  function positionReadingSettings() {
    const panel = $('readingSettings');
    if (panel.hidden) return;
    const margin = 16;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    panel.style.maxHeight = Math.max(0, viewportHeight - margin * 2) + 'px';
    const panelBounds = panel.getBoundingClientRect();
    const toolbarBounds = document.querySelector('.reader-tools').getBoundingClientRect();
    const clamp = (value, maximum) => Math.max(margin, Math.min(value, maximum));
    // Capture viewport coordinates on open/resize only. Article reflow must not
    // move the active range underneath the pointer while it is being dragged.
    panel.style.left = clamp(toolbarBounds.right - panelBounds.width, viewportWidth - panelBounds.width - margin) + 'px';
    panel.style.top = clamp(toolbarBounds.bottom + 8, viewportHeight - panelBounds.height - margin) + 'px';
  }
  function closeSettings() { $('readingSettings').hidden = true; $('settingsButton').setAttribute('aria-expanded', 'false'); }
  $('closeSettings').addEventListener('click', () => { closeSettings(); $('settingsButton').focus(); });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      if (focused) { event.preventDefault(); setFocusMode(false); }
      else if (!$('readingSettings').hidden) { closeSettings(); $('settingsButton').focus(); }
      return;
    }
    const editing = event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if (reading && !editing && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'f') { event.preventDefault(); setFocusMode(!focused); }
  });
  document.addEventListener('click', event => { if (!event.target.closest('#readingSettings, #settingsButton')) closeSettings(); });
  for (const key of ['fontSize', 'lineHeight', 'readingWidth', 'fontFamily']) $(key).addEventListener('input', event => { settings[key] = key === 'fontFamily' ? event.target.value : Number(event.target.value); applySettings(); updateProgress(); saveDraft(); });
  document.querySelectorAll('button[data-theme]').forEach(button => button.addEventListener('click', () => { settings.theme = button.dataset.theme; applySettings(); saveDraft(); }));
  $('resetSettings').addEventListener('click', () => { settings = { ...defaults }; applySettings(); saveDraft(); });
  $('downloadButton').addEventListener('click', exportHtml);
  $('printButton').addEventListener('click', () => window.print());
  let scrollQueued = false;
  window.addEventListener('scroll', () => { if (!scrollQueued) { scrollQueued = true; requestAnimationFrame(() => { updateProgress(); scrollQueued = false; }); } }, { passive: true });
  window.addEventListener('resize', () => { updateProgress(); positionReadingSettings(); });
  window.addEventListener('pagehide', () => { if (pending) format(); else saveDraft(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { if (pending) format(); else saveDraft(); } });

  let restored = false;
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey));
    if (draft && typeof draft.source === 'string') {
      $('sourceText').value = draft.source;
      $('articleTitle').value = typeof draft.title === 'string' ? draft.title.slice(0, 180) : '';
      $('formatMode').value = draft.mode === 'conservative' ? 'conservative' : 'balanced';
      $('splitParagraphs').checked = draft.split !== false;
      overrides = draft.overrides && typeof draft.overrides === 'object' ? Object.fromEntries(Object.entries(draft.overrides).filter(([key, value]) => /^block-\d+$/.test(key) && ['paragraph', 'heading', 'list', 'quote', 'callout', 'verse', 'code', 'rule'].includes(value))) : {};
      savedPosition = Math.max(0, Number(draft.position) || 0);
      const saved = draft.settings || {};
      const savedFont = ({ classic: 'beVietnam', compact: 'manrope' })[saved.fontFamily] || saved.fontFamily;
      settings = { fontSize: Math.min(28, Math.max(16, Number(saved.fontSize) || 20)), lineHeight: Math.min(2.2, Math.max(1.4, Number(saved.lineHeight) || 1.85)), readingWidth: Math.round(Math.min(1040, Math.max(480, Number(saved.readingWidth) || defaults.readingWidth)) / 20) * 20, fontFamily: Object.hasOwn(fonts, savedFont) ? savedFont : defaults.fontFamily, theme: Object.hasOwn(themes, saved.theme) ? saved.theme : defaults.theme };
      restored = true;
    }
  } catch { storageAvailable = false; }
  if (!restored) {
    $('sourceText').value = window.SAMPLE_TEXT || '';
    $('articleTitle').value = 'Một vài điều học được khi làm agent';
  }
  applySettings();
  format(false, false);
  if (!storageAvailable) $('saveStatus').textContent = 'Trình duyệt không cho lưu bản nháp';
})();
