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
  index.html          Homepage
  pricing.html        Pricing, licence model, FAQ
  welcome.html        Post-purchase onboarding (plan-aware via ?plan=)
  account.html        My TAKEFRAME — licence and billing admin
  api/checkout.js     Server-side Lemon Squeezy checkout creation
  api/webhook.js      Signature-verified Lemon Squeezy webhook receiver
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


## Commerce

TAKEFRAME is sold as subscription or match-pass entitlement only — there is no
perpetual licence anywhere in the copy, and every paid plan carries the full
product. Public prices: Annual €1,690/yr, Monthly €169/mo, Match Pass €79, plus
a free 7-day watermarked evaluation. VAT is calculated at checkout.

### How a purchase flows

```
pricing page  →  /api/checkout?plan=…  →  Lemon Squeezy checkout
                                              ↓
                              /api/webhook (signature verified)
                                              ↓
                                   VSN licensing service
                                              ↓
                                /welcome?plan=…  (onboarding)
```

The browser only ever sends a plan slug (`annual`, `monthly`, `match-pass`,
`evaluation`). Store and variant identifiers and the API key stay server-side,
so no commercial configuration is exposed in client JavaScript. `/api/checkout`
validates the slug against an allowlist before calling the commerce API.

`/api/webhook` verifies the HMAC-SHA256 signature over the **raw** body with a
timing-safe compare, then hands the entitlement to the VSN licensing service.
Licence generation happens there — never in the browser, and never on the live
graphics path.

### Environment variables

Set these on the Vercel project. The four marked secret must never reach the
client.

| Variable | Secret | Purpose |
| --- | :---: | --- |
| `LEMONSQUEEZY_API_KEY` | ● | Creating checkouts |
| `LEMONSQUEEZY_STORE_ID` | | Store the checkout belongs to |
| `LEMONSQUEEZY_VARIANT_ANNUAL` | | Variant for the annual plan |
| `LEMONSQUEEZY_VARIANT_MONTHLY` | | Variant for the monthly plan |
| `LEMONSQUEEZY_VARIANT_MATCH_PASS` | | Variant for the match pass |
| `LEMONSQUEEZY_VARIANT_EVALUATION` | | Variant for the free evaluation |
| `LEMONSQUEEZY_WEBHOOK_SECRET` | ● | Verifying webhook signatures |
| `LICENSING_SERVICE_URL` | | Where entitlements are handed off |
| `LICENSING_SERVICE_TOKEN` | ● | Auth for that handoff |

Point the Lemon Squeezy webhook at `https://<domain>/api/webhook`.

Until these are set, the checkout CTAs redirect to `/pricing?checkout=unavailable`
and the page shows a plain notice rather than failing silently.

**The Vercel project's Root Directory must be `site`** — that is where `api/`
lives, and serverless functions are only picked up from the project root. The
repository-root `vercel.json` is a fallback that serves `site/` statically if the
project root is ever the repository itself; functions would not run in that case.

### Still to wire

- Lemon Squeezy products and the env vars above.
- The VSN licensing service endpoint (entitlements, registered machines,
  Match Pass activation, evaluation state, signed offline licences).
- `account.html` currently describes where licence and billing live rather than
  showing live data; it becomes a real view once the licensing service exists.

## Claim discipline in the commercial copy

Third-party production systems are described as **workflow compatible over
NDI®/OMT**, never as integrations or partnerships. No third-party logos are
used — text wordmarks only — pending brand permission. NDI® carries its
trademark attribution and a link to ndi.video in the footer of every page.
