/**
 * Generates assets/audience-texture.svg — the dark stadium/crowd imagery that
 * sits behind the audience cards. Coded placeholder standing in for the final
 * photography; deterministic so the committed asset is stable.
 *
 * Run: node scripts/build-audience-texture.mjs
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../assets/audience-texture.svg');
const W = 1200;
const H = 320;

let seed = 0x2545f491;
const rnd = () => {
  seed ^= seed << 13; seed >>>= 0;
  seed ^= seed >> 17;
  seed ^= seed << 5; seed >>>= 0;
  return seed / 0xffffffff;
};
const between = (a, b) => a + (b - a) * rnd();
const n = (v) => Math.round(v * 10) / 10;

const parts = [];

/* stands — tiered bands of crowd specks, denser and cooler toward the back */
for (let tier = 0; tier < 7; tier++) {
  const y0 = 8 + tier * 22;
  const rows = 3;
  const fade = 0.5 - tier * 0.045;
  for (let r = 0; r < rows; r++) {
    const y = y0 + r * 6.5;
    for (let x = -10; x < W + 10; x += between(5, 11)) {
      const warm = rnd() > 0.72;
      const c = warm ? '#8d7f6c' : '#6d7c8f';
      parts.push(
        `<rect x="${n(x)}" y="${n(y + between(-1.4, 1.4))}" width="${n(between(2.4, 4.6))}" height="${n(between(3.2, 5.4))}" rx="1.4" fill="${c}" opacity="${n(Math.max(0.05, between(fade * 0.4, fade)))}"/>`
      );
    }
  }
}

/* structural bands between tiers — barriers / gangways */
for (let tier = 1; tier < 7; tier++) {
  parts.push(
    `<rect x="0" y="${8 + tier * 22 - 4}" width="${W}" height="1.6" fill="#0d151f" opacity="0.55"/>`
  );
}

/* floodlight bloom */
for (const [cx, r, o] of [[180, 150, 0.28], [620, 190, 0.22], [1040, 160, 0.26]]) {
  parts.push(`<circle cx="${cx}" cy="10" r="${r}" fill="url(#bloom)" opacity="${o}"/>`);
}

/* foreground figures — soft silhouettes, deliberately unresolved */
const figure = (x, y, s, o) => {
  const g = [];
  g.push(`<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(9 * s)}" ry="${n(10.5 * s)}"/>`);
  g.push(
    `<path d="M${n(x - 17 * s)} ${n(y + 66 * s)}q0-40 ${n(17 * s)}-46 ${n(17 * s)} 6 ${n(17 * s)} 46z"/>`
  );
  return `<g fill="#05090f" opacity="${o}">${g.join('')}</g>`;
};
for (let i = 0; i < 9; i++) {
  const x = between(20, W - 20);
  parts.push(figure(x, between(196, 232), between(0.85, 1.35), between(0.5, 0.86)));
}

/* pitch-side glow along the bottom */
parts.push(`<rect x="0" y="${H - 96}" width="${W}" height="96" fill="url(#ground)"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
<defs>
  <radialGradient id="bloom"><stop offset="0" stop-color="#dbe6f2"/><stop offset="1" stop-color="#dbe6f2" stop-opacity="0"/></radialGradient>
  <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1119" stop-opacity="0"/><stop offset="1" stop-color="#05090f"/></linearGradient>
</defs>
<rect width="${W}" height="${H}" fill="#141a22"/>
${parts.join('\n')}
</svg>
`;

writeFileSync(OUT, svg);
console.log(`audience-texture.svg written (${(svg.length / 1024).toFixed(1)} kB)`);
