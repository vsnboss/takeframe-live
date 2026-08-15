/* TAKEFRAME LIVE — approved composition runtime */
(() => {
  'use strict';

  const root = document.documentElement;
  const REF_W = 941;
  const FLOW_BP = 900;

  const applyScale = () => {
    const w = document.documentElement.clientWidth || window.innerWidth;
    root.style.setProperty('--s', w < FLOW_BP ? '1' : String(w / REF_W));
  };
  applyScale();
  window.addEventListener('resize', applyScale, { passive: true });
  window.addEventListener('orientationchange', applyScale);

  const nav = document.querySelector('.mainnav');
  const toggle = document.querySelector('.menu-toggle');
  const closeNav = () => {
    nav?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    toggle?.setAttribute('aria-label', 'Open navigation');
  };
  toggle?.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
  });
  nav?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeNav));

  const modal = document.querySelector('#demo');
  let opener = null;
  const openModal = (btn) => {
    if (!modal) return;
    opener = btn || null;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
    modal.querySelector('input')?.focus();
  };
  const closeModal = () => {
    if (!modal) return;
    if (typeof modal.close === 'function') modal.close();
    else modal.removeAttribute('open');
  };
  document.querySelectorAll('.js-demo').forEach((btn) => btn.addEventListener('click', () => openModal(btn)));
  modal?.querySelector('.js-close')?.addEventListener('click', closeModal);
  modal?.addEventListener('close', () => opener?.focus());
  modal?.addEventListener('click', (e) => {
    if (e.target !== modal) return;
    const r = modal.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });

  const form = document.querySelector('#demo-form');
  const status = document.querySelector('#demo-status');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.reportValidity()) {
      if (status) {
        status.className = 'err';
        status.textContent = 'Please complete every field with a valid work email.';
      }
      return;
    }
    const d = new FormData(form);
    const subject = encodeURIComponent(`TAKEFRAME demo request — ${d.get('company')}`);
    const body = encodeURIComponent([
      `Name: ${d.get('name')}`,
      `Email: ${d.get('email')}`,
      `Company: ${d.get('company')}`,
      '',
      'Request: TAKEFRAME LIVE demo / next match review.'
    ].join('\n'));
    if (status) {
      status.className = '';
      status.textContent = 'Opening your email application…';
    }
    window.location.href = `mailto:office@vsn.hr?subject=${subject}&body=${body}`;
  });

  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start'
      });
      history.replaceState(null, '', id);
    });
  });

  /* Exact uploaded NK Osijek formation, embedded directly so the card has no asset/fetch dependency. */
  const FORMATION_IMAGE = 'data:image/jpeg;base64,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[... ELLIPSIZATION ...]';

    body.innerHTML = '';
    body.style.padding = '0';
    body.style.overflow = 'hidden';
    body.style.background = '#06111d';

    const img = document.createElement('img');
    img.src = FORMATION_IMAGE;
    img.alt = 'NK Osijek final formation';
    img.decoding = 'sync';
    img.loading = 'eager';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    body.appendChild(img);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installRealFormationGraphic, { once: true });
  } else {
    installRealFormationGraphic();
  }
})();