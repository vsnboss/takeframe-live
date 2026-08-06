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

// Match the public workflow to the real TAKEFRAME onboarding process.
const firstWorkflowStep = document.querySelector('.workflow-grid article:first-child');
if (firstWorkflowStep) {
  const title = firstWorkflowStep.querySelector('h3');
  const copy = firstWorkflowStep.querySelector('p');
  const visual = firstWorkflowStep.querySelector('.workflow-icon');

  if (title) title.textContent = 'Ingest match sources';
  if (copy) {
    copy.textContent = 'Add match links, team sheets, spreadsheets, screenshots, player photos, club assets or pasted text.';
  }

  if (visual) {
    visual.classList.add('match-source-preview');
    visual.innerHTML = `
      <div class="source-preview-head">
        <span class="source-file-icon">▱</span>
        <strong>Add match sources</strong>
      </div>
      <div class="source-preview-drop">
        <div class="source-preview-types">
          <span>↗</span><span>PDF</span><span>XLS</span><span>IMG</span><span>TXT</span>
        </div>
        <b>Drop files, folders or images</b>
        <small>or paste one or more match links</small>
        <div class="source-preview-input"><i>https://…</i><em>Add</em></div>
      </div>`;
  }

  const style = document.createElement('style');
  style.textContent = `
    .workflow-grid article:first-child .workflow-icon.match-source-preview {
      width: 100%;
      min-width: 0;
      height: 132px;
      margin: 0 0 22px;
      padding: 10px;
      display: block;
      border-radius: 16px;
      color: #eaf5ff;
      border-color: rgba(20, 216, 255, .42);
      background: linear-gradient(180deg, rgba(8, 27, 49, .98), rgba(4, 14, 28, .98));
      box-shadow: 0 16px 32px rgba(0,0,0,.24), inset 0 0 24px rgba(20,216,255,.05);
      overflow: hidden;
    }
    .workflow-grid article:first-child > span { top: 112px; }
    .source-preview-head {
      display: flex;
      align-items: center;
      gap: 7px;
      margin-bottom: 8px;
      color: #f4f8ff;
      font-size: 10px;
      letter-spacing: .06em;
      text-transform: uppercase;
    }
    .source-file-icon { color: #19d8ff; font-size: 14px; }
    .source-preview-drop {
      height: 92px;
      padding: 8px 9px;
      border: 1px dashed rgba(20, 216, 255, .42);
      border-radius: 10px;
      background: rgba(1, 12, 27, .72);
      text-align: center;
    }
    .source-preview-types {
      display: flex;
      justify-content: center;
      gap: 5px;
      margin-bottom: 5px;
    }
    .source-preview-types span {
      min-width: 22px;
      height: 18px;
      padding: 0 4px;
      display: grid;
      place-items: center;
      border-radius: 5px;
      background: rgba(11, 35, 64, .92);
      border: 1px solid rgba(54, 119, 180, .28);
      color: #27cfff;
      font-size: 7px;
      font-weight: 800;
    }
    .source-preview-drop b,
    .source-preview-drop small { display: block; }
    .source-preview-drop b {
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    .source-preview-drop small {
      margin-top: 2px;
      color: #8ea8c8;
      font-size: 7px;
    }
    .source-preview-input {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 6px;
    }
    .source-preview-input i {
      flex: 1;
      min-width: 0;
      padding: 4px 6px;
      border-radius: 5px;
      background: #020a16;
      border: 1px solid rgba(38, 148, 210, .3);
      color: #66809f;
      font-size: 7px;
      font-style: normal;
      text-align: left;
    }
    .source-preview-input em {
      padding: 4px 7px;
      border-radius: 5px;
      background: linear-gradient(180deg, #158fe0, #0b5f9f);
      color: white;
      font-size: 7px;
      font-style: normal;
      font-weight: 800;
      text-transform: uppercase;
    }
    @media (max-width: 720px) {
      .workflow-grid article:first-child .workflow-icon.match-source-preview { height: 150px; }
      .workflow-grid article:first-child > span { top: 130px; }
      .source-preview-drop { height: 108px; }
    }
  `;
  document.head.appendChild(style);
}
