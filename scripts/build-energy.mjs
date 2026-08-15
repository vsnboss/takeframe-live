/**
 * Generates assets/energy-field.svg — the layered blue/red technical energy
 * behind the TAKEFRAME composition. Deterministic (seeded), so regenerating
 * never churns the committed asset.
 *
 * Run: node scripts/build-energy.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/energy-field.svg');
const W = 941;
const H = 1672;

let seed = 0x9e3779b9;
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0xffffffff;
};
const between = (a, b) => a + (b - a) * rnd();
const n = (v) => Math.round(v * 100) / 100;

const parts = [];

/** Straight radial rays fanning out of a focus point. */
function rayBurst({ cx, cy, from, to, a0, a1, count, color, w0 = 0.4, w1 = 1.5, o0 = 0.06, o1 = 0.5 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = between(a0, a1);
    const r0 = between(from, from + (to - from) * 0.35);
    const r1 = between(r0 + (to - from) * 0.25, to);
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
    const x2 = cx + Math.cos(a) * r1, y2 = cy + Math.sin(a) * r1;
    out.push(
      `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" stroke="${color}" stroke-width="${n(between(w0, w1))}" opacity="${n(between(o0, o1))}"/>`
    );
  }
  return out.join('');
}

/** Rays that bow slightly — reads as depth rather than a flat starburst. */
function arcBurst({ cx, cy, from, to, a0, a1, count, color, bow = 0.18, o0 = 0.05, o1 = 0.34 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = between(a0, a1);
    const r0 = between(from, from + (to - from) * 0.3);
    const r1 = between(r0 + (to - from) * 0.3, to);
    const x1 = cx + Math.cos(a) * r0, y1 = cy + Math.sin(a) * r0;
    const x2 = cx + Math.cos(a) * r1, y2 = cy + Math.sin(a) * r1;
    const mr = (r0 + r1) / 2;
    const ma = a + between(-bow, bow);
    const mx = cx + Math.cos(ma) * mr, my = cy + Math.sin(ma) * mr;
    out.push(
      `<path d="M${n(x1)} ${n(y1)}Q${n(mx)} ${n(my)} ${n(x2)} ${n(y2)}" fill="none" stroke="${color}" stroke-width="${n(between(0.4, 1.2))}" opacity="${n(between(o0, o1))}"/>`
    );
  }
  return out.join('');
}

/** Branching circuit-like structures — a trunk that forks into thinner limbs. */
function branches({ cx, cy, from, to, a0, a1, count, color, o0 = 0.1, o1 = 0.4 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = between(a0, a1);
    const r0 = between(from, from + (to - from) * 0.4);
    const r1 = between(r0 + 40, to);
    const bx = cx + Math.cos(a) * r0, by = cy + Math.sin(a) * r0;
    const ex = cx + Math.cos(a) * r1, ey = cy + Math.sin(a) * r1;
    const op = n(between(o0, o1));
    out.push(`<line x1="${n(bx)}" y1="${n(by)}" x2="${n(ex)}" y2="${n(ey)}" stroke="${color}" stroke-width="0.9" opacity="${op}"/>`);
    const forks = 1 + Math.floor(rnd() * 3);
    for (let f = 0; f < forks; f++) {
      const t = between(0.35, 0.9);
      const fx = bx + (ex - bx) * t, fy = by + (ey - by) * t;
      const fa = a + between(-0.5, 0.5);
      const fl = between(14, 62);
      out.push(
        `<line x1="${n(fx)}" y1="${n(fy)}" x2="${n(fx + Math.cos(fa) * fl)}" y2="${n(fy + Math.sin(fa) * fl)}" stroke="${color}" stroke-width="0.55" opacity="${n(op * 0.75)}"/>`
      );
    }
  }
  return out.join('');
}

/** Sparse particle texture so the field is not purely linear. */
function motes({ cx, cy, radius, count, color, rmin = 0.4, rmax = 1.5 }) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const a = between(0, Math.PI * 2);
    const r = radius * Math.sqrt(rnd());
    out.push(
      `<circle cx="${n(cx + Math.cos(a) * r)}" cy="${n(cy + Math.sin(a) * r)}" r="${n(between(rmin, rmax))}" fill="${color}" opacity="${n(between(0.08, 0.55))}"/>`
    );
  }
  return out.join('');
}

const BLUE = '#2aa8ff';
const BLUE_DEEP = '#0b6bd0';
const RED = '#f0342a';
const RED_DEEP = '#b0140f';
const TAU = Math.PI * 2;

/* ---- HERO: blue dominates behind the player, red dominates the right edge ---- */
parts.push(`<g filter="url(#soft)">`);
parts.push(arcBurst({ cx: 430, cy: 250, from: 70, to: 430, a0: 0, a1: TAU, count: 150, color: BLUE, o0: 0.04, o1: 0.3 }));
parts.push(rayBurst({ cx: 430, cy: 250, from: 90, to: 400, a0: 0, a1: TAU, count: 130, color: BLUE, o0: 0.05, o1: 0.42 }));
parts.push(branches({ cx: 430, cy: 250, from: 120, to: 420, a0: Math.PI * 0.55, a1: Math.PI * 1.55, count: 26, color: BLUE_DEEP, o0: 0.12, o1: 0.4 }));
parts.push(rayBurst({ cx: 150, cy: 300, from: 40, to: 300, a0: -0.9, a1: 0.9, count: 60, color: BLUE_DEEP, o0: 0.05, o1: 0.3 }));
parts.push(rayBurst({ cx: 60, cy: 150, from: 30, to: 240, a0: -0.4, a1: 1.2, count: 45, color: BLUE, o0: 0.04, o1: 0.24 }));
parts.push(motes({ cx: 420, cy: 250, radius: 380, count: 130, color: BLUE }));

parts.push(rayBurst({ cx: 985, cy: 265, from: 60, to: 470, a0: Math.PI * 0.52, a1: Math.PI * 1.48, count: 150, color: RED, o0: 0.06, o1: 0.5 }));
parts.push(arcBurst({ cx: 985, cy: 265, from: 80, to: 470, a0: Math.PI * 0.5, a1: Math.PI * 1.5, count: 110, color: RED_DEEP, o0: 0.05, o1: 0.32 }));
parts.push(branches({ cx: 985, cy: 265, from: 110, to: 460, a0: Math.PI * 0.6, a1: Math.PI * 1.4, count: 24, color: RED, o0: 0.1, o1: 0.36 }));
parts.push(motes({ cx: 930, cy: 265, radius: 300, count: 90, color: RED }));
parts.push(rayBurst({ cx: 250, cy: 470, from: 40, to: 260, a0: Math.PI * 1.05, a1: Math.PI * 1.95, count: 40, color: RED_DEEP, o0: 0.04, o1: 0.2 }));
parts.push(`</g>`);

/* ---- COMPARISON band: restrained cross-fire around the VS badge ---- */
parts.push(`<g filter="url(#soft)" opacity="0.75">`);
parts.push(rayBurst({ cx: 543, cy: 616, from: 45, to: 260, a0: 0, a1: TAU, count: 55, color: BLUE, o0: 0.03, o1: 0.24 }));
parts.push(rayBurst({ cx: 543, cy: 616, from: 45, to: 230, a0: Math.PI * 0.5, a1: Math.PI * 1.5, count: 40, color: RED, o0: 0.03, o1: 0.22 }));
parts.push(motes({ cx: 543, cy: 616, radius: 210, count: 45, color: BLUE }));
parts.push(`</g>`);

/* ---- MATCH MODEL: convergent blue field with red flanks ---- */
parts.push(`<g filter="url(#soft)">`);
parts.push(arcBurst({ cx: 560, cy: 985, from: 60, to: 400, a0: 0, a1: TAU, count: 110, color: BLUE, o0: 0.04, o1: 0.3 }));
parts.push(rayBurst({ cx: 560, cy: 985, from: 80, to: 380, a0: 0, a1: TAU, count: 90, color: BLUE_DEEP, o0: 0.04, o1: 0.34 }));
parts.push(branches({ cx: 560, cy: 985, from: 110, to: 380, a0: 0, a1: TAU, count: 20, color: BLUE, o0: 0.08, o1: 0.3 }));
parts.push(rayBurst({ cx: 120, cy: 1010, from: 40, to: 300, a0: -1.1, a1: 1.1, count: 60, color: RED, o0: 0.04, o1: 0.3 }));
parts.push(rayBurst({ cx: 960, cy: 900, from: 50, to: 330, a0: Math.PI * 0.55, a1: Math.PI * 1.45, count: 70, color: RED, o0: 0.04, o1: 0.32 }));
parts.push(motes({ cx: 560, cy: 985, radius: 340, count: 90, color: BLUE }));
parts.push(`</g>`);

/* ---- LOWER RIGHT red wash through the graphics rail ---- */
parts.push(`<g filter="url(#soft)" opacity="0.8">`);
parts.push(rayBurst({ cx: 990, cy: 1300, from: 50, to: 340, a0: Math.PI * 0.55, a1: Math.PI * 1.45, count: 70, color: RED, o0: 0.03, o1: 0.26 }));
parts.push(rayBurst({ cx: -30, cy: 1200, from: 40, to: 260, a0: -1.0, a1: 1.0, count: 40, color: BLUE_DEEP, o0: 0.03, o1: 0.2 }));
parts.push(`</g>`);

/* ---- CTA: neon ball halo ---- */
parts.push(`<g filter="url(#soft)">`);
parts.push(rayBurst({ cx: 832, cy: 1558, from: 46, to: 250, a0: 0, a1: TAU, count: 110, color: BLUE, o0: 0.06, o1: 0.5 }));
parts.push(arcBurst({ cx: 832, cy: 1558, from: 50, to: 230, a0: 0, a1: TAU, count: 70, color: BLUE_DEEP, o0: 0.05, o1: 0.3 }));
parts.push(motes({ cx: 832, cy: 1558, radius: 200, count: 70, color: BLUE }));
parts.push(rayBurst({ cx: 620, cy: 1560, from: 40, to: 200, a0: Math.PI * 0.6, a1: Math.PI * 1.4, count: 35, color: RED, o0: 0.03, o1: 0.2 }));
parts.push(`</g>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" fill="none" aria-hidden="true">
<defs><filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.45"/></filter></defs>
${parts.join('\n')}
</svg>
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, svg);
console.log(`energy-field.svg written (${(svg.length / 1024).toFixed(1)} kB)`);
