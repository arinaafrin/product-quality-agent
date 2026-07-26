/**
 * quality_engine.js
 * ------------------
 * Domain logic for validating incoming e-commerce product feed records.
 * This is the ONLY file you need to swap out to point this project at a
 * different data type (orders, IoT telemetry, log lines, ...). Everything
 * else (rag_store.js, mcp_server.js, agent.js, the API routes and the
 * React UI) just calls whatever validate() and the rule metadata expose.
 *
 * Each rule returns either `null` (record passes) or a `Failure` object:
 *   { ruleId, field, message, severity }
 *
 * Rule metadata (id, title, description, severity) is intentionally kept
 * next to the rule function so the same source of truth can be rendered
 * into the knowledge base markdown files (see scripts/build-kb.js) and
 * surfaced by the RAG store / agent when it explains a rejection.
 */

const VALID_CURRENCIES = new Set(['EUR', 'USD', 'GBP', 'SEK', 'DKK', 'NOK']);
const VALID_CATEGORIES = new Set([
  'lighting',
  'furniture',
  'textiles',
  'tableware',
  'decor',
  'outdoor',
  'kids',
]);
const IMAGE_URL_RE = /^https:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const SKU_RE = /^[A-Z]{2,5}-\d{3,8}$/;

/**
 * @typedef {Object} Failure
 * @property {string} ruleId
 * @property {string} field
 * @property {string} message
 * @property {'error'|'warning'} severity
 */

const rules = [
  {
    id: 'missing-title',
    title: 'Missing product title',
    severity: 'error',
    description:
      'Every record must have a non-empty `title`. Titles are used for search indexing, ' +
      'so a missing title makes the product invisible to customers even if it is otherwise valid.',
    check(record) {
      if (!record.title || !String(record.title).trim()) {
        return { field: 'title', message: 'Title is missing or empty.' };
      }
      return null;
    },
  },
  {
    id: 'invalid-price',
    title: 'Missing or invalid price',
    severity: 'error',
    description:
      'The `price` field must be present, numeric, and greater than 0. Negative, zero, ' +
      'or non-numeric prices are rejected outright because they would either break checkout ' +
      'or let an item be purchased for free.',
    check(record) {
      const price = record.price;
      if (price === undefined || price === null || price === '') {
        return { field: 'price', message: 'Price is missing.' };
      }
      const num = Number(price);
      if (Number.isNaN(num)) {
        return { field: 'price', message: `Price "${price}" is not a number.` };
      }
      if (num <= 0) {
        return { field: 'price', message: `Price ${num} must be greater than 0.` };
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
      'Unsupported currencies are rejected because downstream pricing and tax logic ' +
      'does not have conversion rates configured for them.',
    check(record) {
      if (!record.currency) {
        return { field: 'currency', message: 'Currency is missing.' };
      }
      if (!VALID_CURRENCIES.has(String(record.currency).toUpperCase())) {
        return {
          field: 'currency',
          message: `Currency "${record.currency}" is not supported.`,
        };
      }
      return null;
    },
  },
  {
    id: 'broken-image',
    title: 'Broken or malformed image URL',
    severity: 'error',
    description:
      'The `imageUrl` must be a valid HTTPS URL ending in .jpg, .jpeg, .png, or .webp. ' +
      'This catches the most common feed error: a relative path, a http:// link, or a ' +
      'CDN URL that was truncated during export.',
    check(record) {
      if (!record.imageUrl) {
        return { field: 'imageUrl', message: 'Image URL is missing.' };
      }
      if (!IMAGE_URL_RE.test(record.imageUrl)) {
        return {
          field: 'imageUrl',
          message: `Image URL "${record.imageUrl}" is not a valid https image link.`,
        };
      }
      return null;
    },
  },
  {
    id: 'invalid-category',
    title: 'Unrecognized category',
    severity: 'warning',
    description:
      `The \`category\` field should be one of: ${[...VALID_CATEGORIES].join(', ')}. ` +
      'This is a warning rather than a hard error because new categories are sometimes ' +
      'introduced ahead of the taxonomy being updated, but it should be reviewed.',
    check(record) {
      if (!record.category) {
        return { field: 'category', message: 'Category is missing.' };
      }
      if (!VALID_CATEGORIES.has(String(record.category).toLowerCase())) {
        return {
          field: 'category',
          message: `Category "${record.category}" is not in the known taxonomy.`,
        };
      }
      return null;
    },
  },
  {
    id: 'invalid-sku-format',
    title: 'Malformed SKU',
    severity: 'error',
    description:
      'A SKU must match the pattern `LETTERS-DIGITS` (2-5 letters, a dash, 3-8 digits), ' +
      'e.g. `FDS-10234`. Malformed SKUs cannot be matched against the warehouse system.',
    check(record) {
      if (!record.sku) {
        return { field: 'sku', message: 'SKU is missing.' };
      }
      if (!SKU_RE.test(record.sku)) {
        return { field: 'sku', message: `SKU "${record.sku}" does not match the required format.` };
      }
      return null;
    },
  },
  {
    id: 'duplicate-sku',
    title: 'Duplicate SKU within the same feed',
    severity: 'error',
    description:
      'Each SKU must appear only once per feed. Duplicate SKUs usually mean the export job ' +
      'ran twice or two source systems disagree about the same product, and importing both ' +
      'would create a race condition on stock levels.',
    // duplicate-sku is a cross-record rule, handled separately in validateFeed()
    check() {
      return null;
    },
  },
];

/**
 * Validate a single record against every per-record rule (excludes cross-record
 * rules like duplicate-sku, which need the whole feed).
 * @param {object} record
 * @returns {Failure[]}
 */
function validateRecord(record) {
  const failures = [];
  for (const rule of rules) {
    if (rule.id === 'duplicate-sku') continue;
    const result = rule.check(record);
    if (result) {
      failures.push({ ruleId: rule.id, severity: rule.severity, ...result });
    }
  }
  return failures;
}

/**
 * Validate an entire feed (array of records). Runs per-record rules plus
 * cross-record rules (currently: duplicate SKU detection).
 * @param {object[]} records
 * @returns {{ total: number, passed: number, rejected: number, results: Array }}
 */
function validateFeed(records) {
  const skuCounts = new Map();
  for (const r of records) {
    if (r.sku) skuCounts.set(r.sku, (skuCounts.get(r.sku) || 0) + 1);
  }

  const results = records.map((record, index) => {
    const failures = validateRecord(record);
    if (record.sku && skuCounts.get(record.sku) > 1) {
      failures.push({
        ruleId: 'duplicate-sku',
        severity: 'error',
        field: 'sku',
        message: `SKU "${record.sku}" appears ${skuCounts.get(record.sku)} times in this feed.`,
      });
    }
    const hasError = failures.some((f) => f.severity === 'error');
    return {
      index,
      sku: record.sku ?? null,
      title: record.title ?? null,
      status: hasError ? 'rejected' : failures.length ? 'passed_with_warnings' : 'passed',
      failures,
      record,
    };
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

/** Rule metadata without the `check` function, for building the knowledge base / UI. */
function getRuleDocs() {
  return rules.map(({ id, title, description, severity }) => ({ id, title, description, severity }));
}

module.exports = { validateFeed, validateRecord, getRuleDocs, rules, VALID_CATEGORIES, VALID_CURRENCIES };

