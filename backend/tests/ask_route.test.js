const request = require('supertest');

describe('POST /api/ask', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    jest.resetModules();
  });

  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('rejects a missing question with 400', async () => {
    const { app } = require('../src/server');
    const res = await request(app).post('/api/ask').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question/i);
  });

  test('rejects a non-string question with 400', async () => {
    const { app } = require('../src/server');
    const res = await request(app).post('/api/ask').send({ question: 42 });
    expect(res.status).toBe(400);
  });

  test('returns a grounded offline-mode answer for a valid question', async () => {
    const { app } = require('../src/server');
    const res = await request(app)
      .post('/api/ask')
      .send({ question: 'why does invalid currency get rejected?' });

    expect(res.status).toBe(200);
    expect(res.body.mode).toBe('offline');
    expect(typeof res.body.answer).toBe('string');
    expect(Array.isArray(res.body.toolCalls)).toBe(true);
  });

  test('returns 500 with a generic message if the agent throws', async () => {
    jest.doMock('../src/agent', () => ({
      ask: jest.fn().mockRejectedValue(new Error('boom')),
    }));
    const { app } = require('../src/server');
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

    const res = await request(app).post('/api/ask').send({ question: 'anything' });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/agent failed/i);
    errorSpy.mockRestore();
  });
});
