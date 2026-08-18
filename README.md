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

`design/img/*.webp` are derived from `assets/media/`. `match-ready.webp` is
cropped to 1780px wide to exclude a transient OS colour picker that was open
when the original screenshot was taken.

## Design system

Taken from the shipping TAKEFRAME Control UI rather than invented:

| Token | Value | Use |
| --- | --- | --- |
| background | `#04070B` / `#06090E` | Page and alternating bands |
| panel | `#080C12` | Cards, tables, chain steps |
| mint | `#3EE9A8` | Product accent, canonical/approved state |
| take | `#2F9BF5` | TAKE and preview actions |
| on air | `#E8123F` | PROGRAM, OUT, ARMED |
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
- The real TAKEFRAME logo vector (header/footer currently use an SVG drawn in
  the spirit of the in-app mark)
