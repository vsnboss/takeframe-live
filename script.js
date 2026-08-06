const modal = document.getElementById('demoModal');
const openers = document.querySelectorAll('[data-open-demo]');
const closers = document.querySelectorAll('[data-close-modal]');
const ticker = document.querySelector('.ticker-track');

openers.forEach(button => {
  button.addEventListener('click', () => {
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  });
});

closers.forEach(button => {
  button.addEventListener('click', () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }
});

const track = document.getElementById('graphicsTrack');
const prev = document.querySelector('.carousel-arrow.prev');
const next = document.querySelector('.carousel-arrow.next');

function cardWidth() {
  const first = track.querySelector('.graphic-card');
  if (!first) return 0;
  return first.getBoundingClientRect().width + 16;
}

if (prev && next && track) {
  prev.addEventListener('click', () => track.scrollBy({ left: -cardWidth(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: cardWidth(), behavior: 'smooth' }));
}

// Pause ticker on hover for easier reading.
if (ticker) {
  ticker.addEventListener('mouseenter', () => ticker.style.animationPlayState = 'paused');
  ticker.addEventListener('mouseleave', () => ticker.style.animationPlayState = 'running');
}
