(() => {
  'use strict';

  const ROOT = document.documentElement;
  const DESKTOP_WIDTH = 941;
  const BREAKPOINT = 900;

  function syncScale() {
    if (window.innerWidth >= BREAKPOINT) {
      ROOT.style.setProperty('--s', String(window.innerWidth / DESKTOP_WIDTH));
    } else {
      ROOT.style.setProperty('--s', '1');
    }
  }

  async function installRealStartingXI() {
    const slot = document.querySelector('.xi');
    if (!slot) return;

    try {
      const urls = [
        '/assets/real-data/starting-xi-1.txt',
        '/assets/real-data/starting-xi-2.txt'
      ];
      const parts = await Promise.all(urls.map(async (url) => {
        const response = await fetch(url, { cache: 'no-store' });
        if (!response.ok) throw new Error(`Unable to load ${url}`);
        return response.text();
      }));

      let encoded = parts.join('').trim();
      let src;
      if (encoded.startsWith('data:')) {
        src = encoded;
      } else {
        encoded = encoded.replace(/\s+/g, '');
        const mime = encoded.startsWith('UklG')
          ? 'image/webp'
          : encoded.startsWith('iVBOR')
            ? 'image/png'
            : 'image/jpeg';
        src = `data:${mime};base64,${encoded}`;
      }

      slot.innerHTML = '';
      slot.setAttribute('aria-label', 'Starting 11 formation');
      slot.style.padding = '0';
      slot.style.height = '158px';
      slot.style.overflow = 'hidden';

      const image = document.createElement('img');
      image.src = src;
      image.alt = 'Starting 11 — Shakhtar Donetsk vs NK Osijek confirmed team sheet';
      image.style.display = 'block';
      image.style.width = '100%';
      image.style.height = '100%';
      image.style.objectFit = 'cover';
      image.style.objectPosition = 'center';
      slot.appendChild(image);
    } catch (error) {
      console.error('TAKEFRAME: real Starting 11 image could not be loaded.', error);
    }
  }

  function installNavigation() {
    const toggle = document.querySelector('.menu-toggle');
    const nav = document.getElementById('mainnav');
    if (!toggle || !nav) return;

    toggle.addEventListener('click', () => {
      const open = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('open', !open);
    });

    nav.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      toggle.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
    }));
  }

  function installDemoModal() {
    const modal = document.getElementById('demo');
    if (!modal) return;

    document.querySelectorAll('.js-demo').forEach((button) => {
      button.addEventListener('click', () => {
        if (typeof modal.showModal === 'function') modal.showModal();
        else modal.setAttribute('open', '');
      });
    });

    const close = modal.querySelector('.close');
    if (close) close.addEventListener('click', () => modal.close());

    modal.addEventListener('click', (event) => {
      if (event.target === modal) modal.close();
    });

    const form = modal.querySelector('form');
    if (form) {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const output = form.querySelector('output');
        if (output) output.textContent = 'Thanks — your demo request is ready to be sent.';
      });
    }
  }

  syncScale();
  window.addEventListener('resize', syncScale, { passive: true });
  document.addEventListener('DOMContentLoaded', () => {
    syncScale();
    installNavigation();
    installDemoModal();
    installRealStartingXI();
  });
})();
