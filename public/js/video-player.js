/* ============================================
   LEARN WITH SAURAB - Secure Video Player
   ============================================ */

const video = document.getElementById('mainVideo');
const videoSource = document.getElementById('videoSource');
const placeholder = document.getElementById('videoPlaceholder');
const controls = document.getElementById('videoControls');
const playBtn = document.getElementById('playBtn');
const playIcon = document.getElementById('playIcon');
const videoPlayed = document.getElementById('videoPlayed');
const videoThumb = document.getElementById('videoThumb');
const timeDisplay = document.getElementById('timeDisplay');
const speedSelect = document.getElementById('speedSelect');
const muteBtn = document.getElementById('muteBtn');
const volumeSlider = document.getElementById('volumeSlider');
const videoProgress = document.getElementById('videoProgress');
const videoTitle = document.getElementById('currentVideoTitle');
const watermark = document.getElementById('watermarkText');

let currentModule = -1;
let currentVideo = -1;
let progressReported = false;
let autoSaveInterval = null;

function loadVideo(url, path, title, modIdx, vidIdx) {
  if (!url && !path) {
    alert('Video is being processed. Please check back soon.');
    return;
  }
  const src = url || '/stream/' + path;
  videoSource.src = src;
  video.load();
  video.style.display = 'block';
  placeholder.style.display = 'none';
  controls.style.display = 'block';
  if (videoTitle) videoTitle.textContent = title;

  // Update sidebar active state
  document.querySelectorAll('.learn-video-item').forEach(el => el.classList.remove('active'));
  const activeItem = document.getElementById('lvi-' + modIdx + '-' + vidIdx);
  if (activeItem) activeItem.classList.add('active');

  currentModule = modIdx;
  currentVideo = vidIdx;
  progressReported = false;

  // Auto-save progress every 30 seconds
  if (autoSaveInterval) clearInterval(autoSaveInterval);
  autoSaveInterval = setInterval(() => {
    if (!video.paused && video.currentTime > 0 && COURSE_DATA) {
      fetch('/dashboard/progress/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: COURSE_DATA.courseId,
          videoId: currentVideo,
          moduleId: currentModule,
          duration: Math.floor(video.currentTime),
          autoSave: true
        })
      }).catch(() => {});
    }
  }, 30000);

  video.play().catch(() => {});

  // Open the module accordion
  const lmod = document.getElementById('lmod-videos-' + modIdx);
  if (lmod) lmod.classList.add('open');
}

function togglePlay() {
  if (video.paused) { video.play(); }
  else { video.pause(); }
}

function setSpeed(v) { video.playbackRate = parseFloat(v); }

function toggleMute() {
  video.muted = !video.muted;
  muteBtn.querySelector('i').className = video.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
}

function setVolume(v) {
  video.volume = parseFloat(v);
  if (parseFloat(v) === 0) { video.muted = true; muteBtn.querySelector('i').className = 'fas fa-volume-mute'; }
  else { video.muted = false; muteBtn.querySelector('i').className = 'fas fa-volume-up'; }
}

function seekVideo(e) {
  if (!video.duration) return;
  const rect = videoProgress.getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  video.currentTime = pct * video.duration;
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m + ':' + String(sec).padStart(2, '0');
}

if (video) {
  video.addEventListener('play', () => { playIcon.className = 'fas fa-pause'; });
  video.addEventListener('pause', () => { playIcon.className = 'fas fa-play'; });
  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = (video.currentTime / video.duration) * 100;
    videoPlayed.style.width = pct + '%';
    videoThumb.style.left = pct + '%';
    timeDisplay.textContent = formatTime(video.currentTime) + ' / ' + formatTime(video.duration);

    // Report 30% watched
    if (!progressReported && pct > 30 && COURSE_DATA) {
      progressReported = true;
      fetch('/dashboard/progress/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: COURSE_DATA.courseId,
          videoId: currentVideo,
          duration: video.currentTime
        })
      }).catch(() => {});
    }

    // Animate watermark
    if (watermark) {
      const positions = ['5%', '25%', '50%', '70%'];
      if (Math.floor(video.currentTime) % 8 === 0) {
        watermark.style.top = positions[Math.floor(Math.random() * positions.length)];
        watermark.style.left = positions[Math.floor(Math.random() * positions.length)];
      }
    }
  });

  video.addEventListener('ended', () => {
    playIcon.className = 'fas fa-play';
  });

  // Disable right-click on video
  video.addEventListener('contextmenu', e => e.preventDefault());
  // Block keyboard shortcuts that might help record
  video.addEventListener('keydown', e => {
    if (['F11', 'F12'].includes(e.key)) e.preventDefault();
  });
}

function toggleFullscreen() {
  const container = document.getElementById('videoContainer');
  const icon = document.querySelector('#fsBtn i');
  if (!document.fullscreenElement) {
    container.requestFullscreen().then(() => {
      if (icon) icon.className = 'fas fa-compress';
    }).catch(() => {});
  } else {
    document.exitFullscreen().then(() => {
      if (icon) icon.className = 'fas fa-expand';
    }).catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  const icon = document.querySelector('#fsBtn i');
  if (icon) icon.className = document.fullscreenElement ? 'fas fa-compress' : 'fas fa-expand';
});

function toggleSidebar() {
  const sidebar = document.querySelector('.learn-sidebar');
  if (sidebar) sidebar.classList.toggle('open');
}

function toggleLModule(idx) {
  const el = document.getElementById('lmod-videos-' + idx);
  const icon = document.querySelector('#lmod-' + idx);
  if (el) el.classList.toggle('open');
  if (icon) icon.style.transform = el && el.classList.contains('open') ? 'rotate(90deg)' : '';
}

function switchTab(tab) {
  document.querySelectorAll('.learn-tab-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.learn-tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tab).style.display = 'block';
  event.target.classList.add('active');
}

function saveNote() {
  const notes = document.getElementById('notesArea').value;
  if (!notes.trim()) return;
  localStorage.setItem('lws-notes-' + (COURSE_DATA ? COURSE_DATA.courseId : 'general'), notes);
  const btn = event.target;
  btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
  setTimeout(() => { btn.innerHTML = '<i class="fas fa-save"></i> Save Note'; }, 2000);
}

// Restore saved notes
(function() {
  const notesArea = document.getElementById('notesArea');
  if (notesArea && COURSE_DATA) {
    const saved = localStorage.getItem('lws-notes-' + COURSE_DATA.courseId);
    if (saved) notesArea.value = saved;
  }
})();
