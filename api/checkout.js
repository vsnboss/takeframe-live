// Vercel repo-root entrypoint.
// The production takeframe-live-new project deploys from the repository root,
// while the canonical implementation remains under site/api for site-root deployments.
module.exports = require('../site/api/checkout.js');
