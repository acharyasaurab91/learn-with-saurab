/* ============================================
   LEARN WITH SAURAB -- mobile-nav.js
   Hamburger menu logic
   ============================================ */

document.addEventListener('DOMContentLoaded', function() {
  const hamburger = document.getElementById('hamburger');
  const navLinks  = document.getElementById('navLinks');

  if (!hamburger || !navLinks) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'nav-overlay';
  document.body.appendChild(overlay);

  // Open menu
  function openMenu() {
    navLinks.classList.add('nav-open');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    hamburger.setAttribute('aria-expanded', 'true');

    // Animate hamburger to X
    const spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
    spans[1].style.opacity = '0';
    spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
  }

  // Close menu
  function closeMenu() {
    navLinks.classList.remove('nav-open');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    hamburger.setAttribute('aria-expanded', 'false');

    // Reset hamburger
    const spans = hamburger.querySelectorAll('span');
    spans[0].style.transform = '';
    spans[1].style.opacity = '';
    spans[2].style.transform = '';
  }

  // Toggle on hamburger click
  hamburger.addEventListener('click', function() {
    if (navLinks.classList.contains('nav-open')) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  // Close on overlay click
  overlay.addEventListener('click', closeMenu);

  // Close on nav link click
  navLinks.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', closeMenu);
  });

  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && navLinks.classList.contains('nav-open')) {
      closeMenu();
    }
  });

  // Close on resize to desktop
  window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
      closeMenu();
    }
  });
});
