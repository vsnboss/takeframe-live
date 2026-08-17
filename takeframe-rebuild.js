/* TAKEFRAME LIVE — approved composition runtime */
(() => {
  'use strict';

  const root = document.documentElement;
  const REF_W = 941;
  const FLOW_BP = 900;
  const REAL_SPRITE = '/assets/real-content-sprite.webp?v=1';

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

  const spritePos = (index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return `${col * 50}% ${row * (100 / 3)}%`;
  };

  const makeRealShot = (index, label, extraClass = '') => {
    const shot = document.createElement('div');
    shot.className = `real-shot ${extraClass}`.trim();
    shot.setAttribute('role', 'img');
    shot.setAttribute('aria-label', label);
    shot.style.backgroundImage = `url('${REAL_SPRITE}')`;
    shot.style.backgroundSize = '300% 400%';
    shot.style.backgroundPosition = spritePos(index);
    return shot;
  };

  const installRuntimeStyles = () => {
    if (document.querySelector('#real-product-content-styles')) return;
    const style = document.createElement('style');
    style.id = 'real-product-content-styles';
    style.textContent = `
      .real-shot{width:100%;height:100%;background-repeat:no-repeat;background-color:#020712}
      .hero .sb,.hero .xi,.hero .pcard{overflow:hidden;padding:0;background:#020712}
      .hero .sb .real-shot,.hero .xi .real-shot,.hero .pcard .real-shot{position:absolute;inset:0}
      .hero .sb .real-shot{background-size:300% 400%;}
      .hero .xi .real-shot{background-size:300% 400%;}
      .hero .pcard .real-shot{background-size:300% 400%;}
      .real-ui{position:absolute;inset:0;background-repeat:no-repeat;background-size:300% 400%;background-color:#020712}
      .ui.real-product-ui{position:relative;background:#020712;border-color:#235f89}
      .gfx .gfx-body.real-gfx-body{margin:0;height:98px;overflow:hidden;border-radius:2px;background:#020712}
      .gfx .real-shot{background-size:300% 400%;}
      .gfx.real-content-card{background:linear-gradient(170deg,rgba(7,22,37,.98),rgba(3,10,18,.99))}
      .gfx.real-content-card h4{position:relative;z-index:2}
      @media(max-width:900px){
        .hero .sb,.hero .xi,.hero .pcard{min-height:180px}
        .ui.real-product-ui{min-height:330px}
        .real-ui{background-size:cover!important;background-position:center!important}
        .gfx .gfx-body.real-gfx-body{height:210px}
        .gfx .real-shot{background-size:cover!important;background-position:center!important}
      }
    `;
    document.head.appendChild(style);
  };

  const replaceHeroSupportCards = () => {
    const heroPlayer = document.querySelector('.hero-player');
    if (!heroPlayer) return;

    const replacements = [
      ['.hero .sb', 0, 'Real TAKEFRAME LIVE match header — Shakhtar vs Osijek'],
      ['.hero .xi', 1, 'Real TAKEFRAME CONTROL Team Sheet — Shakhtar formation'],
      ['.hero .pcard', 2, 'Real TAKEFRAME player identification — Kiril Fesiun']
    ];
    replacements.forEach(([selector, index, label]) => {
      const card = document.querySelector(selector);
      if (!card) return;
      card.innerHTML = '';
      card.appendChild(makeRealShot(index, label));
    });
  };

  const replaceControlRoom = () => {
    const ui = document.querySelector('#output .ui');
    if (!ui) return;
    ui.classList.add('real-product-ui');
    ui.innerHTML = '';
    const shot = makeRealShot(3, 'Real TAKEFRAME CONTROL LIVE screen with Program, Preview, match actions and match phases', 'real-ui');
    ui.appendChild(shot);
  };

  const replaceGraphicsCards = () => {
    const cards = [...document.querySelectorAll('#graphics .gfx-row .gfx')];
    const real = [
      { title: 'SCOREBUG', index: 6, label: 'Real TAKEFRAME scorebug output — Shakhtar 1–0 Osijek' },
      { title: 'STARTING XI', index: 7, label: 'Real NORDIC1 confirmed starting eleven — Shakhtar and Osijek' },
      { title: 'MATCH EVENT', index: 8, label: 'Real NORDIC1 yellow card graphic — Irakli Azarov' },
      { title: 'VAR', index: 9, label: 'Real NORDIC1 VAR check graphic — possible offside' }
    ];
    real.forEach((item, i) => {
      const card = cards[i];
      if (!card) return;
      card.classList.add('real-content-card');
      const head = card.querySelector('h4');
      if (head) head.textContent = item.title;
      const body = card.querySelector('.gfx-body');
      if (!body) return;
      body.className = 'gfx-body real-gfx-body';
      body.innerHTML = '';
      body.appendChild(makeRealShot(item.index, item.label));
    });
  };

  const correctProductTruth = () => {
    const sourceCards = [...document.querySelectorAll('#football .src')];
    const sourceTruth = [
      ['LIVE MATCH SOURCES', 'Official match pages, live-score, stats & other observable sources'],
      ['OPERATOR INPUT', 'Manual goals, cards, statistics, tactics & overrides'],
      ['TEAM SHEETS & FILES', 'PDF, Excel / CSV, squads, fixtures & TAKEFRAME sessions'],
      ['SOURCE INTELLIGENCE', 'Evidence from any useful source, accepted into canonical match truth']
    ];
    sourceTruth.forEach(([title, copy], i) => {
      const card = sourceCards[i];
      if (!card) return;
      const b = card.querySelector('b');
      const p = card.querySelector('p');
      if (b) b.textContent = title;
      if (p) p.textContent = copy;
    });
    const coreSmall = document.querySelector('#football .core-txt small');
    if (coreSmall) coreSmall.textContent = 'Accepted canonical match truth.';

    const outputLead = document.querySelector('#output .lede p');
    if (outputLead) outputLead.textContent = 'Real TAKEFRAME CONTROL for Preview, Program, match actions, phases and live output — built for the operator running the match.';

    const graphicsLead = document.querySelector('#graphics .lede p');
    if (graphicsLead) graphicsLead.textContent = 'Real NORDIC1 outputs generated by TAKEFRAME from the same Shakhtar–Osijek match model.';
  };

  const boot = () => {
    installRuntimeStyles();
    replaceHeroSupportCards();
    replaceControlRoom();
    replaceGraphicsCards();
    correctProductTruth();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
