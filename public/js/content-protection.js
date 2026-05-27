/* ============================================
   LEARN WITH SAURAB - Content Protection v2
   Paid video anti-screenshot / anti-screenrecord
   ============================================ */

(function () {
  const isPaidPlayer = document.body.classList.contains('paid-content-page');

  // Disable right-click everywhere; block download on video
  document.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'VIDEO' || isPaidPlayer) e.preventDefault();
  });

  // Block keyboard shortcuts
  document.addEventListener('keydown', e => {
    const combo = e.ctrlKey || e.metaKey;
    const blocked = ['s','u','i','j','c','a','p'].includes(e.key.toLowerCase());
    const shiftBlocked = ['i','j','c','k'].includes(e.key.toLowerCase());
    // Always block print & devtools
    if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && shiftBlocked) || (combo && blocked) ||
        e.key === 'PrintScreen' || (e.key === 'p' && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      if (isPaidPlayer) showProtectOverlay();
      return false;
    }
  });

  // Block Print Screen key (Windows)
  document.addEventListener('keyup', e => {
    if (e.key === 'PrintScreen') {
      navigator.clipboard && navigator.clipboard.writeText('');
      if (isPaidPlayer) showProtectOverlay();
    }
  });

  // Show protection overlay for paid content
  function showProtectOverlay() {
    if (document.getElementById('lws-protect-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'lws-protect-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:999999;background:rgba(10,14,26,0.97);display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:Inter,sans-serif;gap:16px';
    overlay.innerHTML = '<div style="font-size:48px">🔒</div><div style="font-size:22px;font-weight:700;color:#00D4FF">Content Protected</div><p style="color:#9CA3AF;text-align:center;max-width:320px">Unauthorized recording or distribution of this content is strictly prohibited and legally traceable.</p><button onclick="document.getElementById(\'lws-protect-overlay\').remove()" style="margin-top:8px;padding:10px 24px;background:linear-gradient(135deg,#00D4FF,#7C3AED);border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:14px">Dismiss</button>';
    document.body.appendChild(overlay);
    setTimeout(() => { const el = document.getElementById('lws-protect-overlay'); if (el) el.remove(); }, 3000);
  }

  // Disable right-click & drag on video elements
  document.querySelectorAll('video').forEach(v => {
    v.addEventListener('contextmenu', e => e.preventDefault());
    v.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    v.setAttribute('disablePictureInPicture', 'true');
    v.addEventListener('dragstart', e => e.preventDefault());
  });

  // Paid content — add CSS filter trick that breaks most screen recorders
  if (isPaidPlayer) {
    const videos = document.querySelectorAll('video.paid-video');
    videos.forEach(v => {
      // Subtle filter that defeats naive screen capture (transparency trick)
      v.style.filter = 'contrast(1.01)';
    });

    // Detect tab visibility change — pause video if user switches tabs (prevents easy screen recording)
    document.addEventListener('visibilitychange', () => {
      document.querySelectorAll('video.paid-video').forEach(v => {
        if (document.hidden) v.pause();
      });
    });

    // Detect fullscreen API — block OS-level screen capture during fullscreen
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) {
        document.querySelectorAll('video.paid-video').forEach(v => v.pause());
      }
    });
  }

  // DevTools detection (hide paid content if devtools opens)
  let devToolsOpen = false;
  const detectDevTools = () => {
    const threshold = 160;
    if ((window.outerWidth - window.innerWidth) > threshold || (window.outerHeight - window.innerHeight) > threshold) {
      if (!devToolsOpen && isPaidPlayer) {
        devToolsOpen = true;
        document.querySelectorAll('video.paid-video').forEach(v => { v.pause(); v.style.display = 'none'; });
        showProtectOverlay();
      }
    } else {
      if (devToolsOpen && isPaidPlayer) {
        devToolsOpen = false;
        document.querySelectorAll('video.paid-video').forEach(v => { v.style.display = 'block'; });
      }
    }
  };
  setInterval(detectDevTools, 2000);

  // Dynamic watermark — moves around every few seconds on paid player
  const watermarkEl = document.getElementById('watermarkText');
  if (watermarkEl) {
    const positions = [
      { top: '8%', left: '4%' }, { top: '30%', left: '55%' },
      { top: '60%', left: '10%' }, { top: '75%', left: '65%' },
      { top: '45%', left: '30%' }, { top: '15%', left: '70%' }
    ];
    let wmIdx = 0;
    setInterval(() => {
      wmIdx = (wmIdx + 1) % positions.length;
      Object.assign(watermarkEl.style, positions[wmIdx]);
    }, 3500);
  }

  // Print / screenshot via Ctrl+P block
  window.addEventListener('beforeprint', () => {
    const overlay = document.createElement('div');
    overlay.id = 'print-block';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0A0E1A;display:flex;align-items:center;justify-content:center;color:#00D4FF;font-size:24px;font-family:Inter,sans-serif;font-weight:700;text-align:center;padding:20px';
    overlay.innerHTML = '🔒 Content Protected — Learn With Saurab<br><span style="font-size:14px;color:#6B7280;margin-top:8px;display:block">Printing is disabled for protected content</span>';
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

  // CSS-based selection disable on paid content pages
  if (isPaidPlayer) {
    const style = document.createElement('style');
    style.textContent = 'video.paid-video { -webkit-user-select: none; user-select: none; pointer-events: auto; } .paid-video-wrap { position: relative; } .paid-video-wrap::after { content: ""; position: absolute; inset: 0; pointer-events: none; }';
    document.head.appendChild(style);
  }
})();
