/* ============================================
   LEARN WITH SAURAB — Secure Video Player v3
   Works with flat LESSONS array from course-learn.ejs
   ============================================ */

const video       = document.getElementById('mainVideo');
const videoSource = document.getElementById('videoSource');
const placeholder = document.getElementById('videoPlaceholder');
const controls    = document.getElementById('videoControls');
const playIcon    = document.getElementById('playIcon');
const videoPlayed = document.getElementById('videoPlayed');
const videoThumb  = document.getElementById('videoThumb');
const timeDisplay = document.getElementById('timeDisplay');
const speedSelect = document.getElementById('speedSelect');
const muteBtn     = document.getElementById('muteBtn');
const volumeSlider= document.getElementById('volumeSlider');
const videoProgress = document.getElementById('videoProgress');
const videoTitleEl  = document.getElementById('currentVideoTitle');
const watermarkEl   = document.getElementById('watermarkText');

let progressReported = false;
let autoSaveInterval = null;

// ── Watermark positions ──────────────────────────────────────────
const WM_POSITIONS = [
  { top: '7%',  left: '4%'  },
  { top: '30%', left: '55%' },
  { top: '62%', left: '8%'  },
  { top: '76%', left: '60%' },
  { top: '45%', left: '28%' },
  { top: '14%', left: '68%' },
];
let wmIdx = 0;

// ── Load lesson by flat index ────────────────────────────────────
function loadLesson(idx) {
  if (!LESSONS || idx < 0 || idx >= LESSONS.length) return;
  const lesson = LESSONS[idx];
  activeIdx = idx;

  const src = lesson.videoUrl || (lesson.videoPath ? '/stream/' + lesson.videoPath : '');
  if (!src) {
    alert('Video is being processed. Please check back soon.');
    return;
  }

  videoSource.src = src;
  video.load();
  video.style.display = 'block';
  placeholder.style.display = 'none';
  controls.style.display = 'block';
  if (videoTitleEl) videoTitleEl.textContent = lesson.title;

  // Sidebar active state
  document.querySelectorAll('.learn-video-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById('lvi-' + idx);
  if (activeItem) {
    activeItem.classList.add('active');
    activeItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  // Shareable URL: keep ?v=<videoId> in sync (videoId-first resolution is done by the route)
  if (window.history && window.history.replaceState) {
    window.history.replaceState(null, '', '?v=' + encodeURIComponent(String(lesson._id)));
  }

  // Resources tab: show only the group belonging to this lesson's module
  document.querySelectorAll('.res-group').forEach(el => {
    const from = parseInt(el.dataset.from, 10);
    const to = parseInt(el.dataset.to, 10);
    el.style.display = (!Number.isNaN(from) && idx >= from && idx <= to) ? 'block' : 'none';
  });

  progressReported = false;
  if (autoSaveInterval) clearInterval(autoSaveInterval);

  // Auto-save progress every 30 s
  autoSaveInterval = setInterval(() => {
    if (!video.paused && video.currentTime > 5 && COURSE_DATA) {
      fetch('/dashboard/progress/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: COURSE_DATA.courseId,
          videoId:  String(lesson._id),
          duration: Math.floor(video.currentTime),
          autoSave: true
        })
      }).catch(() => {});
    }
  }, 30000);

  video.play().catch(() => {});
  updateSidebarProgress();
}

// ── Standard controls ────────────────────────────────────────────
function togglePlay()   { video.paused ? video.play() : video.pause(); }
function setSpeed(v)    { video.playbackRate = parseFloat(v); }
function setVolume(v)   {
  video.volume = parseFloat(v);
  const mute = parseFloat(v) === 0;
  video.muted = mute;
  if (muteBtn) muteBtn.querySelector('i').className = mute ? 'fas fa-volume-mute' : 'fas fa-volume-up';
}
function toggleMute() {
  video.muted = !video.muted;
  if (muteBtn) muteBtn.querySelector('i').className = video.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
}
function seekVideo(e) {
  if (!video.duration) return;
  const rect = videoProgress.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  video.currentTime = pct * video.duration;
}
function formatTime(s) {
  const m = Math.floor(s / 60);
  return m + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

// ── Fullscreen ───────────────────────────────────────────────────
function toggleFullscreen() {
  const container = document.getElementById('videoContainer');
  const icon = document.querySelector('#fsBtn i');
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}
document.addEventListener('fullscreenchange', () => {
  const icon = document.querySelector('#fsBtn i');
  if (icon) icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
});

// ── Sidebar toggle ───────────────────────────────────────────────
function toggleSidebar() {
  const sidebar = document.querySelector('.learn-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

// ── Tab switching ────────────────────────────────────────────────
function switchTab(tab, btn) {
  document.querySelectorAll('.learn-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.learn-tab').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('tab-' + tab);
  if (el) el.style.display = 'block';
  if (btn) btn.classList.add('active');
}

// ── Notes ────────────────────────────────────────────────────────
function saveNote() {
  const notes = document.getElementById('notesArea').value;
  if (!notes.trim()) return;
  localStorage.setItem('lws-notes-' + (COURSE_DATA ? COURSE_DATA.courseId : 'gen'), notes);
  const msg = document.getElementById('noteSavedMsg');
  if (msg) { msg.style.display = 'inline'; setTimeout(() => { msg.style.display = 'none'; }, 2500); }
}
(function restoreNotes() {
  const notesArea = document.getElementById('notesArea');
  if (notesArea && COURSE_DATA) {
    const saved = localStorage.getItem('lws-notes-' + COURSE_DATA.courseId);
    if (saved) notesArea.value = saved;
  }
})();

// ── Sidebar progress bar ─────────────────────────────────────────
function updateSidebarProgress() {
  if (!LESSONS || LESSONS.length === 0) return;
  const done = parseInt(localStorage.getItem('lws-progress-' + COURSE_DATA.courseId) || '0');
  const pct  = Math.round((done / LESSONS.length) * 100);
  const bar  = document.getElementById('sidebarProgress');
  const txt  = document.getElementById('sidebarProgressText');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = done + ' / ' + LESSONS.length + ' lessons';
}

// ── Video event listeners ─────────────────────────────────────────
if (video) {
  video.addEventListener('play',  () => { if (playIcon) playIcon.className = 'fas fa-pause'; });
  video.addEventListener('pause', () => { if (playIcon) playIcon.className = 'fas fa-play'; });

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    if (videoPlayed) videoPlayed.style.width = pct + '%';
    if (videoThumb)  videoThumb.style.left   = pct + '%';
    if (timeDisplay) timeDisplay.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);

    // Report 30% watched to server
    if (!progressReported && pct > 30 && COURSE_DATA && LESSONS && activeIdx >= 0) {
      progressReported = true;
      fetch('/dashboard/progress/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: COURSE_DATA.courseId,
          videoId:  String(LESSONS[activeIdx]._id),
          duration: Math.floor(video.currentTime)
        })
      }).catch(() => {});
    }

    // Move watermark every 8 seconds of playback
    if (watermarkEl && Math.floor(video.currentTime) % 8 === 0 && Math.floor(video.currentTime) > 0) {
      wmIdx = (wmIdx + 1) % WM_POSITIONS.length;
      Object.assign(watermarkEl.style, WM_POSITIONS[wmIdx]);
    }
  });

  video.addEventListener('ended', () => {
    if (playIcon) playIcon.className = 'fas fa-play';
    // Mark lesson complete locally and try to advance
    if (COURSE_DATA && LESSONS && activeIdx >= 0) {
      const key = 'lws-progress-' + COURSE_DATA.courseId;
      const done = new Set(JSON.parse(localStorage.getItem(key + '-ids') || '[]'));
      done.add(String(LESSONS[activeIdx]._id));
      localStorage.setItem(key + '-ids', JSON.stringify([...done]));
      localStorage.setItem(key, done.size);
      updateSidebarProgress();
      // Auto-advance to next lesson after 3 s
      if (activeIdx + 1 < LESSONS.length) {
        setTimeout(() => loadLesson(activeIdx + 1), 3000);
      }
    }
  });

  // Block right-click & keyboard record shortcuts on video element
  video.addEventListener('contextmenu', e => e.preventDefault());
  video.addEventListener('keydown', e => { if (['F11','F12'].includes(e.key)) e.preventDefault(); });
}

// ── Auto-load first/active lesson ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateSidebarProgress();
  if (LESSONS && LESSONS.length > 0) {
    // Small delay so page fully renders first
    setTimeout(() => loadLesson(activeIdx < LESSONS.length ? activeIdx : 0), 300);
  }
});
