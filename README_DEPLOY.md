# TAKEFRAME LIVE — Proper interactive website

This is a real responsive HTML/CSS/JavaScript website. It does not use the reference screenshot as a webpage background.

## Files

- `index.html` — semantic site structure
- `site.css` — responsive visual system and animations
- `site.js` — navigation, reveal animation, carousel, console controls and demo modal
- `assets/hero-player.png` — supplied transparent player asset
- `assets/takeframe-logo.png` — official TAKEFRAME LIVE logo
- `assets/favicon.png` — favicon
- `vercel.json` — Vercel static-site settings

## Deployment to the existing GitHub/Vercel project

1. Open the root of the `vsnboss/takeframe-live` repository.
2. Preserve the hidden `.git` folder.
3. Remove the old website files from the repository root.
4. Extract all files from this package into that repository root.
5. Commit and push to `main`.
6. Vercel will deploy the new static site automatically.

## Local preview

Run one of these commands from the extracted folder:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.
