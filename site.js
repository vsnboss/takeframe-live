const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');
if (menuButton && nav) {
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));
}

const revealItems = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
revealItems.forEach((item) => observer.observe(item));

const consoleButtons = document.querySelectorAll('.console-controls button');
consoleButtons.forEach((button) => button.addEventListener('click', () => {
  consoleButtons.forEach((item) => item.classList.remove('active'));
  button.classList.add('active');
}));

const carousel = document.querySelector('[data-carousel]');
if (carousel) {
  const track = carousel.querySelector('.graphics-track');
  const prev = carousel.querySelector('.prev');
  const next = carousel.querySelector('.next');
  const move = (direction) => track.scrollBy({ left: direction * Math.max(240, track.clientWidth * 0.7), behavior: 'smooth' });
  prev?.addEventListener('click', () => move(-1));
  next?.addEventListener('click', () => move(1));
}

const dialog = document.querySelector('#demo-modal');
document.querySelectorAll('[data-open-demo]').forEach((button) => button.addEventListener('click', () => {
  if (typeof dialog.showModal === 'function') dialog.showModal();
}));

dialog?.addEventListener('click', (event) => {
  const rect = dialog.getBoundingClientRect();
  const inside = event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
  if (!inside) dialog.close();
});

const demoForm = document.querySelector('#demo-form');
demoForm?.addEventListener('submit', (event) => {
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const data = new FormData(demoForm);
  const subject = encodeURIComponent(`TAKEFRAME demo request — ${data.get('company') || 'New enquiry'}`);
  const body = encodeURIComponent([
    `Name: ${data.get('name') || ''}`,
    `Company: ${data.get('company') || ''}`,
    `Email: ${data.get('email') || ''}`,
    `Production type: ${data.get('type') || ''}`,
    '',
    data.get('message') || ''
  ].join('\n'));
  window.location.href = `mailto:office@vsn.hr?subject=${subject}&body=${body}`;
  dialog.close();
});
