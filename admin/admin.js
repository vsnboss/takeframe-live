(() => {
  'use strict';

  const DRAFT_KEY = 'takeframe.website.draft.v1';
  const DEFAULT_URL = '/content/site-default.json';
  const stateLabel = document.querySelector('#save-state');
  const previewFrame = document.querySelector('#preview-frame');
  const toast = document.querySelector('#toast');
  const publishDialog = document.querySelector('#publish-dialog');
  let content = null;
  let saveTimer = null;

  const getPath = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
  const setPath = (obj, path, value) => {
    const keys = path.split('.');
    let cursor = obj;
    keys.slice(0, -1).forEach((key) => {
      if (cursor[key] == null) cursor[key] = /^\d+$/.test(keys[keys.indexOf(key) + 1] || '') ? [] : {};
      cursor = cursor[key];
    });
    cursor[keys[keys.length - 1]] = value;
  };

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1800);
  };

  const saveDraft = () => {
    if (!content) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
    stateLabel.textContent = 'Draft saved locally';
    previewFrame?.contentWindow?.postMessage({ type: 'takeframe-content-preview', content }, location.origin);
  };

  const queueSave = () => {
    stateLabel.textContent = 'Saving draft…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 180);
  };

  const bindField = (field) => {
    const path = field.dataset.path;
    const value = getPath(content, path);
    field.value = value ?? '';
    field.addEventListener('input', () => {
      setPath(content, path, field.value);
      queueSave();
    });
  };

  const graphics = [
    ['scorebug', 'SCOREBUG'],
    ['startingXi', 'STARTING XI'],
    ['playerGraphic', 'PLAYER GRAPHIC'],
    ['matchEvent', 'MATCH EVENT']
  ];

  const renderGraphics = () => {
    const root = document.querySelector('#graphics-editor');
    root.innerHTML = '';
    graphics.forEach(([id, label]) => {
      const item = content.graphics.cards[id];
      const article = document.createElement('article');
      article.className = 'graphic-item';
      article.innerHTML = `
        <h3>${label}</h3>
        <div class="graphic-thumb">${item.imageUrl ? `<img src="${item.imageUrl}" alt="${label} preview">` : '<span>No replacement image — coded graphic remains active</span>'}</div>
        <label>Image URL<input type="text" data-gfx-path="graphics.cards.${id}.imageUrl" value="${item.imageUrl || ''}" placeholder="/assets/example.jpg or https://…"></label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px">
          <label>Fit<select data-gfx-path="graphics.cards.${id}.fit"><option value="cover" ${item.fit === 'cover' ? 'selected' : ''}>Cover</option><option value="contain" ${item.fit === 'contain' ? 'selected' : ''}>Contain</option></select></label>
          <label>Position<input type="text" data-gfx-path="graphics.cards.${id}.position" value="${item.position || 'center'}"></label>
        </div>`;
      root.appendChild(article);
    });
    root.querySelectorAll('[data-gfx-path]').forEach((field) => field.addEventListener('input', () => {
      setPath(content, field.dataset.gfxPath, field.value);
      const card = field.closest('.graphic-item');
      const imgUrl = getPath(content, field.dataset.gfxPath.replace(/\.(fit|position)$/, '.imageUrl'));
      const thumb = card.querySelector('.graphic-thumb');
      if (field.dataset.gfxPath.endsWith('.imageUrl')) thumb.innerHTML = field.value ? `<img src="${field.value}" alt="preview">` : '<span>No replacement image — coded graphic remains active</span>';
      queueSave();
    }));
  };

  const sections = [
    ['comparison', 'Comparison'],
    ['workflow', 'Workflow'],
    ['matchModel', 'Match Model'],
    ['controlRoom', 'Control Room'],
    ['graphics', 'Graphics'],
    ['audience', 'Audience']
  ];

  const renderSections = () => {
    const root = document.querySelector('#section-editor');
    root.innerHTML = '';
    sections.forEach(([id, label]) => {
      const section = content[id];
      const card = document.createElement('article');
      card.className = 'section-card';
      const headline = Array.isArray(section.headline) ? section.headline : [];
      card.innerHTML = `<h3>${label}</h3>
        <div class="section-lines">${headline.map((line, i) => `<label>Line ${i + 1}<input data-section-path="${id}.headline.${i}" value="${line.replaceAll('&', '&amp;').replaceAll('"', '&quot;')}"></label>`).join('')}</div>
        ${typeof section.description === 'string' ? `<label>Description<textarea rows="2" data-section-path="${id}.description">${section.description}</textarea></label>` : ''}`;
      root.appendChild(card);
    });
    root.querySelectorAll('[data-section-path]').forEach((field) => field.addEventListener('input', () => {
      setPath(content, field.dataset.sectionPath, field.value);
      queueSave();
    }));
  };

  const renderMedia = () => {
    const root = document.querySelector('#media-grid');
    const assets = [
      ['/assets/hero-player.png', 'Hero player'],
      ['/assets/logo.png', 'TAKEFRAME LIVE logo'],
      ['/assets/formation.jpg?v=1', 'Current Starting XI'],
      ['/assets/energy-field.svg', 'Energy field']
    ];
    root.innerHTML = assets.map(([src, label]) => `<article class="media-card"><img src="${src}" alt="${label}"><div><strong>${label}</strong><br>${src}</div></article>`).join('');
  };

  const switchPanel = (id) => {
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panelId === id));
  };

  document.querySelectorAll('.nav-item').forEach((button) => button.addEventListener('click', () => switchPanel(button.dataset.panel)));
  document.querySelector('#preview-btn')?.addEventListener('click', () => {
    saveDraft();
    window.open('/?tf_admin_preview=1', '_blank', 'noopener');
  });
  document.querySelector('#refresh-preview')?.addEventListener('click', () => {
    saveDraft();
    previewFrame.src = '/?tf_admin_preview=1&v=' + Date.now();
  });
  document.querySelector('#publish-btn')?.addEventListener('click', () => publishDialog?.showModal());
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => publishDialog?.close()));

  async function init() {
    const defaults = await fetch(DEFAULT_URL, { cache: 'no-store' }).then((r) => r.json());
    try {
      const local = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      content = local && local.version === defaults.version ? local : defaults;
    } catch {
      content = defaults;
    }
    document.querySelectorAll('[data-path]').forEach(bindField);
    renderGraphics();
    renderSections();
    renderMedia();
    saveDraft();
    showToast('Website Admin ready');
  }

  init().catch((error) => {
    console.error(error);
    stateLabel.textContent = 'Could not load content model';
    showToast('Admin failed to initialize');
  });
})();
