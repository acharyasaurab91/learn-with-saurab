/* ============================================
   LEARN WITH SAURAB - Content Protection
   ============================================ */

(function () {
  // Disable right-click globally
  document.addEventListener('contextmenu', e => e.preventDefault());

  // Disable common keyboard shortcuts
  document.addEventListener('keydown', e => {
    if (
      (e.ctrlKey || e.metaKey) && ['s', 'u', 'i', 'j', 'c', 'a', 'p'].includes(e.key.toLowerCase()) ||
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['i', 'j', 'c', 'k'].includes(e.key.toLowerCase()))
    ) {
      e.preventDefault();
      return false;
    }
  });

  // Disable text selection on video elements
  document.querySelectorAll('video').forEach(v => {
    v.addEventListener('contextmenu', e => e.preventDefault());
  });

  // DevTools detection (basic)
  let devToolsOpen = false;
  const detectDevTools = () => {
    const threshold = 160;
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > threshold || heightDiff > threshold) {
      if (!devToolsOpen) {
        devToolsOpen = true;
        console.warn('🔒 Content is protected. Unauthorized recording or distribution is prohibited.');
      }
    } else {
      devToolsOpen = false;
    }
  };
  setInterval(detectDevTools, 3000);

  // Watermark on video player
  const watermarkEl = document.getElementById('watermarkText');
  if (watermarkEl) {
    let wmInterval = setInterval(() => {
      const positions = [
        { top: '10%', left: '5%' }, { top: '30%', left: '50%' },
        { top: '60%', left: '15%' }, { top: '80%', left: '60%' },
        { top: '45%', left: '35%' }
      ];
      const pos = positions[Math.floor(Math.random() * positions.length)];
      watermarkEl.style.top = pos.top;
      watermarkEl.style.left = pos.left;
    }, 4000);
  }

  // Screenshot detection (best effort - fires on print)
  window.addEventListener('beforeprint', () => {
    const overlay = document.createElement('div');
    overlay.id = 'print-block';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0A0E1A;display:flex;align-items:center;justify-content:center;color:#00D4FF;font-size:24px;font-family:Inter,sans-serif;font-weight:700';
    overlay.innerHTML = '🔒 Content Protected – Learn With Saurab';
    document.body.appendChild(overlay);
  });
  window.addEventListener('afterprint', () => {
    const el = document.getElementById('print-block');
    if (el) el.remove();
  });

  // Disable drag on images
  document.querySelectorAll('img').forEach(img => {
    img.setAttribute('draggable', 'false');
    img.addEventListener('dragstart', e => e.preventDefault());
  });
})();
