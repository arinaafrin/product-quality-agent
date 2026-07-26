const request = require('supertest');
const { app } = require('../src/server');

describe('GET /api/health', () => {
  test('responds 200 with status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('POST /api/validate', () => {
  test('rejects a non-array body with 400', async () => {
    const res = await request(app).post('/api/validate').send({ records: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  test('validates a small feed and returns a summary', async () => {
    const res = await request(app)
      .post('/api/validate')
      .send({
        records: [
          {
            sku: 'FDS-10234',
            title: 'Kaari Pendant Lamp',
            price: 289,
            currency: 'EUR',
            category: 'lighting',
            imageUrl: 'https://cdn.fds.example/kaari-pendant.jpg',
          },
          { sku: 'FDS-BAD', title: '', price: -1, currency: 'RUB', category: 'patio', imageUrl: 'not-a-url' },
        ],
      });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.rejected).toBe(1);
  });
});

describe('GET /api/rules', () => {
  test('returns the rule catalog', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
