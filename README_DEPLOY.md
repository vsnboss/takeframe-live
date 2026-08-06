# TAKEFRAME LIVE — CEO Rebuild Package

This is a fresh static website package prepared as a clean replacement for earlier layered builds.

## Package contents
- `index.html`
- `styles.css`
- `script.js`
- `vercel.json`
- `assets/` (logo, hero player, UI graphics, favicon)
- `fonts/` (local Squadra family files for the heading system)

## Recommended deployment location
Deploy the contents of this package to the **root** of the `takeframe-live` repository, replacing the previous landing page files.

## Clean replacement steps
1. Delete old landing page files from the site root:
   - old `index.html`
   - old CSS / JS files tied to the previous page
   - old unused Takeframe landing assets if you want a fully clean repo root
2. Copy **all files and folders from this package** into the repository root.
3. Commit and push.
4. Vercel will auto-deploy.

## Important notes
- This package is a real interactive webpage, not a flat image.
- Demo buttons open an interactive modal.
- Graphics row arrows are interactive.
- The page is responsive for desktop, tablet, and mobile.
- Contact reference email in the modal is `office@vsn.hr`.

## Suggested repository structure after replacement
.
├── index.html
├── styles.css
├── script.js
├── vercel.json
├── assets/
└── fonts/
