(() => {
  'use strict';

  const DRAFT_KEY = 'takeframe.website.draft.v1';
  const TOKEN_SESSION_KEY = 'takeframe.website.github.token.session';
  const TOKEN_LOCAL_KEY = 'takeframe.website.github.token.local';
  const DEFAULT_URL = '/content/site-default.json';
  const LIVE_URL = '/content/site-live.json';
  const REPO = 'vsnboss/takeframe-live';
  const BRANCH = 'main';
  const LIVE_PATH = 'content/site-live.json';
  const API = `https://api.github.com/repos/${REPO}`;

  const stateLabel = document.querySelector('#save-state');
  const previewFrame = document.querySelector('#preview-frame');
  const toast = document.querySelector('#toast');
  const publishDialog = document.querySelector('#publish-dialog');
  const publishStatus = document.querySelector('#publish-status');
  const tokenInput = document.querySelector('#github-token');
  const rememberInput = document.querySelector('#remember-token');
  const publishConfirm = document.querySelector('#confirm-publish');
  const connectionState = document.querySelector('#connection-state');

  let content = null;
  let saveTimer = null;
  const pendingFiles = new Map();
  const objectUrls = new Map();

  const getPath = (obj, path) => path.split('.').reduce((value, key) => value?.[key], obj);
  const setPath = (obj, path, value) => {
    const keys = path.split('.');
    let cursor = obj;
    keys.slice(0, -1).forEach((key, index) => {
      if (cursor[key] == null) cursor[key] = /^\d+$/.test(keys[index + 1] || '') ? [] : {};
      cursor = cursor[key];
    });
    cursor[keys[keys.length - 1]] = value;
  };

  const esc = (value = '') => String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

  const showToast = (message) => {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
  };

  const saveDraft = () => {
    if (!content) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
    stateLabel.textContent = pendingFiles.size ? `Draft saved · ${pendingFiles.size} media file${pendingFiles.size === 1 ? '' : 's'} pending` : 'Draft saved locally';
    previewFrame?.contentWindow?.postMessage({ type: 'takeframe-content-preview', content }, location.origin);
  };

  const queueSave = () => {
    stateLabel.textContent = 'Saving draft…';
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveDraft, 180);
  };

  const bindField = (field) => {
    const path = field.dataset.path;
    field.value = getPath(content, path) ?? '';
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
      article.dataset.graphicId = id;
      article.innerHTML = `
        <h3>${label}</h3>
        <div class="graphic-thumb">${item.imageUrl ? `<img src="${esc(item.imageUrl)}" alt="${label} preview">` : '<span>Coded graphic remains active</span>'}</div>
        <label class="upload-control">Replace image
          <input type="file" data-upload-id="${id}" accept="image/png,image/jpeg,image/webp,image/gif">
          <span>CHOOSE IMAGE</span>
        </label>
        <div class="upload-note" data-upload-note="${id}">PNG, JPG, WebP or GIF. The file is uploaded only when you publish.</div>
        <label>Existing image path<input type="text" data-gfx-path="graphics.cards.${id}.imageUrl" value="${esc(item.imageUrl || '')}" placeholder="/assets/example.jpg"></label>
        <div class="two-col">
          <label>Fit<select data-gfx-path="graphics.cards.${id}.fit"><option value="cover" ${item.fit === 'cover' ? 'selected' : ''}>Cover</option><option value="contain" ${item.fit === 'contain' ? 'selected' : ''}>Contain</option></select></label>
          <label>Position<input type="text" data-gfx-path="graphics.cards.${id}.position" value="${esc(item.position || 'center')}"></label>
        </div>`;
      root.appendChild(article);
    });

    root.querySelectorAll('[data-gfx-path]').forEach((field) => field.addEventListener('input', () => {
      setPath(content, field.dataset.gfxPath, field.value);
      if (field.dataset.gfxPath.endsWith('.imageUrl')) {
        const thumb = field.closest('.graphic-item').querySelector('.graphic-thumb');
        thumb.innerHTML = field.value ? `<img src="${esc(field.value)}" alt="preview">` : '<span>Coded graphic remains active</span>';
      }
      queueSave();
    }));

    root.querySelectorAll('[data-upload-id]').forEach((input) => input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      const id = input.dataset.uploadId;
      if (file.size > 8 * 1024 * 1024) {
        input.value = '';
        showToast('Please use an image smaller than 8 MB');
        return;
      }
      if (objectUrls.has(id)) URL.revokeObjectURL(objectUrls.get(id));
      const url = URL.createObjectURL(file);
      objectUrls.set(id, url);
      pendingFiles.set(id, file);
      const card = input.closest('.graphic-item');
      card.querySelector('.graphic-thumb').innerHTML = `<img src="${url}" alt="${esc(file.name)} preview">`;
      card.querySelector(`[data-upload-note="${id}"]`).textContent = `${file.name} · ready to publish`;
      queueSave();
      showToast(`${labelForGraphic(id)} replacement ready`);
    }));
  };

  const labelForGraphic = (id) => graphics.find(([key]) => key === id)?.[1] || id;

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
        <div class="section-lines">${headline.map((line, i) => `<label>Line ${i + 1}<input data-section-path="${id}.headline.${i}" value="${esc(line)}"></label>`).join('')}</div>
        ${typeof section.description === 'string' ? `<label>Description<textarea rows="2" data-section-path="${id}.description">${esc(section.description)}</textarea></label>` : ''}`;
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
      [content.graphics.cards.startingXi.imageUrl || '/assets/formation.jpg?v=1', 'Current Starting XI'],
      ['/assets/energy-field.svg', 'Energy field']
    ];
    root.innerHTML = assets.map(([src, label]) => `<article class="media-card"><img src="${esc(src)}" alt="${label}"><div><strong>${label}</strong><br>${esc(src)}</div></article>`).join('');
  };

  const switchPanel = (id) => {
    document.querySelectorAll('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.panel === id));
    document.querySelectorAll('.panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panelId === id));
  };

  const getToken = () => sessionStorage.getItem(TOKEN_SESSION_KEY) || localStorage.getItem(TOKEN_LOCAL_KEY) || '';
  const storeToken = (token, remember) => {
    sessionStorage.removeItem(TOKEN_SESSION_KEY);
    localStorage.removeItem(TOKEN_LOCAL_KEY);
    if (!token) return;
    if (remember) localStorage.setItem(TOKEN_LOCAL_KEY, token);
    else sessionStorage.setItem(TOKEN_SESSION_KEY, token);
  };

  const github = async (path, options = {}) => {
    const token = getToken();
    if (!token) throw new Error('GitHub connection required.');
    const response = await fetch(`${API}${path}`, {
      ...options,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    if (!response.ok) {
      let message = `${response.status} ${response.statusText}`;
      try { message = (await response.json()).message || message; } catch {}
      throw new Error(message);
    }
    return response.status === 204 ? null : response.json();
  };

  const validateConnection = async () => {
    await github('');
    connectionState.textContent = 'CONNECTED · TAKEFRAME REPO ONLY';
    connectionState.className = 'connection-state connected';
    return true;
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(file);
  });

  const safeExtension = (file) => {
    const ext = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)) return ext === 'jpeg' ? 'jpg' : ext;
    return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  };

  const publish = async () => {
    publishConfirm.disabled = true;
    publishConfirm.textContent = 'PUBLISHING…';
    publishStatus.textContent = 'Checking GitHub connection…';
    try {
      await validateConnection();
      const ref = await github(`/git/ref/heads/${BRANCH}`);
      const parentSha = ref.object.sha;
      const parentCommit = await github(`/git/commits/${parentSha}`);
      const treeEntries = [];
      const stamp = Date.now();

      publishStatus.textContent = pendingFiles.size ? 'Uploading replacement images…' : 'Preparing website content…';
      for (const [id, file] of pendingFiles.entries()) {
        const ext = safeExtension(file);
        const path = `assets/cms/${id}-${stamp}.${ext}`;
        const blob = await github('/git/blobs', {
          method: 'POST',
          body: JSON.stringify({ content: await fileToBase64(file), encoding: 'base64' })
        });
        treeEntries.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
        content.graphics.cards[id].imageUrl = `/${path}?v=${stamp}`;
      }

      const jsonBlob = await github('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: `${JSON.stringify(content, null, 2)}\n`, encoding: 'utf-8' })
      });
      treeEntries.push({ path: LIVE_PATH, mode: '100644', type: 'blob', sha: jsonBlob.sha });

      publishStatus.textContent = 'Creating one production commit…';
      const tree = await github('/git/trees', {
        method: 'POST',
        body: JSON.stringify({ base_tree: parentCommit.tree.sha, tree: treeEntries })
      });
      const commit = await github('/git/commits', {
        method: 'POST',
        body: JSON.stringify({
          message: `Update TAKEFRAME website content (${new Date().toISOString()})`,
          tree: tree.sha,
          parents: [parentSha]
        })
      });
      await github(`/git/refs/heads/${BRANCH}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: commit.sha, force: false })
      });

      pendingFiles.clear();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(content));
      publishStatus.textContent = `Published commit ${commit.sha.slice(0, 7)}. Vercel is deploying it now.`;
      stateLabel.textContent = 'Published · Vercel deploying';
      renderGraphics();
      renderMedia();
      showToast('Published to TAKEFRAME.live');
      publishConfirm.textContent = 'PUBLISHED';
      setTimeout(() => publishDialog?.close(), 2200);
    } catch (error) {
      console.error(error);
      publishStatus.textContent = `Publish failed: ${error.message}`;
      publishConfirm.disabled = false;
      publishConfirm.textContent = 'PUBLISH LIVE';
    }
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
  document.querySelector('#publish-btn')?.addEventListener('click', () => {
    const token = getToken();
    tokenInput.value = token;
    rememberInput.checked = Boolean(localStorage.getItem(TOKEN_LOCAL_KEY));
    connectionState.textContent = token ? 'TOKEN LOADED · VERIFY ON PUBLISH' : 'NOT CONNECTED';
    connectionState.className = `connection-state${token ? ' pending' : ''}`;
    publishStatus.textContent = pendingFiles.size ? `${pendingFiles.size} replacement image${pendingFiles.size === 1 ? '' : 's'} will be included in the same production commit.` : 'Only content changes will be published.';
    publishConfirm.disabled = false;
    publishConfirm.textContent = 'PUBLISH LIVE';
    publishDialog?.showModal();
  });
  document.querySelector('#connect-github')?.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      publishStatus.textContent = 'Paste a fine-grained GitHub token first.';
      return;
    }
    storeToken(token, rememberInput.checked);
    publishStatus.textContent = 'Checking repository access…';
    try {
      await validateConnection();
      publishStatus.textContent = 'Connected. This token can now publish the TAKEFRAME website.';
    } catch (error) {
      connectionState.textContent = 'CONNECTION FAILED';
      connectionState.className = 'connection-state error';
      publishStatus.textContent = `Connection failed: ${error.message}`;
    }
  });
  tokenInput?.addEventListener('change', () => storeToken(tokenInput.value.trim(), rememberInput.checked));
  rememberInput?.addEventListener('change', () => storeToken(tokenInput.value.trim(), rememberInput.checked));
  publishConfirm?.addEventListener('click', publish);
  document.querySelectorAll('[data-close-dialog]').forEach((button) => button.addEventListener('click', () => publishDialog?.close()));

  async function init() {
    const defaults = await fetch(DEFAULT_URL, { cache: 'no-store' }).then((r) => r.json());
    let live = defaults;
    try {
      const response = await fetch(LIVE_URL, { cache: 'no-store' });
      if (response.ok) live = await response.json();
    } catch {}
    try {
      const local = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      content = local && local.version === defaults.version ? local : live;
    } catch {
      content = live;
    }
    document.querySelectorAll('[data-path]').forEach(bindField);
    renderGraphics();
    renderSections();
    renderMedia();
    saveDraft();
    if (getToken()) {
      connectionState.textContent = 'GITHUB TOKEN AVAILABLE';
      connectionState.className = 'connection-state pending';
    }
    showToast('Website Admin ready');
  }

  init().catch((error) => {
    console.error(error);
    stateLabel.textContent = 'Could not load content model';
    showToast('Admin failed to initialize');
  });
})();
