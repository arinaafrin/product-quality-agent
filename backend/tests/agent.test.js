const { ask } = require('../src/agent');

describe('agent.ask (offline mode, no ANTHROPIC_API_KEY set)', () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;

  beforeAll(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  });

  test('answers a rule question by retrieving from the knowledge base, no key needed', async () => {
    const result = await ask('why does an invalid currency get rejected?');
    expect(result.mode).toBe('offline');
    expect(result.answer.toLowerCase()).toContain('currency');
    expect(result.toolCalls.length).toBeGreaterThan(0);
  });

  test('gives a plain "not found" answer for an unrelated question', async () => {
    const result = await ask('zzzz_completely_unrelated_query_qqqq');
    expect(result.answer.toLowerCase()).toContain("couldn't find");
  });
});
