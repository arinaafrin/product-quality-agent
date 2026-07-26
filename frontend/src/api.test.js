import { describe, test, expect, vi, afterEach } from 'vitest';
import { validateFeed, getRules, askAgent } from './api.js';

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('api.js', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('validateFeed posts records to /api/validate and resolves with the parsed summary', async () => {
    mockFetchOnce({ total: 1, passed: 1, rejected: 0, results: [] });
    const records = [{ sku: 'FDS-1' }];

    const result = await validateFeed(records);

    expect(global.fetch).toHaveBeenCalledWith('/api/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records }),
    });
    expect(result).toEqual({ total: 1, passed: 1, rejected: 0, results: [] });
  });

  test('getRules fetches /api/rules and resolves with the parsed rule list', async () => {
    mockFetchOnce([{ id: 'invalid-price' }]);

    const result = await getRules();

    expect(global.fetch).toHaveBeenCalledWith('/api/rules');
    expect(result).toEqual([{ id: 'invalid-price' }]);
  });

  test('askAgent posts the question to /api/ask and resolves with the agent payload', async () => {
    mockFetchOnce({ answer: 'hi there', mode: 'offline', toolCalls: [] });

    const result = await askAgent('why?');

    expect(global.fetch).toHaveBeenCalledWith('/api/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'why?' }),
    });
    expect(result.answer).toBe('hi there');
  });

  test('rejects with the server-provided error message on a non-ok response', async () => {
    mockFetchOnce({ error: 'Request body must be { "question": "..." }' }, { ok: false, status: 400 });

    await expect(askAgent('')).rejects.toThrow('Request body must be { "question": "..." }');
  });

  test('falls back to a generic message when the error body cannot be parsed as JSON', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(getRules()).rejects.toThrow('Request failed with status 500');
  });
});
