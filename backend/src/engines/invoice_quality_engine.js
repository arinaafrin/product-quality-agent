const VALID_CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'SEK', 'DKK', 'NOK']);
// Finnish VAT rates (yleinen, alennettu, elintarvike/rehu, nolla). Kept small and
// explicit on purpose: a rate outside this set should be reviewed by a human, not
// silently accepted.
const VALID_VAT_RATES = new Set([0, 10, 14, 25.5]);
const INVOICE_NUMBER_RE = /^[A-Z]{0,4}-?\d{4,10}$/;
const MAX_FUTURE_DAYS = 1; // invoices dated more than 1 day in the future are suspicious

/**
 * @typedef {Object} Failure
 * @property {string} ruleId
 * @property {string} field
 * @property {string} message
 * @property {'error'|'warning'} severity
 */

const rules = [
  {
    id: 'missing-invoice-number',
    title: 'Missing invoice number',
    severity: 'error',
    description:
      'Every record must have a non-empty `invoiceNumber`. It is the primary key used to ' +
      'match the invoice against the vendor\'s own records and against prior imports.',
    check(record) {
      if (!record.invoiceNumber || !String(record.invoiceNumber).trim()) {
        return { field: 'invoiceNumber', message: 'Invoice number is missing or empty.' };
      }
      return null;
    },
  },
  {
    id: 'invalid-invoice-number-format',
    title: 'Malformed invoice number',
    severity: 'warning',
    description:
      'An invoice number should match `[PREFIX-]DIGITS` (4-10 digits, optional letter prefix), ' +
      'e.g. `2026-004821` or `INV-004821`. A malformed number is flagged for review rather than ' +
      'rejected outright, since some vendors use non-standard schemes.',
    check(record) {
      if (!record.invoiceNumber) return null; // covered by missing-invoice-number
      if (!INVOICE_NUMBER_RE.test(String(record.invoiceNumber).toUpperCase())) {
        return {
          field: 'invoiceNumber',
          message: `Invoice number "${record.invoiceNumber}" does not match the expected format.`,
        };
      }
      return null;
    },
  },
  {
    id: 'duplicate-invoice-number',
    title: 'Duplicate invoice number within the same batch',
    severity: 'error',
    description:
      'Each invoice number must appear only once per import batch. A duplicate almost always ' +
      'means the same invoice was exported twice, or two vendors reused the same numbering ' +
      'scheme — importing both would double-count the expense.',
    check() {
      return null; // computed batch-wide in validateFeed, same pattern as duplicate-sku
    },
  },
  {
    id: 'invalid-amount',
    title: 'Missing or invalid amount',
    severity: 'error',
    description:
      'The `amount` field must be present, numeric, and greater than 0. A negative, zero, or ' +
      'non-numeric amount is rejected outright — it either indicates a parsing error upstream ' +
      'or a credit note misfiled as an invoice.',
    check(record) {
      const amount = record.amount;
      if (amount === undefined || amount === null || amount === '') {
        return { field: 'amount', message: 'Amount is missing.' };
      }
      const num = Number(amount);
      if (Number.isNaN(num)) {
        return { field: 'amount', message: `Amount "${amount}" is not a number.` };
      }
      if (num <= 0) {
        return { field: 'amount', message: `Amount ${num} must be greater than 0.` };
      }
      return null;
    },
  },
  {
    id: 'invalid-vat-rate',
    title: 'Unrecognized VAT rate',
    severity: 'error',
    description:
      `The \`vatRate\` field must be one of: ${[...VALID_VAT_RATES].join(', ')} (percent). ` +
      'A rate outside this set is rejected because it does not match any current Finnish VAT ' +
      'category and would produce an incorrect tax filing if imported as-is.',
    check(record) {
      if (record.vatRate === undefined || record.vatRate === null || record.vatRate === '') {
        return { field: 'vatRate', message: 'VAT rate is missing.' };
      }
      const rate = Number(record.vatRate);
      if (Number.isNaN(rate) || !VALID_VAT_RATES.has(rate)) {
        return { field: 'vatRate', message: `VAT rate "${record.vatRate}" is not a recognized rate.` };
      }
      return null;
    },
  },
  {
    id: 'invalid-currency',
    title: 'Unsupported currency code',
    severity: 'error',
    description:
      `The \`currency\` field must be one of: ${[...VALID_CURRENCIES].join(', ')}. ` +
      'Unsupported currencies are rejected because the ledger has no configured exchange ' +
      'rate source for them.',
    check(record) {
      if (!record.currency) {
        return { field: 'currency', message: 'Currency is missing.' };
      }
      if (!VALID_CURRENCIES.has(String(record.currency).toUpperCase())) {
        return { field: 'currency', message: `Currency "${record.currency}" is not supported.` };
      }
      return null;
    },
  },
  {
    id: 'missing-vendor',
    title: 'Missing vendor identifier',
    severity: 'error',
    description:
      'Every record must have a non-empty `vendorId`. Invoices cannot be matched to a purchase ' +
      'order or an accounting-firm client without knowing which vendor issued them.',
    check(record) {
      if (!record.vendorId || !String(record.vendorId).trim()) {
        return { field: 'vendorId', message: 'Vendor ID is missing or empty.' };
      }
      return null;
    },
  },
  {
    id: 'invalid-invoice-date',
    title: 'Missing, malformed, or future-dated invoice',
    severity: 'error',
    description:
      'The `invoiceDate` must be a parseable date and cannot be more than one day in the ' +
      'future. A future-dated invoice is a common sign of a manual entry error or, in rarer ' +
      'cases, of invoice fraud, and is always rejected for manual review.',
    check(record) {
      if (!record.invoiceDate) {
        return { field: 'invoiceDate', message: 'Invoice date is missing.' };
      }
      const parsed = new Date(record.invoiceDate);
      if (Number.isNaN(parsed.getTime())) {
        return { field: 'invoiceDate', message: `Invoice date "${record.invoiceDate}" could not be parsed.` };
      }
      const maxAllowed = new Date();
      maxAllowed.setDate(maxAllowed.getDate() + MAX_FUTURE_DAYS);
      if (parsed > maxAllowed) {
        return { field: 'invoiceDate', message: `Invoice date "${record.invoiceDate}" is in the future.` };
      }
      return null;
    },
  },
];

/**
 * @param {object} record
 * @returns {Failure[]}
 */
function validateRecord(record) {
  const failures = [];
  for (const rule of rules) {
    if (rule.id === 'duplicate-invoice-number') continue;
    const result = rule.check(record);
    if (result) {
      failures.push({ ruleId: rule.id, severity: rule.severity, ...result });
    }
  }
  return failures;
}

/**
 * @param {Array<Object>} records
 * @param {(result: Object, index: number, total: number) => void} [onRecord]
 */
function validateFeed(records, onRecord) {
  const invoiceNumberCounts = new Map();
  for (const r of records) {
    if (r.invoiceNumber) {
      invoiceNumberCounts.set(r.invoiceNumber, (invoiceNumberCounts.get(r.invoiceNumber) || 0) + 1);
    }
  }

  const results = records.map((record, index) => {
    const failures = validateRecord(record);
    if (record.invoiceNumber && invoiceNumberCounts.get(record.invoiceNumber) > 1) {
      failures.push({
        ruleId: 'duplicate-invoice-number',
        severity: 'error',
        field: 'invoiceNumber',
        message: `Invoice number "${record.invoiceNumber}" appears ${invoiceNumberCounts.get(record.invoiceNumber)} times in this batch.`,
      });
    }
    const hasError = failures.some((f) => f.severity === 'error');
    const result = {
      index,
      invoiceNumber: record.invoiceNumber ?? null,
      vendorId: record.vendorId ?? null,
      status: hasError ? 'rejected' : failures.length ? 'passed_with_warnings' : 'passed',
      failures,
      record,
    };
    if (typeof onRecord === 'function') {
      onRecord(result, index, records.length);
    }
    return result;
  });

  const rejected = results.filter((r) => r.status === 'rejected').length;
  const passed = results.length - rejected;

  return {
    total: results.length,
    passed,
    rejected,
    timestamp: new Date().toISOString(),
    results,
  };
}

function getRuleDocs() {
  return rules.map(({ id, title, description, severity }) => ({ id, title, description, severity }));
}

module.exports = { validateFeed, validateRecord, getRuleDocs, rules, VALID_VAT_RATES, VALID_CURRENCIES };
