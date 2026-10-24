module.exports = {
  testEnvironment: 'node',
  testTimeout: 60000,
  coverageProvider: 'v8',
  collectCoverageFrom: ['src/**/*.js', '!src/mcp_server.js'],
  coverageDirectory: 'coverage',
};