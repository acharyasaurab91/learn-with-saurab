// ============================================
// LEARN WITH SAURAB — main.js
// Global JS: navbar scroll, reveal animations
// ============================================

document.addEventListener(‘DOMContentLoaded’, function () {

// ─── NAVBAR SCROLL EFFECT ───
const navbar = document.getElementById(‘navbar’);
if (navbar) {
window.addEventListener(‘scroll’, function () {
if (window.scrollY > 50) {
navbar.classList.add(‘scrolled’);
} else {
navbar.classList.remove(‘scrolled’);
}
});
}

// ─── SCROLL REVEAL ───
const revealElements = document.querySelectorAll(’.reveal’);

if (revealElements.length > 0) {
const revealObserver = new IntersectionObserver(function (entries) {
entries.forEach(function (entry, index) {
if (entry.isIntersecting) {
// Stagger delay for grid children
setTimeout(function () {
entry.target.classList.add(‘visible’);
}, index * 80);
revealObserver.unobserve(entry.target);
}
});
}, {
threshold: 0.1,
rootMargin: ‘0px 0px -40px 0px’
});

```
revealElements.forEach(function (el) {
  revealObserver.observe(el);
});
```

}

// ─── AUTO-APPLY REVEAL TO SECTIONS ───
// Cards in grids get reveal class automatically
const autoReveal = document.querySelectorAll(
‘.category-card, .course-card, .feature-card, .test-card, .stat-card’
);

autoReveal.forEach(function (el) {
if (!el.classList.contains(‘reveal’)) {
el.classList.add(‘reveal’);
}
});

// Re-observe after adding classes
if (revealElements.length === 0 && autoReveal.length > 0) {
const obs = new IntersectionObserver(function (entries) {
entries.forEach(function (entry) {
if (entry.isIntersecting) {
entry.target.classList.add(‘visible’);
obs.unobserve(entry.target);
}
});
}, { threshold: 0.1 });

```
autoReveal.forEach(function (el) { obs.observe(el); });
```

}

// ─── ACTIVE NAV LINK ───
const currentPath = window.location.pathname;
const navLinks = document.querySelectorAll(’.nav-link’);

navLinks.forEach(function (link) {
const href = link.getAttribute(‘href’);
if (href === currentPath || (href !== ‘/’ && currentPath.startsWith(href))) {
link.classList.add(‘active’);
} else {
link.classList.remove(‘active’);
}
});

// ─── FLASH MESSAGES AUTO DISMISS ───
const flashMessages = document.querySelectorAll(’.auth-error, .auth-success, .alert’);
flashMessages.forEach(function (msg) {
if (msg.style.display !== ‘none’) {
setTimeout(function () {
msg.style.opacity = ‘0’;
msg.style.transform = ‘translateY(-8px)’;
msg.style.transition = ‘all 0.4s ease’;
setTimeout(function () { msg.style.display = ‘none’; }, 400);
}, 6000);
}
});

// ─── SMOOTH ANCHOR SCROLLING ───
document.querySelectorAll(‘a[href^=”#”]’).forEach(function (anchor) {
anchor.addEventListener(‘click’, function (e) {
const target = document.querySelector(this.getAttribute(‘href’));
if (target) {
e.preventDefault();
target.scrollIntoView({ behavior: ‘smooth’, block: ‘start’ });
}
});
});

// ─── CATEGORY CARD ICON BACKGROUND ───
// Sets icon bg to match category color with opacity
document.querySelectorAll(’.category-card’).forEach(function (card) {
const color = getComputedStyle(card).getPropertyValue(’–card-color’).trim();
const icon = card.querySelector(’.category-icon’);
if (icon && color) {
// Convert hex to rgba with low opacity
icon.style.background = color + ‘22’; // 22 = ~13% opacity in hex
icon.style.border = ’1px solid ’ + color + ‘44’;
icon.style.color = color;
}
});

console.log(‘✅ Learn with Saurab — main.js loaded’);
});