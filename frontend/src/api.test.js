import { describe, test, expect, vi, afterEach, beforeEach } from 'vitest';
import { validateFeed, getRules, askAgent, login, logout } from './api.js';
import { getToken, clearToken } from './authClient.js';

function mockFetchOnce(body, { ok = true, status = 200 } = {}) {
  global.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve(body),
  });
}

describe('api.js', () => {
  beforeEach(() => {
    clearToken();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearToken();
  });

  test('login exchanges an apiKey for a token and persists it', async () => {
    mockFetchOnce({ token: 'jwt-abc', expiresIn: '15m', tokenType: 'Bearer' });

    await login('sk_demo_test');

    expect(global.fetch).toHaveBeenCalledWith('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk_demo_test' }),
    });
    expect(getToken()).toBe('jwt-abc');
  });

  test('once logged in, subsequent requests carry the Authorization header', async () => {
    mockFetchOnce({ token: 'jwt-xyz', expiresIn: '15m', tokenType: 'Bearer' });
    await login('sk_demo_test');

    mockFetchOnce([{ id: 'invalid-price' }]);
    await getRules();

    expect(global.fetch).toHaveBeenCalledWith('/api/rules', {
      headers: { Authorization: 'Bearer jwt-xyz' },
    });
  });

  test('a 401 response clears the stored token', async () => {
    mockFetchOnce({ token: 'jwt-expiring', expiresIn: '15m', tokenType: 'Bearer' });
    await login('sk_demo_test');
    expect(getToken()).toBe('jwt-expiring');

    mockFetchOnce({ error: 'Invalid or expired token.' }, { ok: false, status: 401 });
    await expect(getRules()).rejects.toThrow();

    expect(getToken()).toBeNull();
  });

  test('logout clears the stored token', async () => {
    mockFetchOnce({ token: 'jwt-abc', expiresIn: '15m', tokenType: 'Bearer' });
    await login('sk_demo_test');

    logout();

    expect(getToken()).toBeNull();
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

    expect(global.fetch).toHaveBeenCalledWith('/api/rules', { headers: {} });
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
