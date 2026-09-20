const request = require('supertest');
const { authHeader } = require('./helpers/authHeader');

describe('GET /api/sample-feed.*', () => {
  test('requires auth', async () => {
    const { app } = require('../src/server');
    const res = await request(app).get('/api/sample-feed.json');
    expect(res.status).toBe(401);
  });

  test('serves the product sample feed when ACTIVE_ENGINE is unset', async () => {
    delete process.env.ACTIVE_ENGINE;
    jest.resetModules();
    const { app } = require('../src/server');
    const res = await request(app).get('/api/sample-feed.json').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/sample_feed\.json/);
  });

  test('serves the invoice sample feed when ACTIVE_ENGINE=invoice', async () => {
    process.env.ACTIVE_ENGINE = 'invoice';
    jest.resetModules();
    const { app } = require('../src/server');
    const res = await request(app).get('/api/sample-feed.csv').set(authHeader());
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/sample_invoice_feed\.csv/);
    delete process.env.ACTIVE_ENGINE;
    jest.resetModules();
  });
});
