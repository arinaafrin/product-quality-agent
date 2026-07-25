const { validateFeed, validateRecord } = require('../src/quality_engine');

const goodRecord = {
  sku: 'FDS-10234',
  title: 'Kaari Pendant Lamp',
  price: 289,
  currency: 'EUR',
  category: 'lighting',
  imageUrl: 'https://cdn.fds.example/kaari-pendant.jpg',
};

describe('validateRecord', () => {
  test('a fully valid record passes with no failures', () => {
    expect(validateRecord(goodRecord)).toEqual([]);
  });

  test('missing title is flagged as an error', () => {
    const failures = validateRecord({ ...goodRecord, title: '' });
    expect(failures).toContainEqual(
      expect.objectContaining({ ruleId: 'missing-title', severity: 'error' })
    );
  });

  test('negative price is flagged as an error', () => {
    const failures = validateRecord({ ...goodRecord, price: -5 });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-price' }));
  });

  test('non-numeric price is flagged as an error', () => {
    const failures = validateRecord({ ...goodRecord, price: 'free' });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-price' }));
  });

  test('unsupported currency is flagged', () => {
    const failures = validateRecord({ ...goodRecord, currency: 'RUB' });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-currency' }));
  });

  test('http (non-https) image url is flagged', () => {
    const failures = validateRecord({ ...goodRecord, imageUrl: 'http://cdn.fds.example/a.jpg' });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'broken-image' }));
  });

  test('unknown category is a warning, not an error', () => {
    const failures = validateRecord({ ...goodRecord, category: 'patio' });
    const failure = failures.find((f) => f.ruleId === 'invalid-category');
    expect(failure.severity).toBe('warning');
  });

  test('malformed sku is flagged', () => {
    const failures = validateRecord({ ...goodRecord, sku: 'FDS10234' });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-sku-format' }));
  });
});

describe('validateFeed', () => {
  test('detects duplicate SKUs across the feed', () => {
    const summary = validateFeed([goodRecord, { ...goodRecord }]);
    expect(summary.total).toBe(2);
    expect(summary.rejected).toBe(2);
    for (const result of summary.results) {
      expect(result.failures.some((f) => f.ruleId === 'duplicate-sku')).toBe(true);
    }
  });

  test('counts passed vs rejected correctly on a mixed feed', () => {
    const badRecord = { ...goodRecord, sku: 'FDS-99999', price: -1 };
    const summary = validateFeed([goodRecord, badRecord]);
    expect(summary.total).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.rejected).toBe(1);
  });

  test('a record with only a category warning still counts as passed', () => {
    const warnRecord = { ...goodRecord, sku: 'FDS-55555', category: 'patio' };
    const summary = validateFeed([warnRecord]);
    expect(summary.rejected).toBe(0);
    expect(summary.results[0].status).toBe('passed_with_warnings');
  });
});
