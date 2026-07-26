const { RagStore } = require('../src/rag_store');

describe('RagStore', () => {
  test('loads the bundled knowledge base on construction', () => {
    const store = new RagStore();
    expect(store.docs.length).toBeGreaterThan(0);
    expect(store.docs.some((d) => d.source === 'validation-rules.md')).toBe(true);
  });

  test('search retrieves rule docs relevant to the query', () => {
    const store = new RagStore();
    const results = store.search('duplicate sku', 3);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].text.toLowerCase()).toContain('duplicate');
  });

  test('ingested validation runs become retrievable', () => {
    const store = new RagStore();
    store.ingestValidationRun({
      timestamp: '2026-07-25T00:00:00.000Z',
      total: 2,
      passed: 1,
      rejected: 1,
      results: [
        {
          sku: 'FDS-1',
          title: 'Test Lamp',
          failures: [{ ruleId: 'invalid-price', message: 'Price -1 must be greater than 0.' }],
        },
        { sku: 'FDS-2', title: 'Test Chair', failures: [] },
      ],
    });
    const results = store.search('why did the last run reject records price', 5);
    expect(results.some((r) => r.type === 'validation_log')).toBe(true);
  });

  test('search returns an empty array for a query with no overlap', () => {
    const store = new RagStore();
    const results = store.search('zzzz_nonexistent_term_qqqq', 3);
    expect(results).toEqual([]);
  });
});
