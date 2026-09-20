describe('engine dispatcher (src/quality_engine.js)', () => {
  const originalEngine = process.env.ACTIVE_ENGINE;

  afterEach(() => {
    if (originalEngine) process.env.ACTIVE_ENGINE = originalEngine;
    else delete process.env.ACTIVE_ENGINE;
    jest.resetModules();
  });

  test('defaults to the product engine when ACTIVE_ENGINE is unset', () => {
    delete process.env.ACTIVE_ENGINE;
    jest.resetModules();
    const engine = require('../src/quality_engine');
    expect(engine.activeEngine).toBe('product');
    expect(engine.rules.some((r) => r.id === 'missing-title')).toBe(true);
  });

  test('switches to the invoice engine when ACTIVE_ENGINE=invoice', () => {
    process.env.ACTIVE_ENGINE = 'invoice';
    jest.resetModules();
    const engine = require('../src/quality_engine');
    expect(engine.activeEngine).toBe('invoice');
    expect(engine.rules.some((r) => r.id === 'invalid-vat-rate')).toBe(true);
    expect(engine.rules.some((r) => r.id === 'missing-title')).toBe(false);
  });

  test('throws a clear error for an unknown engine name', () => {
    process.env.ACTIVE_ENGINE = 'sensor-logs';
    jest.resetModules();
    expect(() => require('../src/quality_engine')).toThrow(/Unknown engine "sensor-logs"/);
  });
});

describe('invoice engine rules', () => {
  const originalEngine = process.env.ACTIVE_ENGINE;

  beforeAll(() => {
    process.env.ACTIVE_ENGINE = 'invoice';
    jest.resetModules();
  });

  afterAll(() => {
    if (originalEngine) process.env.ACTIVE_ENGINE = originalEngine;
    else delete process.env.ACTIVE_ENGINE;
    jest.resetModules();
  });

  const goodInvoice = {
    invoiceNumber: 'INV-004821',
    vendorId: 'V-1042',
    amount: 1250,
    vatRate: 25.5,
    currency: 'EUR',
    invoiceDate: '2026-09-10',
  };

  test('a fully valid invoice passes with no failures', () => {
    const { validateRecord } = require('../src/quality_engine');
    expect(validateRecord(goodInvoice)).toEqual([]);
  });

  test('an unrecognized VAT rate is rejected', () => {
    const { validateRecord } = require('../src/quality_engine');
    const failures = validateRecord({ ...goodInvoice, vatRate: 21 });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-vat-rate' }));
  });

  test('a future-dated invoice is rejected', () => {
    const { validateRecord } = require('../src/quality_engine');
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 30);
    const failures = validateRecord({ ...goodInvoice, invoiceDate: farFuture.toISOString() });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'invalid-invoice-date' }));
  });

  test('duplicate invoice numbers in the same batch are flagged batch-wide', () => {
    const { validateFeed } = require('../src/quality_engine');
    const summary = validateFeed([goodInvoice, { ...goodInvoice, amount: 42 }]);
    const dupFailures = summary.results.flatMap((r) => r.failures).filter((f) => f.ruleId === 'duplicate-invoice-number');
    expect(dupFailures).toHaveLength(2);
  });

  test('a missing vendor is rejected', () => {
    const { validateRecord } = require('../src/quality_engine');
    const failures = validateRecord({ ...goodInvoice, vendorId: '' });
    expect(failures).toContainEqual(expect.objectContaining({ ruleId: 'missing-vendor' }));
  });
});
