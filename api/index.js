// Vercel serverless entry
const serverless = require('serverless-http');
const app = require('../server/index.js'); // Express app exported in Vercel env
module.exports = serverless(app);
