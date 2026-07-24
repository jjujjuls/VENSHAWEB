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
    signInLink.textContent = 'Admin';
    signInLink.href = '/admin.html';
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

/* ── Scroll indicator ── */
const scrollIndicator = document.getElementById('scrollIndicator');
if (scrollIndicator) {
  scrollIndicator.addEventListener('click', () => {
    const target = document.getElementById('about') || document.getElementById('technologies');
    if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

/* ── Inquiry type toggling ── */
const inquiryCards = document.querySelectorAll('.inquiry-type-card');
const consultationFields = document.querySelectorAll('.form-group-consultation');
const purchaseFields = document.querySelectorAll('.form-group-purchase');
let currentInquiryType = 'consultation';

function updateInquiryFields() {
  if (currentInquiryType === 'consultation') {
    consultationFields.forEach(el => { el.style.display = ''; el.classList.remove('hidden'); });
    purchaseFields.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
    // Make treatment required for consultation
    const treatmentInput = document.querySelector('input[name="treatment"]');
    if (treatmentInput) treatmentInput.required = true;
  } else {
    consultationFields.forEach(el => { el.style.display = 'none'; el.classList.add('hidden'); });
    purchaseFields.forEach(el => { el.style.display = ''; el.classList.remove('hidden'); });
    // Treatment not required for purchase
    const treatmentInput = document.querySelector('input[name="treatment"]');
    if (treatmentInput) treatmentInput.required = false;
  }
}

inquiryCards.forEach(card => {
  card.addEventListener('click', () => {
    inquiryCards.forEach(c => c.classList.remove('active'));
    card.classList.add('active');
    currentInquiryType = card.dataset.type;
    updateInquiryFields();
  });
});

// Initialize field visibility
updateInquiryFields();

/* ── Treatment chip multi-select ── */
const treatmentChips = document.querySelectorAll('.treatment-chip');
const treatmentInput = document.querySelector('input[name="treatment"]');

treatmentChips.forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('selected');
    const selected = [...document.querySelectorAll('.treatment-chip.selected')].map(c => c.dataset.value);
    if (treatmentInput) treatmentInput.value = selected.join(', ');
  });
});

/* ── Character counter ── */
const messageField = document.querySelector('textarea[name="message"]');
const charCount = document.getElementById('charCount');
if (messageField && charCount) {
  messageField.addEventListener('input', () => {
    charCount.textContent = messageField.value.length;
  });
}

/* ── Form submission ── */
if (form) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const phone = data.get('phone')?.toString().trim() || '';

    if (!name || !email || !phone) {
      formMessage.textContent = 'Please complete the required fields.';
      formMessage.className = 'form-message error';
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) { submitBtn.classList.add('is-loading'); submitBtn.textContent = 'Sending…'; }
    formMessage.textContent = 'Sending your request…';
    formMessage.className = 'form-message';

    let endpoint, payload;

    if (currentInquiryType === 'consultation') {
      const treatment = data.get('treatment')?.toString().trim() || '';
      if (!treatment) {
        formMessage.textContent = 'Please select at least one treatment area.';
        formMessage.className = 'form-message error';
        if (submitBtn) { submitBtn.classList.remove('is-loading'); submitBtn.textContent = originalText; }
        return;
      }
      endpoint = '/api/consultations';
      payload = {
        name, email, phone, treatment,
        date: data.get('date')?.toString() || '',
        time: data.get('time')?.toString() || '',
        message: data.get('message')?.toString().trim() || '',
      };
    } else {
      endpoint = '/api/machine-inquiries';
      payload = {
        name, email, phone,
        companyName: data.get('companyName')?.toString().trim() || '',
        businessName: data.get('businessName')?.toString().trim() || '',
        businessType: data.get('businessType')?.toString().trim() || '',
        purchaseTimeline: data.get('purchaseTimeline')?.toString().trim() || '',
        message: data.get('message')?.toString().trim() || '',
      };
    }

    try {
      const apiBase = window.VENSHA_API || '';
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const successMsg = currentInquiryType === 'consultation'
          ? `Thank you, ${name}. Your consultation request has been sent. We will be in touch shortly.`
          : `Thank you, ${name}. Your machine purchase inquiry has been received. A specialist will contact you shortly.`;
        formMessage.textContent = successMsg;
        formMessage.className = 'form-message success';
        if (submitBtn) { submitBtn.classList.remove('is-loading'); submitBtn.classList.add('is-success'); submitBtn.textContent = '✓ Request Sent'; }
        form.reset();
        // Reset chips
        treatmentChips.forEach(c => c.classList.remove('selected'));
        if (treatmentInput) treatmentInput.value = '';
        if (charCount) charCount.textContent = '0';
        // Reset to consultation type
        inquiryCards.forEach(c => c.classList.remove('active'));
        document.querySelector('.inquiry-type-card[data-type="consultation"]')?.classList.add('active');
        currentInquiryType = 'consultation';
        updateInquiryFields();
        setTimeout(() => { if (submitBtn) { submitBtn.classList.remove('is-success'); submitBtn.textContent = originalText; } }, 3000);
        return;
      }
    } catch { /* fall through to FormSubmit fallback */ }

    try {
      const fallback = new FormData();
      Object.entries(payload).forEach(([key, value]) => fallback.append(key, value));
      fallback.append('_subject', currentInquiryType === 'consultation' ? 'New Consultation Request — VENSHASKIN' : 'New Machine Purchase Inquiry — VENSHASKIN');
      fallback.append('_template', 'table');
      fallback.append('_captcha', 'false');
      const response = await fetch('https://formsubmit.co/ajax/venshaskin@gmail.com', { method: 'POST', body: fallback, headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error('Submission failed');
      formMessage.textContent = `Thank you, ${name}. Your request has been sent. We will be in touch shortly.`;
      formMessage.className = 'form-message success';
      if (submitBtn) { submitBtn.classList.remove('is-loading'); submitBtn.classList.add('is-success'); submitBtn.textContent = '✓ Request Sent'; }
      form.reset();
      treatmentChips.forEach(c => c.classList.remove('selected'));
      if (treatmentInput) treatmentInput.value = '';
      if (charCount) charCount.textContent = '0';
      setTimeout(() => { if (submitBtn) { submitBtn.classList.remove('is-success'); submitBtn.textContent = originalText; } }, 3000);
    } catch {
      formMessage.textContent = 'Something went wrong. Please try again or contact us at venshaskin@gmail.com.';
      formMessage.className = 'form-message error';
      if (submitBtn) { submitBtn.classList.remove('is-loading'); submitBtn.textContent = originalText; }
    }
  });
}

/* ── Technology tabs ── */
const techData = {
  vacuum: {
    title: 'Negative Pressure & Roller',
    desc: 'Combines vacuum negative pressure with a double-helix electric roller for enhanced fat kneading and deeper RF energy transmission.',
    image: 'assets/images/vacuumRoller-removebg-preview.png',
    badges: [
      { value: '15 RPM', label: 'Roller Speed' },
      { value: '80 KPa', label: 'Vacuum Power' },
    ],
    features: [
      { title: 'Double Helix Roller', desc: '15 RPM massage' },
      { title: 'Negative Pressure', desc: 'Improves lymphatic drainage' },
      { title: 'RF Penetration', desc: 'Enhances thermal delivery' },
      { title: 'Fat Kneading', desc: 'Targets stubborn fat' },
    ],
  },
  rf: {
    title: 'Radio Frequency Lifting',
    desc: 'Accurately heats the deep layer of the epidermis to destroy aging collagen fibers and stimulate the synthesis of new collagen.',
    image: 'assets/images/multiPolarRF-removebg-preview.png',
    badges: [
      { value: '1 MHz', label: 'RF Frequency' },
      { value: 'Multi-Polar', label: 'Electrode Config' },
    ],
    features: [
      { title: 'Deep Heating', desc: 'Targets epidermal layers' },
      { title: 'Collagen Synthesis', desc: 'Stimulates new production' },
      { title: 'Wrinkle Improvement', desc: 'Smooths fine lines' },
      { title: 'Skin Texture', desc: 'Refines overall quality' },
    ],
  },
  cavitation: {
    title: 'Cavitation Fat Reduction',
    desc: 'Uses 40kHz low-frequency ultrasound to support disruption of fat cells, assisting body contouring in a professional protocol.',
    image: 'assets/images/cavitation-removebg-preview.png',
    badges: [
      { value: '40 kHz', label: 'Ultrasound Freq' },
      { value: 'Low-Freq', label: 'Wave Type' },
    ],
    features: [
      { title: 'Fat Disruption', desc: 'Breaks down fat cells' },
      { title: 'Body Contouring', desc: 'Shapes target areas' },
      { title: 'Non-Invasive', desc: 'No surgical intervention' },
      { title: 'Deep Penetration', desc: 'Reaches subcutaneous layer' },
    ],
  },
  infrared: {
    title: '940nm Near-Infrared Light',
    desc: 'Increases blood flow by approximately 30% and activates aerobic metabolism of fat cells, preparing tissue for subsequent treatment.',
    image: 'assets/images/bipolarRF-removebg-preview.png',
    badges: [
      { value: '940 nm', label: 'Wavelength' },
      { value: '12W', label: 'LED Power' },
    ],
    features: [
      { title: 'Blood Flow', desc: '+30% circulation boost' },
      { title: 'Fat Metabolism', desc: 'Activates aerobic process' },
      { title: 'Tissue Prep', desc: 'Optimizes for treatment' },
      { title: 'Skin Tightening', desc: 'Promotes collagen response' },
    ],
  },
  synergy: {
    title: 'Full-Dimensional Synergy',
    desc: 'All five technologies work together: deep fat reduction, superficial metabolism, skin tightening, and circulation optimization.',
    image: 'assets/images/synergy-infographic.jpg',
    badges: [
      { value: '5-in-1', label: 'Technology' },
      { value: '800W', label: 'Maximum Output' },
    ],
    features: [
      { title: 'Fat Reduction', desc: 'Ultrasound cavitation' },
      { title: 'Metabolism Boost', desc: 'Near-infrared light' },
      { title: 'Skin Tightening', desc: 'Radio frequency' },
      { title: 'Circulation', desc: 'Vacuum roller optimization' },
    ],
  },
};

/* ── Applicator card click handlers ── */
const applicatorCards = document.querySelectorAll('.applicator-card');

applicatorCards.forEach((card) => {
  card.addEventListener('click', (e) => {
    // Check if the click was on a link or button inside the card
    const target = e.target;
    if (target.closest('a') || target.closest('button')) {
      return; // Let the link/button handle the click
    }
    
    const techTarget = card.dataset.techTarget;
    if (!techTarget) return;
    
    // Navigate to the technologies section
    const techSection = document.getElementById('technologies');
    if (techSection) {
      // Activate the corresponding tech tab
      techTabs.forEach((t) => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      
      const targetTab = document.querySelector(`.tech-tab[data-tech="${techTarget}"]`);
      if (targetTab) {
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-selected', 'true');
        
        // Update tech content
        updateTechContent(techTarget);
        
        // Scroll to the technologies section
        techSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  });
});

const techTabs = document.querySelectorAll('.tech-tab');
const techTitle = document.getElementById('techTitle');
const techDesc = document.getElementById('techDesc');
const techImage = document.getElementById('techImage');
const techBadges = document.getElementById('techBadges');
const techFeatures = document.getElementById('techFeatures');
const techContent = document.getElementById('techContent');

function updateTechContent(key) {
  const data = techData[key];
  if (!data) return;

  // Trigger animation
  if (techContent) {
    techContent.classList.remove('is-animating');
    void techContent.offsetWidth; // force reflow
    techContent.classList.add('is-animating');
  }

  const visualWrap = document.querySelector('.tech-visual-wrap');
  if (visualWrap) {
    visualWrap.classList.remove('is-animating');
    void visualWrap.offsetWidth;
    visualWrap.classList.add('is-animating');
  }

  // Update title & description
  if (techTitle) techTitle.textContent = data.title;
  if (techDesc) techDesc.textContent = data.desc;
  if (techImage) {
    techImage.src = data.image;
    techImage.alt = data.title;
  }

  // Update badges
  if (techBadges && data.badges) {
    techBadges.innerHTML = data.badges
      .map(
        (b) => `
      <div class="tech-badge">
        <span class="tech-badge-value">${b.value}</span>
        <span class="tech-badge-label">${b.label}</span>
      </div>`
      )
      .join('');
  }

  // Update features
  if (techFeatures && data.features) {
    techFeatures.innerHTML = data.features
      .map(
        (f) => `
      <div class="tech-feature">
        <span class="tech-feature-check">✓</span>
        <div>
          <strong>${f.title}</strong>
          <span>${f.desc}</span>
        </div>
      </div>`
      )
      .join('');
  }

  // Show original collage image below main image for synergy tab
  const visualWrapEl = document.querySelector('.tech-visual-wrap');
  if (visualWrapEl) {
    const existingCollage = visualWrapEl.querySelector('.synergy-collage');
    if (existingCollage) existingCollage.remove();

    if (key === 'synergy') {
      const collageImg = document.createElement('img');
      collageImg.src = 'assets/images/fullDimensionalEffect.png';
      collageImg.alt = 'Five technologies working together';
      collageImg.className = 'synergy-collage';
      collageImg.style.cssText = 'position:relative;z-index:1;width:100%;max-height:220px;object-fit:contain;margin-top:16px;border-radius:12px;opacity:0;transition:opacity 0.5s ease;';
      visualWrapEl.appendChild(collageImg);
      requestAnimationFrame(() => { collageImg.style.opacity = '1'; });
    }
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

/* ── Interactive donut chart ── */
const segments = [
  { id: '68', value: 68, label: '10%+ result', color: '#b8cdd9' },
  { id: '29', value: 29, label: '5–10% result', color: '#c4b8d9' },
  { id: '3', value: 3, label: '<5% result', color: '#d9d4b8' },
];

const RING = 440;
const circumference = 2 * Math.PI * 70;
let offset = 0;

const donutSegments = document.querySelectorAll('.donut-segment');
const chartLegend = document.getElementById('chartLegend');
const donutCenter = document.querySelector('.donut-center');
const donutCenterSub = document.querySelector('.donut-center-sub');

function highlightSegment(id) {
  donutSegments.forEach((seg) => seg.classList.toggle('active', seg.dataset.segment === id));
  chartLegend?.querySelectorAll('li').forEach((li) => {
    li.classList.toggle('active', li.dataset.segment === id);
  });

  const seg = segments.find((s) => s.id === id);
  if (seg && donutCenter && donutCenterSub) {
    donutCenter.textContent = `${seg.value}%`;
    donutCenterSub.textContent = seg.label;
  }
}

/* ── Donut chart: start hidden, animate on scroll ── */
const donutChartSection = document.getElementById('results');
let donutAnimated = false;

// Initially hide segments (0 dasharray)
donutSegments.forEach((el) => {
  el.setAttribute('stroke-dasharray', '0 ' + circumference);
});

function animateDonut() {
  if (donutAnimated) return;
  donutAnimated = true;
  let currentOffset = 0;

  segments.forEach((seg, i) => {
    const el = donutSegments[i];
    if (!el) return;

    const dash = (seg.value / 100) * circumference;
    el.setAttribute('stroke', seg.color);

    // Animate after a staggered delay
    setTimeout(() => {
      el.style.transition = 'stroke-dasharray 1s cubic-bezier(0.22, 1, 0.36, 1)';
      el.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
      el.setAttribute('stroke-dashoffset', `-${currentOffset}`);
    }, i * 200);

    currentOffset += dash;

    el.addEventListener('mouseenter', () => highlightSegment(seg.id));
    el.addEventListener('click', () => highlightSegment(seg.id));
  });

  // Animate center number
  if (donutCenter) {
    animateCounter(donutCenter, 0, 68, 1000, '%');
  }
}

// Observe the results section
if (donutChartSection) {
  const donutObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateDonut();
          donutObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  donutObserver.observe(donutChartSection);
}

chartLegend?.querySelectorAll('li').forEach((li) => {
  li.addEventListener('mouseenter', () => highlightSegment(li.dataset.segment));
  li.addEventListener('click', () => highlightSegment(li.dataset.segment));
});

/* ═══════════════════════════════════════════
   ENHANCED INTERACTIVE ANIMATIONS
   ═══════════════════════════════════════════ */

/* ── 1. 3D Mouse-Tracking Tilt Effect on Cards ── */
function initTiltEffect() {
  const tiltCards = document.querySelectorAll(
    '.panel, .contact-card, .applicator-card, .inquiry-type-card, .stat-card, .expectation-stat'
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
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
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

/* ── 4. Smooth Counter for Donut Center ── */
/* (uses animateCounter defined above) */

/* ── 5. Staggered Entrance on Reveal ── */
function initStaggeredReveal() {
  document.querySelectorAll('.reveal').forEach((section) => {
    const children = section.querySelectorAll(
      '.applicators-grid > *, .benefit-icons > *, .features-grid > *, .tech-bottom-grid > *, .expectation-stats > *'
    );
    if (children.length > 1) {
      children.forEach((child, i) => {
        child.style.opacity = '0';
        child.style.transform = 'translateY(20px)';
        child.style.transition = `opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.08}s, transform 0.5s cubic-bezier(0.22, 1, 0.36, 1) ${i * 0.08}s`;
      });
    }
  });

  // Use the existing reveal observer to trigger staggered animations
  const revealObserver = new MutationObserver(() => {
    document.querySelectorAll('.reveal.is-visible').forEach((section) => {
      const children = section.querySelectorAll(
        '.applicators-grid > *, .benefit-icons > *, .features-grid > *, .tech-bottom-grid > *, .expectation-stats > *'
      );
      children.forEach((child) => {
        child.style.opacity = '';
        child.style.transform = '';
      });
    });
  });

  document.querySelectorAll('.reveal').forEach((el) => {
    revealObserver.observe(el, { attributes: true, attributeFilter: ['class'] });
  });
}

/* ── 6. Booking Form Card Active Pulse ── */
function initFormInteractions() {
  const formInputs = document.querySelectorAll('.booking-form input, .booking-form select, .booking-form textarea');
  formInputs.forEach((input) => {
    input.addEventListener('focus', () => {
      const label = input.closest('label');
      if (label) {
        label.style.color = 'var(--accent-dark)';
      }
    });
    input.addEventListener('blur', () => {
      const label = input.closest('label');
      if (label) {
        label.style.color = '';
      }
    });
  });
}

/* ── 7. Smooth Scroll for All Anchor Links ── */
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

/* ── Initialize Everything ── */
document.addEventListener('DOMContentLoaded', () => {
  initTiltEffect();
  initCounterAnimations();
  initHeroParallax();
  initStaggeredReveal();
  initFormInteractions();
  initSmoothScroll();
});

highlightSegment('68');

/* ── Animated counter utility ── */
function animateCounter(el, start, end, duration, suffix = '') {
  if (!el) return;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    el.textContent = end + suffix;
    return;
  }

  const startTime = performance.now();
  function update(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);
    el.textContent = current + suffix;
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

/* ── Animate all stat values on scroll ── */
function animateStats() {
  const statValues = document.querySelectorAll('.stat-value');
  statValues.forEach((el) => {
    if (el.dataset.counted) return;
    const text = el.textContent.trim();
    const match = text.match(/^(\d+)(%?)$/);
    if (match) {
      el.dataset.counted = 'true';
      animateCounter(el, 0, parseInt(match[1]), 1200, match[2] || '');
    }
  });
}

if (donutChartSection) {
  const statsObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateStats();
          statsObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  statsObserver.observe(donutChartSection);
}

/* ── Body map hotspots ── */
const hotspotData = {
  firm: { value: '+82%', label: 'Firm Skin', detail: 'Collagen stimulation · 2–3 sessions' },
  waist: { value: '−3cm', label: 'Waist Circumference', detail: 'Fat reduction · 4–6 sessions' },
  hip: { value: '−3cm', label: 'Hip Circumference', detail: 'Body contouring · 4–6 sessions' },
  cellulite: { value: '−85%', label: 'Cellulite', detail: 'Skin smoothing · 6–8 sessions' },
};

const hotspots = document.querySelectorAll('.hotspot');
const hotspotDetail = document.getElementById('hotspotDetail');

function showHotspot(id) {
  hotspots.forEach((h) => h.classList.toggle('active', h.dataset.hotspot === id));
  const data = hotspotData[id];
  if (data && hotspotDetail) {
    hotspotDetail.querySelector('.hotspot-detail-value').textContent = data.value;
    hotspotDetail.querySelector('.hotspot-detail-label').textContent = data.label;
  }
}

hotspots.forEach((spot) => {
  spot.addEventListener('mouseenter', () => showHotspot(spot.dataset.hotspot));
  spot.addEventListener('focus', () => showHotspot(spot.dataset.hotspot));
  spot.addEventListener('click', () => showHotspot(spot.dataset.hotspot));
});

showHotspot('firm');

/* ── Before/After image slider ── */
document.querySelectorAll('.ba-slider').forEach((slider) => {
  const handle = slider.querySelector('.ba-handle');
  const afterWrap = slider.querySelector('.ba-after');
  if (!handle || !afterWrap) return;

  let isDragging = false;

  function setPosition(x) {
    const rect = slider.getBoundingClientRect();
    let pct = ((x - rect.left) / rect.width) * 100;
    pct = Math.max(5, Math.min(95, pct));
    afterWrap.style.clipPath = `inset(0 0 0 ${pct}%)`;
    handle.style.left = pct + '%';
  }

  handle.addEventListener('mousedown', () => { isDragging = true; });
  handle.addEventListener('touchstart', () => { isDragging = true; }, { passive: true });

  window.addEventListener('mousemove', (e) => {
    if (isDragging) { e.preventDefault(); setPosition(e.clientX); }
  });
  window.addEventListener('touchmove', (e) => {
    if (isDragging) setPosition(e.touches[0].clientX);
  }, { passive: true });

  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('touchend', () => { isDragging = false; });

  // Click to set position
  slider.addEventListener('click', (e) => setPosition(e.clientX));
});

