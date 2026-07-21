const toggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
const nav = document.querySelector('.nav');
const form = document.getElementById('bookingForm');
const formMessage = document.getElementById('formMessage');
const reveals = document.querySelectorAll('.reveal');

if (toggle && navLinks) {
  toggle.addEventListener('click', () => {
    navLinks.classList.toggle('open');
  });
}

window.addEventListener('scroll', () => {
  if (nav) {
    nav.classList.toggle('nav--scrolled', window.scrollY > 18);
  }
});

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
    { threshold: 0.2 }
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
