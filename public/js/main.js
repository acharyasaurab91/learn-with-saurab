/* ============================================
   LEARN WITH SAURAB -- main.js
   Global JavaScript
   ============================================ */

// ============================================
// NAVBAR SCROLL EFFECT
// ============================================
const navbar = document.getElementById('navbar');

if (navbar) {
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });
}

// ============================================
// SMOOTH SCROLL FOR ANCHOR LINKS
// ============================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

// ============================================
// SCROLL REVEAL ANIMATION
// ============================================
const revealElements = document.querySelectorAll(
  '.category-card, .course-card, .test-card, .feature-card, .stat-card'
);

if (revealElements.length > 0) {
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry, index) => {
      if (entry.isIntersecting) {
        setTimeout(() => {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }, index * 80);
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  revealElements.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    revealObserver.observe(el);
  });
}

// ============================================
// TOAST NOTIFICATION SYSTEM
// ============================================
function showToast(message, type = 'info', duration = 4000) {
  // Create container if not exists
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fas fa-check-circle',
    error:   'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info:    'fas fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="${icons[type] || icons.info} toast-icon"></i>
    <span class="toast-message">${message}</span>
    <i class="fas fa-times toast-close"></i>
  `;

  container.appendChild(toast);

  // Close on click
  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  // Auto remove
  setTimeout(() => removeToast(toast), duration);
}

function removeToast(toast) {
  toast.style.opacity = '0';
  toast.style.transform = 'translateX(100%)';
  toast.style.transition = 'all 0.3s ease';
  setTimeout(() => toast.remove(), 300);
}

// ============================================
// MODAL SYSTEM
// ============================================
function openModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const overlay = document.getElementById(modalId);
  if (overlay) {
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function(e) {
    if (e.target === this) {
      this.classList.remove('active');
      document.body.style.overflow = '';
    }
  });
});

// Close modal on Escape key
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(overlay => {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    });
  }
});

// ============================================
// ACTIVE NAV LINK
// ============================================
const currentPath = window.location.pathname;
document.querySelectorAll('.nav-link').forEach(link => {
  if (link.getAttribute('href') === currentPath) {
    link.classList.add('active');
  }
});

// ============================================
// FORM VALIDATION HELPERS
// ============================================
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateMobile(mobile) {
  return /^(\+977)?[0-9]{10}$/.test(mobile.replace(/\s/g, ''));
}

function showFieldError(inputEl, message) {
  clearFieldError(inputEl);
  inputEl.style.borderColor = 'var(--error)';
  const error = document.createElement('span');
  error.className = 'form-error field-error-msg';
  error.textContent = message;
  inputEl.closest('.form-group')?.appendChild(error) ||
    inputEl.parentNode.appendChild(error);
}

function clearFieldError(inputEl) {
  inputEl.style.borderColor = '';
  const existing = inputEl.closest('.form-group')
    ?.querySelector('.field-error-msg');
  if (existing) existing.remove();
}

// ============================================
// LOADING BUTTON HELPER
// ============================================
function setButtonLoading(btn, loading, loadingText = 'Please wait...') {
  if (loading) {
    btn.disabled = true;
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> ${loadingText}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
  }
}

// ============================================
// COPY TO CLIPBOARD
// ============================================
function copyToClipboard(text, successMsg = 'Copied!') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(successMsg, 'success', 2000);
  }).catch(() => {
    showToast('Failed to copy', 'error', 2000);
  });
}

// ============================================
// FORMAT HELPERS
// ============================================
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-NP', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatNPR(amount) {
  return 'NPR ' + Number(amount).toLocaleString('en-NP');
}

// ============================================
// CONFIRM DIALOG HELPER
// ============================================
function confirmAction(message, onConfirm) {
  if (window.confirm(message)) {
    onConfirm();
  }
}

// ============================================
// AUTO HIDE ALERTS AFTER 5 SECONDS
// ============================================
document.querySelectorAll('.alert').forEach(alert => {
  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.5s ease';
    setTimeout(() => alert.remove(), 500);
  }, 5000);
});
