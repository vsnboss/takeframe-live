/**
 * Visual regression capture for the approved composition.
 *
 * Usage: node scripts/shots.mjs [label]
 * Writes: /tmp/tf-shots/<label>/{ref941,w1440,w1863,w1863-fold,mobile}.png
 * Also prints a geometry probe (measured box of every landmark element in
 * reference-grid coordinates) so drift can be compared numerically, not just
 * by eye.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

/* Playwright is provided by the environment (globally installed), not by this
   static site's dependency tree — resolve it from the global root. */
const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  const globalRoot = execSync('npm root -g').toString().trim();
  ({ chromium } = require(`${globalRoot}/playwright`));
}

const LABEL = process.argv[2] || 'pass';
const OUT = `/tmp/tf-shots/${LABEL}`;
const URL = 'http://127.0.0.1:8099/index.html';
mkdirSync(OUT, { recursive: true });

const PROBE = {
  logo: '.logo', nav: '.mainnav', hdrCta: '.hdr-cta',
  kicker: '.kicker', h1: '.hero-h1', h1L1: '.hero-h1 .l:nth-child(1)',
  h1L2: '.hero-h1 .l:nth-child(2)', h1L3: '.hero-h1 .l:nth-child(3)',
  h1L4: '.hero-h1 .l:nth-child(4)',
  lede: '.hero-lede', btns: '.hero-btns', player: '.hero-player',
  sb: '.sb', xi: '.xi', pcard: '.pcard', rail: '.rail',
  compare: '.compare', flow: '.flow', model: '.model', control: '.control',
  graphics: '.graphics', audience: '.audience', cta: '.cta', ftr: '.ftr',
};

const browser = await chromium.launch();

/* ---- reference grid: 941 wide, scale exactly 1 ---- */
{
  const page = await browser.newPage({ viewport: { width: 941, height: 1672 }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/ref941.png`, fullPage: true });

  const geom = await page.evaluate((probe) => {
    const s = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--s')) || 1;
    const canvas = document.querySelector('.canvas').getBoundingClientRect();
    const out = { scale: +s.toFixed(4), canvasH: Math.round(document.querySelector('.canvas').offsetHeight) };
    for (const [k, sel] of Object.entries(probe)) {
      const el = document.querySelector(sel);
      if (!el) { out[k] = null; continue; }
      const r = el.getBoundingClientRect();
      out[k] = [r.left - canvas.left, r.top - canvas.top, r.width, r.height].map((v) => Math.round(v / s));
    }
    return out;
  }, PROBE);
  console.log('--- geometry (reference-grid px) ---');
  for (const [k, v] of Object.entries(geom)) console.log(String(k).padEnd(10), JSON.stringify(v));

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('h-overflow@941:', overflow);
  await page.close();
}

/* ---- desktop widths ---- */
for (const [name, w, h, full] of [['w1440', 1440, 900, true], ['w1863', 1863, 975, true], ['w1863-fold', 1863, 975, false]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log(`h-overflow@${w}:`, o);
  await page.close();
}

/* ---- mobile ---- */
{
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/mobile.png`, fullPage: true });
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  console.log('h-overflow@390:', o);
  await page.close();
}

await browser.close();
console.log(`\nshots -> ${OUT}`);
