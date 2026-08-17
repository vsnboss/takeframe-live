(() => {
  'use strict';

  const DRAFT_KEY = 'takeframe.website.draft.v1';

  const setText = (selector, value) => {
    const el = document.querySelector(selector);
    if (el && typeof value === 'string') el.textContent = value;
  };

  const setHeroLines = (lines) => {
    const el = document.querySelector('.hero-h1');
    if (!el || !Array.isArray(lines)) return;
    el.innerHTML = '';
    lines.forEach((line, index) => {
      const span = document.createElement('span');
      span.className = `l${index >= 2 ? ' r' : ''}`;
      span.textContent = line;
      el.appendChild(span);
    });
  };

  const setHeading = (selector, lines, redFrom = Infinity) => {
    const el = document.querySelector(selector);
    if (!el || !Array.isArray(lines)) return;
    el.innerHTML = '';
    lines.forEach((line, index) => {
      if (index) el.appendChild(document.createElement('br'));
      if (index >= redFrom) {
        const em = document.createElement('em');
        em.textContent = line;
        el.appendChild(em);
      } else {
        el.appendChild(document.createTextNode(line));
      }
    });
  };

  const installGraphicImage = (index, config, alt) => {
    if (!config?.imageUrl) return;
    const card = document.querySelector(`#graphics .gfx-row .gfx:nth-of-type(${index})`);
    const body = card?.querySelector('.gfx-body');
    if (!card || !body) return;
    body.innerHTML = '';
    body.style.padding = '0';
    body.style.overflow = 'hidden';
    body.style.background = '#06111d';
    const img = document.createElement('img');
    img.src = config.imageUrl;
    img.alt = alt;
    img.decoding = 'async';
    img.loading = 'eager';
    img.style.display = 'block';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = config.fit || 'cover';
    img.style.objectPosition = config.position || 'center';
    body.appendChild(img);
  };

  const applyContent = (content) => {
    if (!content) return;

    if (content.seo?.title) document.title = content.seo.title;
    const meta = document.querySelector('meta[name="description"]');
    if (meta && content.seo?.description) meta.content = content.seo.description;

    setText('.hero .kicker', content.hero?.kicker);
    setHeroLines(content.hero?.headline);
    setText('.hero-lede', content.hero?.description);
    setText('.hero-btns .btn-red', content.hero?.primaryCta);
    const secondary = document.querySelector('.hero-btns .btn-ghost');
    if (secondary && content.hero?.secondaryCta) {
      const play = secondary.querySelector('.play');
      secondary.textContent = '';
      if (play) secondary.appendChild(play);
      secondary.appendChild(document.createTextNode(` ${content.hero.secondaryCta}`));
    }

    setHeading('.compare .lede h2', content.comparison?.headline, 2);
    setText('.compare .lede p', content.comparison?.description);
    setHeading('.flow .lede h2', content.workflow?.headline);
    setText('.flow .lede p', content.workflow?.description);
    setHeading('.model .lede h2', content.matchModel?.headline);
    setText('.model .lede p', content.matchModel?.description);
    setHeading('.control .lede h2', content.controlRoom?.headline);
    setText('.control .lede p', content.controlRoom?.description);
    setHeading('.graphics .lede h2', content.graphics?.headline);
    setText('.graphics .lede p', content.graphics?.description);
    setHeading('.audience .lede h2', content.audience?.headline);
    setHeading('.cta-title', content.cta?.headline);
    setText('.cta-copy', content.cta?.description);

    const cta = document.querySelector('.cta .btn-big');
    if (cta && content.cta?.button) {
      cta.innerHTML = `${content.cta.button} <span class="arw">&#8599;</span><small>${content.cta.buttonSub || ''}</small>`;
    }

    const cards = content.graphics?.cards || {};
    const configs = [cards.scorebug, cards.startingXi, cards.playerGraphic, cards.matchEvent];
    configs.forEach((config, i) => {
      if (config?.title) setText(`#graphics .gfx-row .gfx:nth-of-type(${i + 1}) h4`, config.title);
    });
    installGraphicImage(1, cards.scorebug, 'TAKEFRAME scorebug');
    installGraphicImage(2, cards.startingXi, 'TAKEFRAME Starting XI');
    installGraphicImage(3, cards.playerGraphic, 'TAKEFRAME player graphic');
    installGraphicImage(4, cards.matchEvent, 'TAKEFRAME match event graphic');
  };

  const fetchJson = async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${url} returned ${response.status}`);
    return response.json();
  };

  const load = async () => {
    let content = null;
    try {
      content = await fetchJson('/content/site-live.json');
    } catch {
      try {
        content = await fetchJson('/content/site-default.json');
      } catch (error) {
        console.warn('TAKEFRAME CMS content unavailable.', error);
      }
    }

    const preview = new URLSearchParams(location.search).get('tf_admin_preview') === '1';
    if (preview) {
      try {
        const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
        if (draft) content = draft;
      } catch (error) {
        console.warn('TAKEFRAME CMS draft unavailable.', error);
      }
    }

    applyContent(content);
  };

  window.addEventListener('message', (event) => {
    if (event.origin !== location.origin) return;
    if (event.data?.type === 'takeframe-content-preview') applyContent(event.data.content);
  });

  load();
})();
