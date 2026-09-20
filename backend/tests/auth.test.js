const request = require('supertest');
const jwt = require('jsonwebtoken');

describe('POST /api/auth/token', () => {
  const originalKeys = process.env.API_KEYS;

  beforeEach(() => {
    process.env.API_KEYS = 'demo:sk_demo_test_key,acme:sk_acme_test_key';
    jest.resetModules();
  });

  afterAll(() => {
    if (originalKeys) process.env.API_KEYS = originalKeys;
    else delete process.env.API_KEYS;
  });

  test('rejects a missing apiKey with 400', async () => {
    const { app } = require('../src/server');
    const res = await request(app).post('/api/auth/token').send({});
    expect(res.status).toBe(400);
  });

  test('rejects an unknown apiKey with 401', async () => {
    const { app } = require('../src/server');
    const res = await request(app).post('/api/auth/token').send({ apiKey: 'not-a-real-key' });
    expect(res.status).toBe(401);
  });

  test('issues a JWT carrying the correct tenantId for a valid apiKey', async () => {
    const { app } = require('../src/server');
    const res = await request(app).post('/api/auth/token').send({ apiKey: 'sk_demo_test_key' });
    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(typeof res.body.token).toBe('string');

    const decoded = jwt.decode(res.body.token);
    expect(decoded.tenantId).toBe('demo');
  });

  test('different keys resolve to different tenants', async () => {
    const { app } = require('../src/server');
    const demoRes = await request(app).post('/api/auth/token').send({ apiKey: 'sk_demo_test_key' });
    const acmeRes = await request(app).post('/api/auth/token').send({ apiKey: 'sk_acme_test_key' });

    expect(jwt.decode(demoRes.body.token).tenantId).toBe('demo');
    expect(jwt.decode(acmeRes.body.token).tenantId).toBe('acme');
  });

  test('the issued token actually authorizes a protected route', async () => {
    const { app } = require('../src/server');
    const tokenRes = await request(app).post('/api/auth/token').send({ apiKey: 'sk_demo_test_key' });

    const rulesRes = await request(app)
      .get('/api/rules')
      .set('Authorization', `Bearer ${tokenRes.body.token}`);
    expect(rulesRes.status).toBe(200);
  });
});
