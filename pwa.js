(() => {
  'use strict';
  // Chỉ chạy khi mở qua http(s); bản một file mở bằng file:// không có service worker.
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;

  let controlled = !!navigator.serviceWorker.controller, reloading = false, lastCheck = Date.now();
  const CHECK_EVERY = 10 * 60 * 1000;

  function notice(message) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 6000);
  }

  // Bản mới đã được tải đủ và kích hoạt. Chỉ tải lại khi trang đang ẩn (bản nháp đã được app.js lưu lúc ẩn),
  // để không làm gián đoạn lúc đang gõ hoặc đọc.
  function reload() {
    if (reloading) return;
    reloading = true;
    location.reload();
  }
  function applyUpdate() {
    if (document.hidden) return reload();
    notice('Đã có phiên bản mới. Ứng dụng sẽ tự cập nhật khi bạn chuyển sang cửa sổ khác.');
    document.addEventListener('visibilitychange', () => { if (document.hidden) reload(); });
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!controlled) { controlled = true; return; } // lần cài đặt đầu tiên: không cần tải lại
    applyUpdate();
  });

  window.addEventListener('load', async () => {
    let registration;
    try { registration = await navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }); } catch { return; }
    const check = () => { lastCheck = Date.now(); registration.update().catch(() => {}); };
    document.addEventListener('visibilitychange', () => { if (!document.hidden && Date.now() - lastCheck > CHECK_EVERY) check(); });
    setInterval(() => { if (!document.hidden) check(); }, 60 * 60 * 1000);
  });
})();
