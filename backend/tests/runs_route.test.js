const request = require('supertest');
const { authHeader } = require('./helpers/authHeader');

function freshApp() {
  jest.resetModules();
  return require('../src/server').app;
}

describe('GET /api/runs and /api/runs/latest', () => {
  test('with no runs yet: /runs is an empty list and /runs/latest is 404', async () => {
    const app = freshApp();
    const headers = authHeader('tenant-empty');

    const listRes = await request(app).get('/api/runs').set(headers);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);

    const latestRes = await request(app).get('/api/runs/latest').set(headers);
    expect(latestRes.status).toBe(404);
    expect(latestRes.body.error).toMatch(/no validation runs/i);
  });

  test('after a validate run: /runs lists a summary without the record dump, /runs/latest returns the full run', async () => {
    const app = freshApp();
    const headers = authHeader('tenant-a');
    const records = [
      {
        sku: 'FDS-1',
        title: 'Test Lamp',
        price: 42,
        currency: 'EUR',
        category: 'lighting',
        imageUrl: 'https://cdn.fds.example/lamp.jpg',
      },
    ];
    await request(app).post('/api/validate').set(headers).send({ records });

    const listRes = await request(app).get('/api/runs').set(headers);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].total).toBe(1);
    expect(listRes.body[0].results).toBeUndefined();

    const latestRes = await request(app).get('/api/runs/latest').set(headers);
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.total).toBe(1);
    expect(Array.isArray(latestRes.body.results)).toBe(true);
  });

  test('most recent run is returned first by /runs/latest', async () => {
    const app = freshApp();
    const headers = authHeader('tenant-b');
    await request(app)
      .post('/api/validate')
      .set(headers)
      .send({ records: [{ sku: 'FIRST', title: 'A', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' }] });
    await request(app)
      .post('/api/validate')
      .set(headers)
      .send({
        records: [
          { sku: 'SECOND-1', title: 'B', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' },
          { sku: 'SECOND-2', title: 'C', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' },
        ],
      });

    const latestRes = await request(app).get('/api/runs/latest').set(headers);
    expect(latestRes.body.total).toBe(2);

    const listRes = await request(app).get('/api/runs').set(headers);
    expect(listRes.body).toHaveLength(2);
    expect(listRes.body[0].total).toBe(2);
    expect(listRes.body[1].total).toBe(1);
  });

  // Regression test for the tenant-isolation bug fixed in this update:
  // runHistory used to be one array shared by every caller, so any client
  // could read any other client's validation runs via GET /api/runs.
  test('SECURITY: one tenant cannot see another tenant\'s validation runs', async () => {
    const app = freshApp();
    const tenantAHeaders = authHeader('tenant-alpha');
    const tenantBHeaders = authHeader('tenant-beta');

    await request(app)
      .post('/api/validate')
      .set(tenantAHeaders)
      .send({
        records: [{ sku: 'SECRET-1', title: 'Confidential Item', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' }],
      });

    // Tenant B has made no validation calls of their own.
    const tenantBRuns = await request(app).get('/api/runs').set(tenantBHeaders);
    expect(tenantBRuns.status).toBe(200);
    expect(tenantBRuns.body).toEqual([]);

    const tenantBLatest = await request(app).get('/api/runs/latest').set(tenantBHeaders);
    expect(tenantBLatest.status).toBe(404);

    // Tenant A still sees their own run.
    const tenantARuns = await request(app).get('/api/runs').set(tenantAHeaders);
    expect(tenantARuns.status).toBe(200);
    expect(tenantARuns.body).toHaveLength(1);
  });
});
