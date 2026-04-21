/* ============================================
   LEARN WITH SAURAB -- content-protection.js
   Protects video content and course materials
   ============================================ */

(function() {

  // 1. Disable right-click
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  });

  // 2. Disable keyboard shortcuts
  document.addEventListener('keydown', function(e) {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I (DevTools)
    if (e.ctrlKey && e.shiftKey && e.key === 'I') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+J (Console)
    if (e.ctrlKey && e.shiftKey && e.key === 'J') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+C (Inspector)
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (View source)
    if (e.ctrlKey && e.key === 'u') {
      e.preventDefault();
      return false;
    }
    // Ctrl+S (Save page)
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      return false;
    }
    // Ctrl+P (Print)
    if (e.ctrlKey && e.key === 'p') {
      e.preventDefault();
      return false;
    }
  });

  // 3. Disable drag on images and videos
  document.addEventListener('dragstart', function(e) {
    if (
      e.target.tagName === 'IMG' ||
      e.target.tagName === 'VIDEO'
    ) {
      e.preventDefault();
      return false;
    }
  });

  // 4. Detect DevTools open → blur protected videos
  const devToolsThreshold = 160;

  setInterval(function() {
    const widthDiff  = window.outerWidth  - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;

    if (widthDiff > devToolsThreshold ||
        heightDiff > devToolsThreshold) {
      // Blur and pause all protected videos
      document.querySelectorAll('.protected-video').forEach(function(video) {
        video.pause();
        video.style.filter = 'blur(20px)';
      });
    } else {
      // Restore videos when DevTools closed
      document.querySelectorAll('.protected-video').forEach(function(video) {
        video.style.filter = '';
      });
    }
  }, 1000);

  // 5. Disable text selection on video player area
  document.querySelectorAll('.video-player-wrap').forEach(function(el) {
    el.style.userSelect = 'none';
    el.style.webkitUserSelect = 'none';
  });

  // 6. Warn on page visibility change
  // (when user switches tab -- optional logging)
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // User switched tab -- could pause video here
      document.querySelectorAll('.protected-video').forEach(function(video) {
        // Uncomment to auto-pause on tab switch:
        // video.pause();
      });
    }
  });

})();
