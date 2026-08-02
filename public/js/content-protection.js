/* ============================================
   LEARN WITH SAURAB — Content Protection v3
   Anti-screenshot / anti-screen-record layer
   ============================================ */
(function () {
  'use strict';

  const isPaidPlayer = document.body.classList.contains('paid-content-page');

  // ── Block right-click ──────────────────────────────────────────
  document.addEventListener('contextmenu', e => {
    if (e.target.tagName === 'VIDEO' || isPaidPlayer) e.preventDefault();
  });

  // ── Block dangerous keyboard shortcuts ────────────────────────
  document.addEventListener('keydown', e => {
    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    // Print, DevTools, PrintScreen, Ctrl+S/U/P/A/C
    if (
      e.key === 'F12' ||
      e.key === 'PrintScreen' ||
      (ctrl && shift && ['i','j','c','k'].includes(e.key.toLowerCase())) ||
      (ctrl && ['s','u','p','a'].includes(e.key.toLowerCase()))
    ) {
      e.preventDefault();
      if (isPaidPlayer) showProtectBanner();
      return false;
    }
  });

  // ── Clear clipboard on PrintScreen keyup ──────────────────────
  document.addEventListener('keyup', e => {
    if (e.key === 'PrintScreen') {
      navigator.clipboard && navigator.clipboard.writeText('').catch(() => {});
      if (isPaidPlayer) showProtectBanner();
    }
  });

  // ── Temporary protection banner ────────────────────────────────
  function showProtectBanner() {
    if (document.getElementById('lws-protect-overlay')) return;
    const d = document.createElement('div');
    d.id = 'lws-protect-overlay';
    d.style.cssText = [
      'position:fixed;inset:0;z-index:999999',
      'background:rgba(10,14,26,0.97)',
      'display:flex;flex-direction:column;align-items:center;justify-content:center',
      'color:#fff;font-family:Inter,sans-serif;gap:16px;padding:24px;text-align:center'
    ].join(';');
    d.innerHTML = `
      <div style="font-size:52px">🔒</div>
      <div style="font-size:22px;font-weight:800;color:#00D4FF">Content Protected</div>
      <p style="color:#9CA3AF;max-width:340px;font-size:14px;line-height:1.6">
        Unauthorized recording or distribution of this content is strictly prohibited
        and legally traceable to your account.
      </p>
      <button onclick="document.getElementById('lws-protect-overlay').remove()"
        style="padding:10px 28px;background:linear-gradient(135deg,#00D4FF,#7C3AED);
               border:none;border-radius:8px;color:#fff;font-weight:700;cursor:pointer;font-size:14px">
        Dismiss
      </button>`;
    document.body.appendChild(d);
    setTimeout(() => { const el = document.getElementById('lws-protect-overlay'); if (el) el.remove(); }, 4000);
  }

  // ── Video element hardening ────────────────────────────────────
  document.querySelectorAll('video').forEach(v => {
    v.addEventListener('contextmenu', e => e.preventDefault());
    v.setAttribute('controlsList', 'nodownload nofullscreen noremoteplayback');
    v.setAttribute('disablePictureInPicture', '');
    v.addEventListener('dragstart', e => e.preventDefault());
    // Subtle CSS filter — defeats many naive capture tools
    if (isPaidPlayer) v.style.filter = 'contrast(1.01) brightness(0.9999)';
  });

  // ── Paid content specific protections ─────────────────────────
  if (isPaidPlayer) {

    // Pause on tab hide (prevents easy screen-recording via background tab)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        document.querySelectorAll('video.paid-video').forEach(v => v.pause());
      }
    });

    // CSS: disable text selection and touch callout
    const style = document.createElement('style');
    style.textContent = `
      body.paid-content-page {
        -webkit-user-select: none;
        -moz-user-select: none;
        user-select: none;
        -webkit-touch-callout: none;
      }
      /* Re-enable for input / textarea */
      body.paid-content-page input,
      body.paid-content-page textarea {
        -webkit-user-select: text !important;
        user-select: text !important;
      }
      /* Block print */
      @media print {
        body.paid-content-page * { display: none !important; }
        body.paid-content-page::after {
          content: "🔒 Content Protected — Learn With Saurab";
          display: block !important;
          font-size: 28px;
          text-align: center;
          padding: 40px;
        }
      }
    `;
    document.head.appendChild(style);

    // Block print / screenshot via Ctrl+P / browser print
    window.addEventListener('beforeprint', () => {
      const d = document.createElement('div');
      d.id = 'print-block';
      d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#0A0E1A;display:flex;align-items:center;justify-content:center;color:#00D4FF;font-size:22px;font-family:Inter,sans-serif;font-weight:700;text-align:center;padding:24px';
      d.innerHTML = '🔒 Content Protected — Learn With Saurab<br><span style="font-size:13px;color:#6B7280;margin-top:8px;display:block">Printing and screenshots are disabled for this content.</span>';
      document.body.appendChild(d);
    });
    window.addEventListener('afterprint', () => {
      const el = document.getElementById('print-block'); if (el) el.remove();
    });

    // Touch: block multi-touch and long-press context menu
    document.querySelectorAll('video.paid-video, .watermark-overlay').forEach(el => {
      el.addEventListener('touchstart', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
      let pressTimer;
      el.addEventListener('touchstart', () => { pressTimer = setTimeout(() => showProtectBanner(), 650); });
      el.addEventListener('touchend',   () => clearTimeout(pressTimer));
      el.addEventListener('touchmove',  () => clearTimeout(pressTimer));
    });

    // DevTools size heuristic — hide video if devtools opens
    let devOpen = false;
    setInterval(() => {
      const open = (window.outerWidth  - window.innerWidth)  > 160 ||
                   (window.outerHeight - window.innerHeight) > 160;
      if (open && !devOpen) {
        devOpen = true;
        document.querySelectorAll('video.paid-video').forEach(v => { v.pause(); v.style.visibility = 'hidden'; });
        showProtectBanner();
      } else if (!open && devOpen) {
        devOpen = false;
        document.querySelectorAll('video.paid-video').forEach(v => { v.style.visibility = 'visible'; });
      }
    }, 2000);

    // Watermark: keep timestamp live for frame traceability
    const wmEl = document.getElementById('watermarkText');
    if (wmEl) {
      // Move around every 3.5 s (also driven by video-player.js timeupdate)
      const POSITIONS = [
        { top: '7%',  left: '4%'  }, { top: '30%', left: '55%' },
        { top: '62%', left: '8%'  }, { top: '76%', left: '60%' },
        { top: '45%', left: '28%' }, { top: '14%', left: '68%' },
      ];
      let pos = 0;
      setInterval(() => {
        pos = (pos + 1) % POSITIONS.length;
        Object.assign(wmEl.style, POSITIONS[pos]);
      }, 3500);

      // Update user timestamp every second so captured frames are time-stamped
      const brandEl = wmEl.querySelector('.wm-brand');
      const userEl  = wmEl.querySelector('.wm-user');
      if (userEl && COURSE_DATA) {
        setInterval(() => {
          const now = new Date();
          const ts  = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
          userEl.textContent = COURSE_DATA.userName + ' · ' + COURSE_DATA.userEmail + ' · ' + ts;
        }, 1000);
      }
    }
  }

  // ── Disable image drag everywhere ─────────────────────────────
  document.querySelectorAll('img').forEach(img => {
    img.setAttribute('draggable', 'false');
    img.addEventListener('dragstart', e => e.preventDefault());
  });

})();
