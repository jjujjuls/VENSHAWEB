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

/* Show "My account" in nav when signed in */
try {
  const stored = JSON.parse(localStorage.getItem('vensha_user') || 'null');
  const signInLink = document.querySelector('.nav-signin');
  if (stored && signInLink) {
    signInLink.textContent = 'Account';
    signInLink.href = stored.role === 'ADMIN' ? '/admin.html' : '/account.html';
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

techTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    techTabs.forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    const data = techData[tab.dataset.tech];
    if (data && techTitle && techDesc) {
      techTitle.textContent = data.title;
      techDesc.textContent = data.desc;
      if (techImage) techImage.src = data.image;
    }
  });
});
