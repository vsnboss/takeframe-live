/* TAKEFRAME LIVE — approved composition runtime */
(() => {
  'use strict';

  const root = document.documentElement;
  const REF_W = 941;        // approved reference width
  const FLOW_BP = 900;      // below this the canvas is released into flow layout

  /* -- canvas scale ---------------------------------------------------------
     The approved composition is authored at 941px. On desktop it scales 1:1
     with the viewport so it always fills the available width — no gutters, no
     arbitrary cap. Below FLOW_BP the stylesheet takes over with a real stacked
     layout, so the scale variable is parked at 1.                            */
  const applyScale = () => {
    const w = document.documentElement.clientWidth || window.innerWidth;
    root.style.setProperty('--s', w < FLOW_BP ? '1' : String(w / REF_W));
  };
  applyScale();
  window.addEventListener('resize', applyScale, { passive: true });
  window.addEventListener('orientationchange', applyScale);

  /* -- mobile navigation --------------------------------------------------- */
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

  /* -- demo modal ---------------------------------------------------------- */
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

  document.querySelectorAll('.js-demo').forEach((btn) =>
    btn.addEventListener('click', () => openModal(btn))
  );
  modal?.querySelector('.js-close')?.addEventListener('click', closeModal);
  modal?.addEventListener('close', () => opener?.focus());
  /* click on the backdrop (outside the dialog box) closes it */
  modal?.addEventListener('click', (e) => {
    if (e.target !== modal) return;
    const r = modal.getBoundingClientRect();
    const outside =
      e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    if (outside) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNav();
  });

  /* -- demo form ----------------------------------------------------------- */
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
    const body = encodeURIComponent(
      [
        `Name: ${d.get('name')}`,
        `Email: ${d.get('email')}`,
        `Company: ${d.get('company')}`,
        '',
        'Request: TAKEFRAME LIVE demo / next match review.',
      ].join('\n')
    );
    if (status) {
      status.className = '';
      status.textContent = 'Opening your email application…';
    }
    window.location.href = `mailto:office@vsn.hr?subject=${subject}&body=${body}`;
  });

  /* -- in-page anchors ------------------------------------------------------
     The desktop canvas is transform-scaled, so let the browser resolve anchor
     offsets natively (it accounts for the transform) and only guard against a
     missing target.                                                          */
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
        block: 'start',
      });
      history.replaceState(null, '', id);
    });
  });
})();
