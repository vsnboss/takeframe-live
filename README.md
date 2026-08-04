# TAKEFRAME.live

Public product website for TAKEFRAME, a VSN sports broadcast graphics system.

## Current milestone

- responsive public homepage
- product positioning
- Split Pulse graphics package showcase
- operator workflow explanation
- output and compatibility positioning
- early-access conversion section
- Vercel configuration

## Architecture boundary

The website is cloud-hosted, while live graphics playout remains local-first and independent of website availability. Website, account or domain outages must never stop the local renderer or operator workflow.

## Local preview

Serve the repository root with any static HTTP server, for example:

```bash
npx serve .
```

## Deployment

The repository is prepared for Vercel deployment. The production domain will be `takeframe.live` with `www.takeframe.live` redirected to the canonical apex domain.

## Ownership

TAKEFRAME is a VSN product. DPS.SBS is not the product identity.
