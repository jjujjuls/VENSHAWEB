/* ═══════════════════════════════════════════
   VENSHA SKIN — Landing Page Interactions
   Navigation, scroll effects, booking form, tech tabs
   ═══════════════════════════════════════════ */

const toggle = document.querySelector('.menu-toggle');
const mobileMenu = document.getElementById('mobileMenu');
const navShell = document.getElementById('navShell');
const form = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const reveals = document.querySelectorAll('.reveal');

/* Redirect if coming-soon mode is active (fallback when index.html is cached) */
fetch('/api/settings/status')
  .then((r) => r.json())
  .then((data) => {
    if (data.comingSoon && !window.location.pathname.includes('coming-soon')) {
      window.location.replace('/coming-soon.html');
    }
  })
  .catch(() => {});

/* Show admin link in nav when signed in */
try {
  const stored = JSON.parse(localStorage.getItem('vensha_user') || 'null');
  const signInLink = document.querySelector('.nav-signin');
  if (stored && signInLink) {
    signInLink.textContent = stored.role === 'ADMIN' ? 'Admin' : 'Account';
    signInLink.href = stored.role === 'ADMIN' ? '/admin.html' : '/';
  }
} catch { /* ignore */ }

/* ── Sticky nav theme adapts to scroll position ── */
function updateNavTheme() {
  if (!navShell) return;

  const probeY = window.scrollY + navShell.offsetHeight + 2;
  const sections = document.querySelectorAll('[data-nav-theme]');
  let theme = 'light';

  sections.forEach((section) => {
    const top = section.offsetTop;
    const bottom = top + section.offsetHeight;
    if (probeY >= top && probeY < bottom) {
      theme = section.dataset.navTheme;
    }
  });

  navShell.dataset.theme = theme;
}

updateNavTheme();
window.addEventListener('scroll', updateNavTheme, { passive: true });
window.addEventListener('resize', updateNavTheme);
window.addEventListener('load', updateNavTheme);

if (toggle && mobileMenu) {
  toggle.addEventListener('click', () => {
    const open = mobileMenu.hidden;
    mobileMenu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

if (reveals.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  reveals.forEach((item) => observer.observe(item));
}

if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const data = new FormData(form);
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const phone = data.get('phone')?.toString().trim() || '';
    const treatment = data.get('treatment')?.toString().trim() || '';

    if (!name || !email || !phone || !treatment) {
      formMessage.textContent = 'Please complete the required fields so we can contact you.';
      formMessage.className = 'form-message error';
      return;
    }

    formMessage.textContent = 'Sending your request…';
    formMessage.className = 'form-message';

    const payload = {
      name,
      email,
      phone,
      treatment,
      date: data.get('date')?.toString() || '',
      time: data.get('time')?.toString() || '',
      message: data.get('message')?.toString().trim() || '',
    };

    try {
      const apiBase = window.VENSHA_API || '';
      const response = await fetch(`${apiBase}/api/consultations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        formMessage.textContent = `Thank you, ${name}. Your consultation request has been sent. We will be in touch shortly.`;
        formMessage.className = 'form-message success';
        form.reset();
        return;
      }
    } catch {
      /* fall through to FormSubmit */
    }

    try {
      const fallback = new FormData();
      Object.entries(payload).forEach(([key, value]) => fallback.append(key, value));
      fallback.append('_subject', 'New Consultation Request — VENSHASKIN');
      fallback.append('_template', 'table');
      fallback.append('_captcha', 'false');

      const response = await fetch('https://formsubmit.co/ajax/venshaskin@gmail.com', {
        method: 'POST',
        body: fallback,
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) throw new Error('Submission failed');

      formMessage.textContent = `Thank you, ${name}. Your consultation request has been sent to our team. We will be in touch shortly.`;
      formMessage.className = 'form-message success';
      form.reset();
    } catch {
      formMessage.textContent = 'Something went wrong. Please try again or contact us at venshaskin@gmail.com.';
      formMessage.className = 'form-message error';
    }
  });
}

/* ── Technology tabs ── */
const techData = {
  vacuum: {
    title: 'Negative pressure & roller',
    desc: 'Combines vacuum negative pressure with a double-helix electric roller (15 rpm). Enhances the kneading effect of subcutaneous fat by absorbing skin tissue and promotes deeper transmission of radio frequency energy.',
    image: 'assets/images/vacuumRoller-removebg-preview.png',
  },
  rf: {
    title: 'Radio frequency lifting',
    desc: 'Accurately heats the deep layer of the epidermis to destroy aging collagen fibers and stimulate the synthesis of new collagen, effectively improving wrinkles and skin texture.',
    image: 'assets/images/multiPolarRF-removebg-preview.png',
  },
  cavitation: {
    title: 'Cavitation fat reduction',
    desc: 'Uses 40kHz low-frequency ultrasound to support disruption of fat cells, assisting body contouring when combined with other modalities in a professional protocol.',
    image: 'assets/images/cavitation-removebg-preview.png',
  },
  infrared: {
    title: '940nm near-infrared light',
    desc: 'Increases blood flow by approximately 30% and activates aerobic metabolism of fat cells, preparing tissue for subsequent treatment steps.',
    image: 'assets/images/bipolarRF-removebg-preview.png',
  },
  synergy: {
    title: 'Full-dimensional synergy',
    desc: 'Deep fat reduction (ultrasound cavitation) → superficial metabolism (near-infrared light) → skin tightening (radio frequency) → circulation optimization (vacuum roller). Improves fat reduction efficiency and skin texture simultaneously.',
    image: 'assets/images/fullDimensionalEffect.png',
  },
};

const techTabs = document.querySelectorAll('.tech-tab');
const techTitle = document.getElementById('techTitle');
const techDesc = document.getElementById('techDesc');
const techImage = document.getElementById('techImage');

function updateTechContent(key) {
  const data = techData[key];
  if (!data) return;

  if (techTitle) techTitle.textContent = data.title;
  if (techDesc) techDesc.textContent = data.desc;
  if (techImage) techImage.src = data.image;

  /* ── Synergy tab: custom layout with banner image, single maximized div, no duplicate content ── */
  const techPanelEl = document.querySelector('.tech-panel');
  const visualWrapEl = document.querySelector('.tech-visual-wrap');
  const techContent = document.getElementById('techContent');

  if (key === 'synergy') {
    if (techPanelEl) techPanelEl.classList.add('is-synergy');
    if (visualWrapEl) visualWrapEl.style.display = 'none';

    /* Remove any existing synergy content */
    document.querySelectorAll('.tech-content .synergy-banner-wrap, .tech-content .synergy-image-row, .tech-content .synergy-stats, .tech-content .synergy-features').forEach((el) => el.remove());

    if (techContent) {
      const bannerWrap = document.createElement('div');
      bannerWrap.className = 'synergy-banner-wrap';
      bannerWrap.innerHTML = `<img src="assets/images/fullDimensionalEffect.png" alt="Full-Dimensional Synergy" class="synergy-banner-img" />`;
      techContent.insertBefore(bannerWrap, techContent.children[2]);
    }
  } else {
    if (techPanelEl) techPanelEl.classList.remove('is-synergy');
    if (visualWrapEl) visualWrapEl.style.display = '';
    document.querySelectorAll('.tech-content .synergy-banner-wrap, .tech-content .synergy-image-row, .tech-content .synergy-stats, .tech-content .synergy-features').forEach((el) => el.remove());
  }
}

techTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    techTabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    updateTechContent(tab.dataset.tech);
  });
});

/* ── Applicator cards → tech tab navigation ── */
document.querySelectorAll('.applicator-card').forEach((card) => {
  card.addEventListener('click', () => {
    const target = card.dataset.techTarget;
    if (!target) return;

    const matchingTab = document.querySelector(`.tech-tab[data-tech="${target}"]`);
    if (!matchingTab) return;

    /* scroll to the technologies section */
    const techSection = document.getElementById('technologies');
    if (techSection) {
      techSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    /* activate the matching tab after a brief delay so the user sees the transition */
    setTimeout(() => matchingTab.click(), 400);
  });
});

/* ═══════════════════════════════════════════
   ENHANCED INTERACTIVE ANIMATIONS
   ═══════════════════════════════════════════ */

/* ── 1. 3D Mouse-Tracking Tilt Effect on Cards ── */
function initTiltEffect() {
  const tiltCards = document.querySelectorAll(
    '.panel, .contact-card, .applicator-card, .inquiry-type-card, .stat-card, .expectation-stat, .synergy-stat-card, .synergy-feature-card, .tech-badge, .tech-feature, .benefit-icon'
  );

  tiltCards.forEach((card) => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const rotateX = ((y - centerY) / centerY) * -6;
      const rotateY = ((x - centerX) / centerX) * 6;

      card.style.setProperty('--tilt-x', `${rotateY}deg`);
      card.style.setProperty('--tilt-y', `${rotateX}deg`);
      card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
    });

    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

/* ── 2. Counter Animation for Stats ── */
function animateCounter(el, start, end, duration = 1500, suffix = '') {
  if (!el) return;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = current + suffix;
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      el.textContent = end + suffix;
    }
  }

  requestAnimationFrame(update);
}

function initCounterAnimations() {
  const statValues = document.querySelectorAll('.stat-value');
  const counters = [];

  statValues.forEach((el) => {
    const text = el.textContent.trim();
    const num = parseInt(text.replace(/[^0-9]/g, ''));
    const suffix = text.replace(/[0-9]/g, '');
    if (!isNaN(num)) {
      el.textContent = '0';
      counters.push({ el, target: num, suffix });
    }
  });

  if (!counters.length) return;

  const counterObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const idx = counters.findIndex((c) => c.el === entry.target);
          if (idx !== -1) {
            const c = counters[idx];
            animateCounter(c.el, 0, c.target, 1500, c.suffix);
            counterObserver.unobserve(entry.target);
          }
        }
      });
    },
    { threshold: 0.5 }
  );

  counters.forEach((c) => counterObserver.observe(c.el));
}

/* ── 3. Hero Parallax on Scroll ── */
function initHeroParallax() {
  const heroImage = document.querySelector('.hero-image');
  const heroSection = document.querySelector('.site-header');
  if (!heroImage || !heroSection) return;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    const sectionTop = heroSection.offsetTop;
    const sectionHeight = heroSection.offsetHeight;
    const relativeScroll = scrollY - sectionTop;

    if (relativeScroll >= 0 && relativeScroll <= sectionHeight) {
      const translateY = relativeScroll * 0.15;
      heroImage.style.transform = `translateY(${translateY}px)`;
    }
  }, { passive: true });
}

/* ── 4. Smooth Scroll for Anchor Links ── */
function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const targetId = anchor.getAttribute('href');
      if (!targetId || targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        const navHeight = document.getElementById('navShell')?.offsetHeight || 0;
        const targetPosition = target.getBoundingClientRect().top + window.scrollY - navHeight - 10;
        window.scrollTo({
          top: targetPosition,
          behavior: 'smooth',
        });
      }
    });
  });
}

/* ── 5. Booking Form Focus Glow ── */
function initFormInteractions() {
  const formInputs = document.querySelectorAll('.booking-form input, .booking-form select, .booking-form textarea');
  formInputs.forEach((input) => {
    input.addEventListener('focus', () => {
      const label = input.closest('label');
      if (label) label.style.color = 'var(--accent-dark)';
    });
    input.addEventListener('blur', () => {
      const label = input.closest('label');
      if (label) label.style.color = '';
    });
  });
}

/* ── Privacy Policy Modal ── */
function initPrivacyModal() {
  const modal = document.getElementById('privacyModal');
  const link = document.getElementById('privacyPolicyLink');
  const closeBtn = document.getElementById('privacyModalClose');
  if (!modal || !link) return;

  link.addEventListener('click', (e) => {
    e.preventDefault();
    modal.hidden = false;
  });

  function closeModal() {
    modal.hidden = true;
  }

  if (closeBtn) closeBtn.addEventListener('click', closeModal);

  modal.querySelector('.privacy-modal-backdrop')?.addEventListener('click', closeModal);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) closeModal();
  });
}

/* ── Initialize Everything ── */
document.addEventListener('DOMContentLoaded', () => {
  initTiltEffect();
  initCounterAnimations();
  initHeroParallax();
  initSmoothScroll();
  initFormInteractions();
  initPrivacyModal();
});
