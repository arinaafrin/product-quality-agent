const request = require('supertest');

function freshApp() {
  jest.resetModules();
  return require('../src/server').app;
}

describe('GET /api/runs and /api/runs/latest', () => {
  test('with no runs yet: /runs is an empty list and /runs/latest is 404', async () => {
    const app = freshApp();

    const listRes = await request(app).get('/api/runs');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toEqual([]);

    const latestRes = await request(app).get('/api/runs/latest');
    expect(latestRes.status).toBe(404);
    expect(latestRes.body.error).toMatch(/no validation runs/i);
  });

  test('after a validate run: /runs lists a summary without the record dump, /runs/latest returns the full run', async () => {
    const app = freshApp();
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
    await request(app).post('/api/validate').send({ records });

    const listRes = await request(app).get('/api/runs');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].total).toBe(1);
    expect(listRes.body[0].results).toBeUndefined();

    const latestRes = await request(app).get('/api/runs/latest');
    expect(latestRes.status).toBe(200);
    expect(latestRes.body.total).toBe(1);
    expect(Array.isArray(latestRes.body.results)).toBe(true);
  });

  test('most recent run is returned first by /runs/latest', async () => {
    const app = freshApp();
    await request(app)
      .post('/api/validate')
      .send({ records: [{ sku: 'FIRST', title: 'A', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' }] });
    await request(app)
      .post('/api/validate')
      .send({
        records: [
          { sku: 'SECOND-1', title: 'B', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' },
          { sku: 'SECOND-2', title: 'C', price: 1, currency: 'EUR', category: 'x', imageUrl: 'https://a.b/c.jpg' },
        ],
      });

    const latestRes = await request(app).get('/api/runs/latest');
    expect(latestRes.body.total).toBe(2);

    const listRes = await request(app).get('/api/runs');
    expect(listRes.body).toHaveLength(2);
    expect(listRes.body[0].total).toBe(2);
    expect(listRes.body[1].total).toBe(1);
  });
});
