/**
 * MSW Server Setup for Node.js Tests
 */

const { setupServer } = require('msw/node');
const { handlers } = require('./handlers');

export const server = setupServer(...handlers);
