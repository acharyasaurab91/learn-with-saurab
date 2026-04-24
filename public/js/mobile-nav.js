// ============================================
// LEARN WITH SAURAB — mobile-nav.js
// Hamburger menu + mobile navigation
// ============================================

document.addEventListener(‘DOMContentLoaded’, function () {

const hamburger = document.getElementById(‘hamburger’);
const navLinks  = document.getElementById(‘navLinks’);

// Create mobile nav overlay if it doesn’t exist
let mobileNav = document.getElementById(‘mobileNav’);

if (!mobileNav && hamburger) {
// Build mobile menu from existing nav links
mobileNav = document.createElement(‘div’);
mobileNav.id = ‘mobileNav’;
mobileNav.className = ‘mobile-nav’;

```
// Get all nav link items
const links = navLinks ? navLinks.querySelectorAll('.nav-link') : [];
const navActions = document.querySelector('.nav-actions');

links.forEach(function (link) {
  const a = document.createElement('a');
  a.href = link.href;
  a.textContent = link.textContent.trim();
  a.className = 'nav-link';
  mobileNav.appendChild(a);
});

// Add login/signup buttons
if (navActions) {
  const btns = navActions.querySelectorAll('a');
  btns.forEach(function (btn) {
    if (!btn.classList.contains('hamburger') && btn.tagName === 'A') {
      const cloned = btn.cloneNode(true);
      mobileNav.appendChild(cloned);
    }
  });
}

document.body.appendChild(mobileNav);
```

}

if (!hamburger) return;

// Toggle mobile menu
hamburger.addEventListener(‘click’, function () {
const isOpen = mobileNav && mobileNav.classList.contains(‘open’);

```
if (mobileNav) {
  mobileNav.classList.toggle('open');
}

hamburger.classList.toggle('open');

// Prevent body scroll when menu is open
document.body.style.overflow = isOpen ? '' : 'hidden';
```

});

// Close menu when a link is clicked
if (mobileNav) {
mobileNav.querySelectorAll(‘a’).forEach(function (link) {
link.addEventListener(‘click’, function () {
mobileNav.classList.remove(‘open’);
hamburger.classList.remove(‘open’);
document.body.style.overflow = ‘’;
});
});
}

// Close on outside click
document.addEventListener(‘click’, function (e) {
if (mobileNav && mobileNav.classList.contains(‘open’)) {
if (!hamburger.contains(e.target) && !mobileNav.contains(e.target)) {
mobileNav.classList.remove(‘open’);
hamburger.classList.remove(‘open’);
document.body.style.overflow = ‘’;
}
}
});

// ─── DASHBOARD SIDEBAR TOGGLE ───
const sidebarToggle = document.getElementById(‘sidebarToggle’);
const sidebar = document.getElementById(‘sidebar’);

if (sidebarToggle && sidebar) {

```
// Create overlay
let overlay = document.getElementById('sidebarOverlay');
if (!overlay) {
  overlay = document.createElement('div');
  overlay.id = 'sidebarOverlay';
  overlay.className = 'sidebar-overlay';
  document.body.appendChild(overlay);
}

sidebarToggle.addEventListener('click', function () {
  sidebar.classList.toggle('sidebar-open');
  overlay.classList.toggle('active');
  document.body.style.overflow = sidebar.classList.contains('sidebar-open') ? 'hidden' : '';
});

overlay.addEventListener('click', function () {
  sidebar.classList.remove('sidebar-open');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
});
```

}

console.log(‘✅ Learn with Saurab — mobile-nav.js loaded’);
});