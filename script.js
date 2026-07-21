const toggle = document.querySelector('.menu-toggle');
const mobileMenu = document.getElementById('mobileMenu');
const form = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const reveals = document.querySelectorAll('.reveal');

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
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = data.get('name')?.toString().trim() || '';
    const email = data.get('email')?.toString().trim() || '';
    const phone = data.get('phone')?.toString().trim() || '';

    if (!name || !email || !phone) {
      formMessage.textContent = 'Please complete the required fields so we can contact you.';
      return;
    }

    formMessage.textContent = `Thank you, ${name}. Your consultation request has been received and our team will be in touch shortly.`;
    form.reset();
  });
}

/* ── Technology tabs ── */
const techData = {
  vacuum: {
    title: 'Negative pressure & roller',
    desc: 'Combines vacuum negative pressure with a double-helix electric roller (15 rpm). Enhances the kneading effect of subcutaneous fat by absorbing skin tissue and promotes deeper transmission of radio frequency energy.',
    image: 'assets/images/vacuum-roller.png',
  },
  rf: {
    title: 'Radio frequency lifting',
    desc: 'Accurately heats the deep layer of the epidermis to destroy aging collagen fibers and stimulate the synthesis of new collagen, effectively improving wrinkles and skin texture.',
    image: 'assets/images/multipolar-rf.png',
  },
  cavitation: {
    title: 'Cavitation fat reduction',
    desc: 'Uses 40kHz low-frequency ultrasound to support disruption of fat cells, assisting body contouring when combined with other modalities in a professional protocol.',
    image: 'assets/images/cavitation.png',
  },
  infrared: {
    title: '940nm near-infrared light',
    desc: 'Increases blood flow by approximately 30% and activates aerobic metabolism of fat cells, preparing tissue for subsequent treatment steps.',
    image: 'assets/images/bipolar-rf.png',
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
      if (techImage && data.image) {
        techImage.src = data.image;
        techImage.alt = data.title;
      }
    }
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

segments.forEach((seg, i) => {
  const el = donutSegments[i];
  if (!el) return;

  const dash = (seg.value / 100) * circumference;
  el.setAttribute('stroke-dasharray', `${dash} ${circumference - dash}`);
  el.setAttribute('stroke-dashoffset', `-${offset}`);
  el.setAttribute('stroke', seg.color);
  offset += dash;

  el.addEventListener('mouseenter', () => highlightSegment(seg.id));
  el.addEventListener('click', () => highlightSegment(seg.id));
});

chartLegend?.querySelectorAll('li').forEach((li) => {
  li.addEventListener('mouseenter', () => highlightSegment(li.dataset.segment));
  li.addEventListener('click', () => highlightSegment(li.dataset.segment));
});

highlightSegment('68');

/* ── Body map hotspots ── */
const hotspotData = {
  firm: { value: '+82%', label: 'Firm Skin' },
  waist: { value: '−3cm', label: 'Waist Circumference' },
  hip: { value: '−3cm', label: 'Hip Circumference' },
  cellulite: { value: '−85%', label: 'Cellulite' },
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
