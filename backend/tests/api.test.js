const request = require('supertest');
const { app } = require('../src/server');
const { authHeader } = require('./helpers/authHeader');

describe('GET /api/health', () => {
  test('responds 200 with status ok (no auth required)', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});

describe('auth requirement', () => {
  test('POST /api/validate without a token is rejected with 401', async () => {
    const res = await request(app).post('/api/validate').send({ records: [] });
    expect(res.status).toBe(401);
  });

  test('POST /api/validate with a malformed token is rejected with 401', async () => {
    const res = await request(app)
      .post('/api/validate')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ records: [] });
    expect(res.status).toBe(401);
  });

  test('GET /api/rules without a token is rejected with 401', async () => {
    const res = await request(app).get('/api/rules');
    expect(res.status).toBe(401);
  });
});

describe('POST /api/validate', () => {
  test('rejects a non-array body with 400', async () => {
    const res = await request(app)
      .post('/api/validate')
      .set(authHeader())
      .send({ records: 'not-an-array' });
    expect(res.status).toBe(400);
  });

  test('validates a small feed and returns a summary', async () => {
    const res = await request(app)
      .post('/api/validate')
      .set(authHeader())
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
    const res = await request(app).get('/api/rules').set(authHeader());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
