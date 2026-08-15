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

  /* Replace ONLY the NORDIC1 "STARTING XI" card body with the supplied real formation screenshot. */
  const installRealFormationGraphic = async () => {
    const card = document.querySelector('#graphics .gfx-row .gfx:nth-of-type(2)');
    const body = card?.querySelector('.gfx-body');
    if (!card || !body) return;

    try {
      const response = await fetch('/assets/real-data/formation-1.txt?v=2', { cache: 'no-store' });
      if (!response.ok) throw new Error(`formation asset unavailable (${response.status})`);

      const encoded = (await response.text()).replace(/\s+/g, '');
      if (!encoded) throw new Error('formation asset is empty');

      body.innerHTML = '';
      body.style.padding = '0';
      body.style.overflow = 'hidden';

      const img = document.createElement('img');
      img.src = `data:image/jpeg;base64,${encoded}`;
      img.alt = 'Real NK Osijek final formation graphic';
      img.decoding = 'async';
      img.loading = 'eager';
      img.style.display = 'block';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.objectPosition = 'center';
      body.appendChild(img);
    } catch (err) {
      console.error('TAKEFRAME: formation graphic could not be loaded.', err);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installRealFormationGraphic, { once: true });
  } else {
    installRealFormationGraphic();
  }
})();
