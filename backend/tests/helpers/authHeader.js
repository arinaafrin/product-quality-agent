const { signToken } = require('../../src/auth');

/**
 * @param {string} [tenantId]
 * @returns {{ Authorization: string }}
 */
function authHeader(tenantId = 'test-tenant') {
  const { token } = signToken(tenantId);
  return { Authorization: `Bearer ${token}` };
}

module.exports = { authHeader };
