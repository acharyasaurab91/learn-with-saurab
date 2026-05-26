/* ============================================
   LEARN WITH SAURAB - Main JS
   ============================================ */

document.addEventListener('DOMContentLoaded', () => {
  initCursor();
  initNavbar();
  initGSAP();
  initCounters();
  initMobileNav();
  initTiltCards();
  initMagneticButtons();
});

function initCursor() {
  const cursor = document.getElementById('cursor');
  const follower = document.getElementById('cursor-follower');
  if (!cursor || !follower || window.matchMedia('(max-width: 768px)').matches) return;
  let mx = 0, my = 0, fx = 0, fy = 0;
  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx - 6 + 'px';
    cursor.style.top = my - 6 + 'px';
  });
  (function animateFollower() {
    fx += (mx - fx - 18) * 0.12;
    fy += (my - fy - 18) * 0.12;
    follower.style.left = fx + 'px';
    follower.style.top = fy + 'px';
    requestAnimationFrame(animateFollower);
  })();
  document.querySelectorAll('a, button, [data-tilt]').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.style.transform = 'scale(2.5)'; follower.style.transform = 'scale(1.5)'; });
    el.addEventListener('mouseleave', () => { cursor.style.transform = 'scale(1)'; follower.style.transform = 'scale(1)'; });
  });
}

function initNavbar() {
  const nav = document.getElementById('navbar');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 50);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function initGSAP() {
  if (typeof gsap === 'undefined') return;
  gsap.registerPlugin(ScrollTrigger);

  const heroLines = document.querySelectorAll('.hero-line');
  const heroBadge = document.querySelector('.hero-badge');
  const heroDesc = document.querySelector('.hero-desc');
  const heroCta = document.querySelector('.hero-cta');
  const heroStats = document.querySelector('.hero-stats');

  if (heroBadge || heroLines.length) {
    const tl = gsap.timeline({ delay: 0.3 });
    if (heroBadge) tl.to(heroBadge, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out' });
    if (heroLines.length) tl.to(heroLines, { opacity: 1, y: 0, duration: 0.7, stagger: 0.15, ease: 'power3.out' }, '-=0.4');
    if (heroDesc) tl.to(heroDesc, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3');
    if (heroCta) tl.to(heroCta, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.3');
    if (heroStats) tl.to(heroStats, { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }, '-=0.2');
  }

  // Skip hero-section elements (handled by the timeline above)
  document.querySelectorAll('[data-gsap="fade-up"]').forEach(el => {
    if (el.closest('.hero-content')) return;
    const delay = parseFloat(el.dataset.delay) || 0;
    gsap.fromTo(el,
      { opacity: 0, y: 40 },
      {
        opacity: 1, y: 0, duration: 0.7, delay,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', toggleActions: 'play none none none' }
      }
    );
  });

  document.querySelectorAll('.category-card').forEach((card, i) => {
    const chips = card.querySelectorAll('.chip');
    if (!chips.length) return;
    gsap.fromTo(chips,
      { opacity: 0, x: -10 },
      { opacity: 1, x: 0, duration: 0.4, stagger: 0.06, ease: 'power2.out',
        scrollTrigger: { trigger: card, start: 'top 85%' } }
    );
  });
}

function initCounters() {
  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (!counters.length) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.target);
      const duration = 2000;
      const step = target / (duration / 16);
      let current = 0;
      const timer = setInterval(() => {
        current = Math.min(current + step, target);
        el.textContent = Math.floor(current).toLocaleString();
        if (current >= target) clearInterval(timer);
      }, 16);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(c => observer.observe(c));
}

function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
    const spans = toggle.querySelectorAll('span');
    const isOpen = links.classList.contains('open');
    spans[0].style.transform = isOpen ? 'translateY(7px) rotate(45deg)' : '';
    spans[1].style.opacity = isOpen ? '0' : '1';
    spans[2].style.transform = isOpen ? 'translateY(-7px) rotate(-45deg)' : '';
  });
  document.addEventListener('click', e => {
    if (!toggle.contains(e.target) && !links.contains(e.target)) {
      links.classList.remove('open');
    }
  });
}

function initTiltCards() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  document.querySelectorAll('[data-tilt]').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const rx = ((y - rect.height / 2) / rect.height) * -10;
      const ry = ((x - rect.width / 2) / rect.width) * 10;
      card.style.transform = `perspective(800px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => { card.style.transform = ''; });
  });
}

function initMagneticButtons() {
  if (window.matchMedia('(max-width: 768px)').matches) return;
  document.querySelectorAll('.btn-magnetic').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const rect = btn.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * 0.35;
      const y = (e.clientY - rect.top - rect.height / 2) * 0.35;
      btn.style.transform = `translate(${x}px, ${y}px)`;
    });
    btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
  });
}
