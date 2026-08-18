# TAKEFRAME — website design

Commercial website design for **TAKEFRAME**, VSN's professional football
broadcast graphics and live-production system.

## Layout

```
design/
  Main.dc.html      Homepage — desktop artboard (1440 × 14994)
  Mobile.dc.html    Homepage — mobile artboard (390 × 4706)
  canvas.json       Artboard layout, titles and handover notes
  img/              Downsampled webp derivatives used by the artboards
assets/media/       Original TAKEFRAME product media (source of truth)
```

`design/img/*.webp` are derived from `assets/media/` and `assets/logos/`.
`match-ready.webp` is cropped to 1780px wide to exclude a transient OS colour
picker that was open when the original screenshot was taken.
`takeframe-lockup.webp` is the official horizontal lockup, tight-cropped to its
alpha bounds and exported at 640px wide.

## Logo assets

`assets/logos/` holds the supplied originals (transparent PNG unless noted):

| File | Use |
| --- | --- |
| `lockup.png` | Horizontal lockup — **used in the header and footer** |
| `lockup-live.png` / `lockup-live-alt.png` / `lockup-live-wide.png` | Lockup with the red LIVE badge |
| `mark.png` | Icon only — arrow and frame |
| `app-icon.png` | Rounded-square app icon |
| `badge-circular.png` | Circular badge |
| `lockup-mono-white.png` | Mono white, for busy or single-colour backgrounds |
| `lockup-on-light.png` | Navy wordmark for light backgrounds (opaque) |
| `lockup-stacked.png`, `lockup-presentation.png` | Presentation renders |

The site uses the plain **TAKEFRAME** lockup rather than the LIVE variant,
because the product brief names the product TAKEFRAME.

## Design system

Taken from the shipping TAKEFRAME Control UI rather than invented:

Surfaces come from the shipping Control UI; the accent colours are sampled
from the official logo files in `assets/logos/`.

| Token | Value | Use |
| --- | --- | --- |
| background | `#04070B` / `#06090E` | Page and alternating bands |
| panel | `#080C12` | Cards, tables, chain steps |
| brand | `#00B0F0` | Accent, canonical/approved state — logo arrow core |
| take | `#0080E0` | TAKE — logo arrow deep facet |
| on air | `#E4001B` | PROGRAM, OUT, ARMED — logo corner tick / LIVE badge |
| amber | `#F0A81E` | NEEDS REVIEW |

Type: **Saira Condensed** (display), **IBM Plex Sans** (body), **IBM Plex Mono**
(labels and technical readouts), loaded from Google Fonts.

## Claim discipline

Copy is limited to verified capability: NDI and OMT output, Windows operator
application, local-first operation, Preview/Program/Take playout, up to five
substitution exchanges, penalty shoot-out controller, two-leg aggregate,
provider-**ready** adapter architecture. No named data provider, no SDI or
fill/key, no cloud playout, no certification claims.

## Rebuilding the canvas

The published canvas is generated, not committed. Re-seed with the `design`
skill's helper:

```
node <skill>/seed-canvas.mjs \
  --template <skill>/payload.template.html \
  --out design/takeframe-website.html \
  --title "TAKEFRAME Website" \
  --artboard design/Main.dc.html --artboard design/Mobile.dc.html \
  --canvas design/canvas.json \
  --image design/img/<each>.webp
```

## Still to supply

- `[SALES EMAIL]` and `[PHONE NUMBER]` in the contact block
- `[SHOWREEL VIDEO]` — the match showreel slot under section 01
- A vector (SVG/EPS) of the lockup would beat the supplied PNGs for crispness
  at large sizes and for print

## The website

`site/` is the real, deployable website built from the design — static HTML and
CSS, no framework, no build step.

```
site/
  index.html          Single-page site
  styles.css          Design tokens + responsive layout
  fonts.css           Self-hosted @font-face rules
  vercel.json         Cache and security headers
  robots.txt
  assets/             Images (webp, two widths for srcset), OG image, favicons
  assets/fonts/       Saira Condensed + IBM Plex woff2 (latin, latin-ext)
```

Notes:

- **Fonts are self-hosted**, not loaded from Google Fonts. Broadcast facilities
  often run locked-down networks, and it removes a render-blocking third-party
  request. Both families are open-licensed (SIL OFL).
- Images ship at 900px and 1600px with `srcset`; everything below the fold is
  lazy-loaded. The page makes **no external requests at all**.
- Verified with no horizontal overflow at 320, 390, 600, 768, 1024, 1280, 1440
  and 1920px.

Preview locally with any static server, e.g. `python3 -m http.server` in `site/`.
