# TAKEFRAME website positioning v1 verification

Recovered source was validated locally at 390×844, 430×932, 768×1024, 1366×768 and 1705×862.

Checks completed:
- homepage and all local assets load
- navigation links resolve
- mobile navigation opens, closes, supports Escape and restores focus
- no dead Pricing anchor
- Operator Gear, Pilot and Privacy routes load
- form validates required fields and uses a truthful mailto fallback
- no Sign in placeholder
- no Cloud-first or NDI-first claim
- no unsupported broadcaster trust claim
- no fake league ticker
- visible focus styles
- reduced-motion support
- no horizontal overflow in tested viewports

Production was not modified during recovery.

## Approved-composition rebuild (pixel-fidelity pass)

Rebuilt `index.html`, `takeframe-rebuild.css` and `takeframe-rebuild.js` against the
approved 941 x 1672 reference. Verified with `scripts/shots.mjs` (screenshot capture +
reference-grid geometry probe) and `scripts/verify.mjs` (32 functional checks).

Desktop scale: `--s = viewport / 941`, uncapped. At 1863px this resolves to 1.98 and the
composition fills the full viewport width with zero side gutters. Below 900px the canvas
transform is released into a real stacked flow layout.

Checks passing: no console errors, official logo and hero player both render, headline
breaks are FROM / TEAM SHEET / TO LIVE / GRAPHICS., all six nav anchors resolve and scroll,
three demo CTAs open the modal, form blocks empty submits and validates when complete,
mobile burger nav opens and closes, and no horizontal overflow at 320/390/768/941/1280/
1440/1863/2560px.
