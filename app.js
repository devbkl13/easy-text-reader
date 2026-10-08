(function () {
  'use strict';
  const F = window.TextFormatter;
  const $ = id => document.getElementById(id);
  const storageKey = 'easy-text-reader-v1';
  const defaults = { fontSize: 20, lineHeight: 1.5, readingWidth: 720, fontFamily: 'mono', theme: 'paper', version: 2 };
  const fonts = {
    serif: "Cambria,Georgia,'Times New Roman',serif",
    sans: "'Segoe UI',Arial,sans-serif",
    beVietnam: "'Be Vietnam Pro','Segoe UI',Arial,sans-serif",
    manrope: "'Manrope','Segoe UI',Arial,sans-serif",
    mono: "ui-monospace,'Cascadia Mono',Consolas,'Liberation Mono',Menlo,monospace"
  };
  const themes = { paper: 'Giấy', white: 'Trắng', night: 'Ban đêm', sepia: 'Giấy ấm', mist: 'Sương xanh' };
  let settings = { ...defaults }, parsed = F.parse(''), overrides = {}, reading = false, switchingView = false, pending = false, draftTimer, toastTimer, savedPosition = 0;
  let titleManual = false, headingEls = [], tocEntries = [], tocLinks = [], activeIndex = -2, progressRatio = 0;
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
    return $('articleTitle').value.trim() || parsed.inferredTitle || parsed.suggestedTitle || 'Bài viết của bạn';
  }

  // The title field follows the text until the reader types their own title.
  function syncAutoTitle() {
    const auto = parsed.inferredTitle || parsed.suggestedTitle || '';
    if (!titleManual) $('articleTitle').value = auto.slice(0, 180);
    const typed = $('articleTitle').value.trim();
    $('titleHint').textContent = titleManual && typed ? 'do bạn đặt' : !typed ? 'không bắt buộc' : parsed.inferredTitle ? 'tự nhận diện' : 'lấy từ câu đầu';
    $('titleAutoButton').hidden = !(titleManual && typed && auto && typed !== auto);
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
    tocEntries = headings.map(block => ({ id: block.id, label: block.text.replace(/\*\*|__|`/g, '') }));
    const tocHtml = headings.map((block, index) => '<a href="#' + block.id + '" data-index="' + index + '"' + (block.level > 2 ? ' class="toc-sub"' : '') + '>' +
      (block.number ? '<span class="toc-num">' + F.escapeHtml(block.marker || block.number + '.') + '</span> ' : '') + '<span class="toc-text">' + F.escapeHtml(tocEntries[index].label) + '</span></a>').join('');
    $('tableOfContents').innerHTML = tocHtml || '<span class="toc-empty">Bài này không có đề mục.<br>Cứ thong thả đọc từ đầu nhé.</span>';
    $('sheetToc').innerHTML = tocHtml;
    $('tocOpen').disabled = !headings.length;
    headingEls = [...$('readerArticle').querySelectorAll('h2[id], h3[id], h4[id]')];
    tocLinks = [...document.querySelectorAll('#tableOfContents a, #sheetToc a')];
    activeIndex = -2;
    document.title = reading ? title() + ' — Khoảng đọc' : 'Khoảng đọc — Cho những dòng chữ một khoảng thở';
    if (reading) updateProgress();
  }

  function saveDraft() {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ source: $('sourceText').value, title: $('articleTitle').value, titleManual, mode: $('formatMode').value, split: $('splitParagraphs').checked, settings, overrides, position: savedPosition }));
      storageAvailable = true;
      $('saveStatus').textContent = 'Đã lưu trên trình duyệt này';
    } catch {
      storageAvailable = false;
      $('saveStatus').textContent = 'Trình duyệt không cho lưu bản nháp';
    }
  }

  function format(notify = false, reset = true) {
    clearTimeout(draftTimer);
    stopCountdown();
    if (reset) overrides = {};
    parsed = F.parse($('sourceText').value, { mode: $('formatMode').value, split: $('splitParagraphs').checked });
    pending = false;
    syncAutoTitle();
    $('sourceCount').textContent = parsed.stats.words.toLocaleString('vi-VN') + ' từ · ' + parsed.stats.characters.toLocaleString('vi-VN') + ' ký tự';
    render();
    saveDraft();
    if (notify) toast('Đã tạo khoảng đọc. Lời văn của bạn được giữ nguyên.');
  }

  const debounceMs = 1500;
  let countdownTimer;
  function stopCountdown() {
    clearInterval(countdownTimer);
    const bar = $('debounceBar');
    bar.style.transition = 'none';
    bar.style.width = '0';
  }

  function startCountdown() {
    const bar = $('debounceBar'), deadline = Date.now() + debounceMs;
    clearInterval(countdownTimer);
    bar.style.transition = 'none';
    bar.style.width = '100%';
    bar.getBoundingClientRect();
    bar.style.transition = 'width ' + debounceMs + 'ms linear';
    bar.style.width = '0';
    const tick = () => { $('saveStatus').textContent = 'Tự cập nhật sau ' + (Math.max(0, deadline - Date.now()) / 1000).toFixed(1).replace('.', ',') + 's…'; };
    tick();
    countdownTimer = setInterval(tick, 100);
  }

  function queueFormat() {
    pending = true;
    $('sourceCount').textContent = F.words($('sourceText').value).toLocaleString('vi-VN') + ' từ';
    clearTimeout(draftTimer);
    startCountdown();
    draftTimer = setTimeout(() => format(), debounceMs);
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
    if (!reading) closeSheet(false);
    if (reading) { requestAnimationFrame(() => { window.scrollTo({ top: restorePosition, behavior: 'instant' }); switchingView = false; updateProgress(); }); }
    else { window.scrollTo({ top: 0, behavior: 'instant' }); switchingView = false; }
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

  // Progress runs from the moment the article reaches the top of the screen to the moment its end reaches the bottom.
  function updateProgress() {
    if (!reading || switchingView) return;
    const rect = $('readerArticle').getBoundingClientRect();
    const range = rect.height - innerHeight;
    progressRatio = range > 0 ? Math.min(1, Math.max(0, -rect.top / range)) : 1;
    $('progressBar').style.width = (progressRatio * 100).toFixed(1) + '%';
    updateActive();
    updateBar();
    if (sheetOpen()) updateSheet();
    savedPosition = window.scrollY;
  }

  function updateActive() {
    let index = -1;
    const line = innerHeight * .4;
    for (let i = 0; i < headingEls.length; i++) { if (headingEls[i].getBoundingClientRect().top <= line) index = i; else break; }
    // Reaching the end of the page means the last section is the one being read.
    if (headingEls.length && window.scrollY + innerHeight >= document.documentElement.scrollHeight - 2) index = headingEls.length - 1;
    if (index === activeIndex) return;
    activeIndex = index;
    for (const link of tocLinks) {
      const position = Number(link.dataset.index);
      link.classList.toggle('active', position === index);
      link.classList.toggle('done', position < index);
      if (position === index) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    }
  }

  const percent = () => Math.round(progressRatio * 100);
  function remaining() {
    if (progressRatio >= .995) return 'đã đọc hết';
    return 'còn khoảng ' + Math.max(1, Math.ceil(parsed.stats.minutes * (1 - progressRatio))) + ' phút';
  }

  function updateBar() {
    const where = !tocEntries.length ? '' : activeIndex < 0 ? 'Mở đầu' : 'Mục ' + (activeIndex + 1) + '/' + tocEntries.length;
    $('barCaption').textContent = (where ? where + ' · ' : '') + remaining();
    $('barTitle').textContent = activeIndex >= 0 && tocEntries[activeIndex] ? tocEntries[activeIndex].label : title();
    $('barPercent').textContent = percent() + '%';
    $('barFill').style.transform = 'scaleX(' + progressRatio.toFixed(4) + ')';
    $('barTrack').setAttribute('aria-valuenow', String(percent()));
  }

  const sheetOpen = () => $('tocSheet').classList.contains('open');
  function updateSheet() {
    $('sheetSummary').textContent = 'Đã đọc ' + percent() + '% · ' + remaining();
    $('sheetFill').style.transform = 'scaleX(' + progressRatio.toFixed(4) + ')';
  }

  function openSheet() {
    if (!tocEntries.length || sheetOpen()) return;
    // Locking the page scroll removes a classic scrollbar; keep its width so the text does not reflow underneath.
    const gutter = innerWidth - document.documentElement.clientWidth;
    $('tocSheet').classList.add('open');
    document.documentElement.classList.add('sheet-open');
    if (gutter > 0) document.documentElement.style.paddingRight = gutter + 'px';
    updateProgress();
    $('tocOpen').setAttribute('aria-expanded', 'true');
    const list = $('sheetToc'), current = list.querySelector('.active');
    list.scrollTop = current ? Math.max(0, current.offsetTop - list.clientHeight / 2 + current.offsetHeight / 2) : 0;
    $('tocClose').focus({ preventScroll: true });
  }

  function closeSheet(restoreFocus = true) {
    if (!sheetOpen()) return;
    $('tocSheet').classList.remove('open');
    document.documentElement.classList.remove('sheet-open');
    document.documentElement.style.paddingRight = '';
    $('tocOpen').setAttribute('aria-expanded', 'false');
    if (restoreFocus) $('tocOpen').focus({ preventScroll: true });
  }

  function applySettings() {
    document.body.dataset.theme = settings.theme;
    document.body.dataset.font = settings.fontFamily;
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
    titleManual = true;
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
      '*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:30px}body{margin:0;background:' + colors.bg + ';color:' + colors.fg + ';font-family:' + font + ';font-size:' + settings.fontSize + 'px;line-height:' + settings.lineHeight + '}main{max-width:' + (settings.readingWidth + 60) + 'px;margin:auto;padding:55px 30px 80px;overflow-wrap:anywhere}h1{font-family:inherit;font-size:' + (settings.fontFamily === 'mono' ? '1.6' : '2.2') + 'em;font-weight:400;line-height:1.3;letter-spacing:-.5px;margin:.3em 0}h2{font-size:1.3em;line-height:1.5;margin:1.8em 0 .8em}h3{font-size:1.15em}p{margin:0 0 1.25em}p:not(.verse):not(.preserve-lines),.callout{text-align:justify;text-align-last:start;text-justify:inter-word}.verse,.preserve-lines,blockquote,pre,li,h1,h2,h3,h4{text-align:start}a{color:' + colors.muted + ';text-underline-offset:3px}.article-kicker{font:10px Arial;letter-spacing:2px;color:' + colors.muted + '}.article-metadata{font:11px Arial;color:' + colors.muted + ';display:flex;flex-wrap:wrap;gap:18px;padding:20px 0 25px;margin-bottom:30px;border-bottom:1px solid ' + colors.rule + '}.article-metadata span{display:flex;gap:6px;align-items:center}svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.5}blockquote{border-left:3px solid ' + colors.muted + ';padding-left:1.2em;margin:1.5em 0;font-style:italic;white-space:pre-line}.callout{background:' + colors.box + ';padding:18px;border-radius:6px;margin:1.5em 0}.heading-number{font: .65em Arial;background:' + colors.box + ';padding:5px 8px;margin-right:10px;border-radius:5px}.verse{white-space:pre-line}li{margin-bottom:.6em}pre{font-size:.75em;padding:20px;background:' + colors.box + ';overflow:auto;white-space:pre;border-radius:6px}code{font-family:Consolas,monospace;font-size:.85em;background:' + colors.box + ';padding:2px 4px}pre code{padding:0;font-size:inherit}.task-item,.symbol-item{list-style:none}.task-box,.list-symbol{display:inline-block;margin-left:-1.5em;width:1.5em}hr{border:0;border-top:1px solid ' + colors.rule + ';margin:2em 0}details{margin:0 0 35px;padding:15px;border:1px solid ' + colors.rule + ';border-radius:6px;font:12px/1.8 Arial}summary{cursor:pointer}nav{display:flex;flex-direction:column;gap:10px;padding-top:15px}footer{border-top:1px solid ' + colors.rule + ';padding-top:25px;margin-top:45px;font:12px Arial;color:' + colors.muted + '}@media(max-width:520px){main{padding:30px 22px 55px}h1{font-size:1.8em}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}@media print{body{background:#fff;color:#222;font-size:12pt}main{padding:0;max-width:none}details,footer{display:none}h2,h3{break-after:avoid}@page{margin:20mm}}</style></head><body><main><article>' + articleHeader() + (toc ? '<details><summary>Trong bài viết</summary><nav>' + toc + '</nav></details>' : '') + contentHtml() + '</article><footer>khoảng đọc. · Được định dạng trên thiết bị. Giữ nguyên lời văn.</footer></main></body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob), anchor = document.createElement('a');
    anchor.href = url;
    const baseName = title().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').slice(0, 100).trim();
    anchor.download = (baseName ? baseName + ' - Reading Page' : 'Reading Page') + '.html';
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    toast('Đã tải trang HTML. Mở file đó để đọc trên mọi thiết bị.');
  }

  $('sourceText').addEventListener('input', () => { savedPosition = 0; queueFormat(); });
  $('articleTitle').addEventListener('input', () => { titleManual = $('articleTitle').value.trim() !== ''; syncAutoTitle(); render(); saveDraft(); });
  // Leaving the field empty hands the title back to automatic detection.
  $('articleTitle').addEventListener('change', () => { if (!titleManual) { syncAutoTitle(); render(); saveDraft(); } });
  $('titleAutoButton').addEventListener('click', () => { titleManual = false; syncAutoTitle(); render(); saveDraft(); });
  // Replacing the whole text means a new article, so its title is detected afresh.
  $('sourceText').addEventListener('paste', () => { const text = $('sourceText'); if (!text.value.trim() || (text.selectionStart === 0 && text.selectionEnd === text.value.length)) titleManual = false; });
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
    $('sourceText').value = ''; $('articleTitle').value = ''; titleManual = false; savedPosition = 0; format();
  });
  $('pasteButton').addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) { toast('Clipboard đang trống.'); return; }
      $('sourceText').value = text;
      $('articleTitle').value = '';
      titleManual = false;
      savedPosition = 0; format();
      toast('Đã dán nội dung từ clipboard.');
    } catch { toast('Không đọc được clipboard. Hãy cho phép quyền truy cập hoặc dán thủ công bằng Ctrl+V.'); $('sourceText').focus(); }
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
  $('tocOpen').addEventListener('click', openSheet);
  $('tocClose').addEventListener('click', () => closeSheet());
  $('tocSheet').addEventListener('click', event => { if (event.target.matches('.toc-sheet-backdrop')) closeSheet(); });
  $('sheetBack').addEventListener('click', () => { closeSheet(false); showReader(false); });
  $('sheetToc').addEventListener('click', event => {
    const link = event.target.closest('a');
    if (!link) return;
    event.preventDefault();
    const target = $('readerArticle').querySelector(link.getAttribute('href'));
    closeSheet();
    // Let the page unlock before scrolling so the heading lands where the offset expects it.
    requestAnimationFrame(() => target?.scrollIntoView({ behavior: motion(), block: 'start' }));
  });
  matchMedia('(min-width: 821px)').addEventListener('change', event => { if (event.matches) closeSheet(false); });
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
    if (sheetOpen()) {
      if (event.key === 'Escape') { event.preventDefault(); closeSheet(); }
      else if (event.key === 'Tab') {
        const items = [...$('tocSheet').querySelectorAll('button, a[href]')];
        const edge = event.shiftKey ? items[0] : items.at(-1);
        if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? items.at(-1) : items[0]).focus(); }
      }
      return;
    }
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

  // Intro hero: auto-folds once the user starts working; remembered across visits.
  const introKey = 'khoang-doc-intro', root = document.documentElement;
  let introPinnedOpen = false;
  function setIntro(collapsed, remember = true) {
    root.classList.toggle('intro-collapsed', collapsed);
    $('introUnfold').setAttribute('aria-expanded', String(!collapsed));
    $('introFold').setAttribute('aria-expanded', String(!collapsed));
    if (remember) { try { collapsed ? localStorage.setItem(introKey, 'collapsed') : localStorage.removeItem(introKey); } catch {} }
  }
  const autoFold = () => { if (!introPinnedOpen && !reading && !root.classList.contains('intro-collapsed')) setIntro(true); };
  $('introFold').addEventListener('click', () => { introPinnedOpen = false; setIntro(true); $('sourceText').focus({ preventScroll: true }); });
  $('introUnfold').addEventListener('click', () => { introPinnedOpen = true; setIntro(false, false); try { localStorage.removeItem(introKey); } catch {} $('introFold').focus({ preventScroll: true }); });
  $('workspace').addEventListener('focusin', autoFold);
  $('sourceText').addEventListener('paste', autoFold);
  window.addEventListener('scroll', () => { if (window.scrollY > 60) autoFold(); }, { passive: true });
  setIntro(root.classList.contains('intro-collapsed'), false);
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('no-anim')));

  let restored = false;
  try {
    const draft = JSON.parse(localStorage.getItem(storageKey));
    if (draft && typeof draft.source === 'string') {
      $('sourceText').value = draft.source;
      $('articleTitle').value = typeof draft.title === 'string' ? draft.title.slice(0, 180) : '';
      titleManual = typeof draft.titleManual === 'boolean' ? draft.titleManual : $('articleTitle').value.trim() !== '';
      $('formatMode').value = draft.mode === 'conservative' ? 'conservative' : 'balanced';
      $('splitParagraphs').checked = draft.split !== false;
      overrides = draft.overrides && typeof draft.overrides === 'object' ? Object.fromEntries(Object.entries(draft.overrides).filter(([key, value]) => /^block-\d+$/.test(key) && ['paragraph', 'heading', 'list', 'quote', 'callout', 'verse', 'code', 'rule'].includes(value))) : {};
      savedPosition = Math.max(0, Number(draft.position) || 0);
      const saved = draft.settings || {};
      const savedFont = ({ classic: 'beVietnam', compact: 'manrope' })[saved.fontFamily] || saved.fontFamily;
      settings = { fontSize: Math.min(28, Math.max(16, Number(saved.fontSize) || 20)), lineHeight: Math.min(2.2, Math.max(1.4, Number(saved.lineHeight) || defaults.lineHeight)), readingWidth: Math.round(Math.min(1040, Math.max(480, Number(saved.readingWidth) || defaults.readingWidth)) / 20) * 20, fontFamily: Object.hasOwn(fonts, savedFont) ? savedFont : defaults.fontFamily, theme: Object.hasOwn(themes, saved.theme) ? saved.theme : defaults.theme, version: defaults.version };
      // Settings saved before the monospace / 1.5 defaults hold the old defaults verbatim, not a choice: move them over once.
      if (saved.version !== defaults.version) { if (savedFont === 'serif') settings.fontFamily = defaults.fontFamily; if (Number(saved.lineHeight) === 1.85) settings.lineHeight = defaults.lineHeight; }
      restored = true;
    }
  } catch { storageAvailable = false; }
  if (!restored) {
    $('sourceText').value = window.SAMPLE_TEXT || '';
    $('articleTitle').value = 'Một vài điều học được khi làm agent';
    titleManual = true;
  }
  applySettings();
  format(false, false);
  if (!storageAvailable) $('saveStatus').textContent = 'Trình duyệt không cho lưu bản nháp';
})();
