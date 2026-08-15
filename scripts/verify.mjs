/**
 * Functional + structural verification for the approved rebuild.
 * Run: node scripts/verify.mjs   (requires the static server on :8099)
 */
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`)); }

const URL = 'http://127.0.0.1:8099/index.html';
const results = [];
const check = (name, pass, detail = '') => results.push({ name, pass, detail });

const browser = await chromium.launch();

/* ------------------------------ desktop -------------------------------- */
{
  const page = await browser.newPage({ viewport: { width: 1863, height: 975 } });
  const consoleErrors = [];
  page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
  page.on('pageerror', (e) => consoleErrors.push(String(e)));
  await page.goto(URL, { waitUntil: 'networkidle' });

  check('no console/page errors', consoleErrors.length === 0, consoleErrors.join(' | '));

  /* scale must fill the viewport, not cap at 1.5 */
  const scale = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s'))
  );
  check('scale fills 1863px viewport (~1.98, not capped)', Math.abs(scale - 1863 / 941) < 0.01, `scale=${scale.toFixed(3)}`);

  const gutters = await page.evaluate(() => {
    const r = document.querySelector('.stage').getBoundingClientRect();
    return { left: Math.round(r.left), right: Math.round(document.documentElement.clientWidth - r.right) };
  });
  check('no desktop side gutters', gutters.left <= 1 && gutters.right <= 1, JSON.stringify(gutters));

  /* every asset resolved */
  const broken = await page.evaluate(() =>
    [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.currentSrc || i.src)
  );
  check('all images render', broken.length === 0, broken.join(', '));

  /* the two locked assets are actually painted */
  const locked = await page.evaluate(() => {
    const logo = document.querySelector('.logo img');
    const player = document.querySelector('.hero-player');
    return {
      logo: [logo?.naturalWidth, Math.round(logo?.getBoundingClientRect().width)],
      player: [player?.naturalWidth, Math.round(player?.getBoundingClientRect().width)],
    };
  });
  check('official logo renders', locked.logo[0] > 0 && locked.logo[1] > 0, JSON.stringify(locked.logo));
  check('hero player renders', locked.player[0] > 0 && locked.player[1] > 0, JSON.stringify(locked.player));

  /* headline line breaks are exactly the approved four */
  const lines = await page.evaluate(() =>
    [...document.querySelectorAll('.hero-h1 .l')].map((e) => e.textContent.trim())
  );
  check(
    'headline breaks FROM / TEAM SHEET / TO LIVE / GRAPHICS.',
    JSON.stringify(lines) === JSON.stringify(['FROM', 'TEAM SHEET', 'TO LIVE', 'GRAPHICS.']),
    lines.join(' | ')
  );

  /* nav anchors all resolve to real sections */
  const nav = await page.evaluate(() =>
    [...document.querySelectorAll('.mainnav a')].map((a) => ({
      label: a.textContent.trim(),
      href: a.getAttribute('href'),
      found: !!document.querySelector(a.getAttribute('href')),
    }))
  );
  check('all 6 nav anchors resolve', nav.length === 6 && nav.every((n) => n.found), JSON.stringify(nav.filter((n) => !n.found)));

  /* nav actually scrolls — a target near the document end legitimately stops
     short because the scroller is clamped, so accept either landing. */
  for (const id of ['#product', '#workflow', '#football', '#output', '#graphics', '#beta']) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.click(`.mainnav a[href="${id}"]`);
    await page.waitForTimeout(900);
    const r = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      const maxScroll = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      return { top: Math.round(el.getBoundingClientRect().top), atEnd: Math.ceil(window.scrollY) >= maxScroll - 2 };
    }, id);
    check(`nav ${id} scrolls to section`, Math.abs(r.top) < 90 || r.atEnd, `top=${r.top} atEnd=${r.atEnd}`);
  }

  /* demo modal opens from every CTA, and closes */
  const ctaCount = await page.evaluate(() => document.querySelectorAll('.js-demo').length);
  check('3 demo CTAs wired', ctaCount === 3, `count=${ctaCount}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('.hdr-cta');
  check('modal opens', await page.evaluate(() => document.querySelector('#demo').open));

  /* form: rejects empty, accepts filled */
  await page.click('#demo-form button[type=submit]');
  const invalidNoted = await page.evaluate(() => document.querySelector('#demo-status').textContent.length > 0);
  check('form blocks empty submit', invalidNoted);

  await page.fill('#demo-form input[name=name]', 'Ivan Horvat');
  await page.fill('#demo-form input[name=email]', 'ivan@example.com');
  await page.fill('#demo-form input[name=company]', 'NK Test');
  const valid = await page.evaluate(() => document.querySelector('#demo-form').checkValidity());
  check('form validates when complete', valid);

  await page.click('.modal-close');
  await page.waitForTimeout(200);
  check('modal closes', await page.evaluate(() => !document.querySelector('#demo').open));

  await page.close();
}

/* ------------------------------- widths -------------------------------- */
for (const w of [941, 1280, 1440, 1863, 2560, 768, 390, 320]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check(`no horizontal overflow @${w}px`, o <= 0, `overflow=${o}`);
  await page.close();
}

/* ------------------------------- mobile -------------------------------- */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(URL, { waitUntil: 'networkidle' });

  const stacked = await page.evaluate(() => {
    const c = document.querySelector('.canvas');
    return { transform: getComputedStyle(c).transform, height: c.offsetHeight };
  });
  check('mobile releases the canvas transform', stacked.transform === 'none', stacked.transform);

  /* key elements survive on mobile */
  const kept = await page.evaluate(() => {
    const vis = (s) => {
      const e = document.querySelector(s);
      if (!e) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    return { player: vis('.hero-player'), sb: vis('.sb'), xi: vis('.xi'), pcard: vis('.pcard'), ui: vis('.ui'), cta: vis('.btn-big') };
  });
  check('mobile keeps player + key cards + CTA', Object.values(kept).every(Boolean), JSON.stringify(kept));

  /* the player card portrait must stay inside its card */
  const contained = await page.evaluate(() => {
    const card = document.querySelector('.pcard').getBoundingClientRect();
    const shot = document.querySelector('.pc-shot').getBoundingClientRect();
    return shot.top >= card.top - 1 && shot.bottom <= card.bottom + 1 && shot.right <= card.right + 1;
  });
  check('player-card portrait contained on mobile', contained);

  /* burger menu opens and closes */
  await page.click('.menu-toggle');
  check('mobile nav opens', await page.evaluate(() => document.querySelector('.mainnav').classList.contains('open')));
  await page.click('.mainnav a[href="#product"]');
  await page.waitForTimeout(300);
  check('mobile nav closes on link', await page.evaluate(() => !document.querySelector('.mainnav').classList.contains('open')));

  await page.close();
}

await browser.close();

let failed = 0;
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
}
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
