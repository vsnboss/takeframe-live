// Vercel repo-root entrypoint.
// Keep the canonical webhook implementation under site/api so both Vercel root layouts work.
module.exports = require('../site/api/webhook.js');
