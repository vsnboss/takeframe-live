/**
 * TAKEFRAME homepage visual QA.
 *
 * Usage:  npx http-server -p 8099 -s &   then   node scripts/qa.mjs [shots-dir]
 *
 * Checks, per viewport (390/768/1024/1440/1920):
 *   - page loads with zero console/page errors
 *   - no horizontal overflow
 *   - hero player and logo render
 *   - every <img> decodes (naturalWidth/Height > 0)
 *   - every nav/CTA anchor resolves to an element
 *   - every assets/media/* file returns HTTP 200
 * Writes full-page screenshots for human review.
 */
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(`${execSync('npm root -g').toString().trim()}/playwright`)); }

const BASE = 'http://127.0.0.1:8099';
const OUT = process.argv[2] || '/tmp/tf-qa';
mkdirSync(OUT, { recursive: true });

const WIDTHS = [390, 768, 1024, 1440, 1920];
const results = [];
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};

const browser = await chromium.launch();

for (const width of WIDTHS) {
  const page = await browser.newPage({ viewport: { width, height: 940 } });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  /* force lazy-loaded images to load, with a hard cap so QA can't hang */
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; });
    const cap = new Promise((r) => setTimeout(r, 8000));
    const all = Promise.all(
      [...document.images].map((i) =>
        i.complete ? Promise.resolve() : new Promise((r) => {
          i.addEventListener('load', r, { once: true });
          i.addEventListener('error', r, { once: true });
        })
      )
    );
    await Promise.race([all, cap]);
  });

  check(`${width}: no console/page errors`, errors.length === 0, errors.join(' | '));

  const overflow = await page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth - d.clientWidth;
  });
  check(`${width}: no horizontal overflow`, overflow <= 0, `scrollWidth-clientWidth=${overflow}`);

  const imgs = await page.evaluate(() =>
    [...document.images].map((i) => ({
      src: i.src.replace(location.origin, ''),
      ok: i.complete && i.naturalWidth > 0 && i.naturalHeight > 0,
      w: i.naturalWidth, h: i.naturalHeight,
    }))
  );
  const broken = imgs.filter((i) => !i.ok);
  check(`${width}: all ${imgs.length} images decode`, broken.length === 0, broken.map((b) => b.src).join(', '));
  check(`${width}: hero player renders`, imgs.some((i) => i.src.includes('hero-player') && i.ok));
  check(`${width}: logo renders`, imgs.some((i) => i.src.includes('logo') && i.ok));

  const anchors = await page.evaluate(() =>
    [...document.querySelectorAll('a[href^="#"]')]
      .map((a) => a.getAttribute('href'))
      .filter((h) => h.length > 1)
      .map((h) => ({ h, ok: !!document.querySelector(h) }))
  );
  const dead = anchors.filter((a) => !a.ok);
  check(`${width}: all ${anchors.length} anchors resolve`, dead.length === 0, dead.map((a) => a.h).join(', '));

  await page.screenshot({ path: `${OUT}/w${width}.png`, fullPage: true });
  await page.close();
}

/* every media file must be served successfully */
{
  const page = await browser.newPage();
  for (const f of ['control-live.webp', 'team-sheet.webp', 'starting-11.webp', 'scorebug.webp', 'goal-event.webp', 'player-card.webp']) {
    const res = await page.request.get(`${BASE}/assets/media/${f}`);
    check(`media 200: ${f}`, res.status() === 200, `status=${res.status()}`);
  }
  await page.close();
}

await browser.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
