/**
 * Registry of pluggable "quality engines." Each one validates a different
 * kind of record but exposes the same shape: { validateFeed, validateRecord,
 * getRuleDocs, rules, ...domain-specific constants }. Adding a new domain
 * (sensor logs, orders, whatever) means dropping a new file in here with
 * that same shape and adding one line below — nothing else in the app
 * changes.
 */
// `load` is a thunk rather than a bare require(), because the path string
// alone would resolve relative to *this* file when called from here — but
// if a caller in a different directory (e.g. src/quality_engine.js) ever
// tried to require() the string directly, it would resolve relative to
// *that* file instead and fail to find the module. Wrapping the require in
// a function defined here keeps resolution anchored to this directory no
// matter who calls it.
const ENGINES = {
  product: {
    title: 'Product feed',
    load: () => require('./product_quality_engine'),
  },
  invoice: {
    title: 'Invoice / accounting record',
    load: () => require('./invoice_quality_engine'),
  },
};

/** @returns {string[]} */
function listEngineNames() {
  return Object.keys(ENGINES);
}

/**
 * @param {string} name
 * @returns {{ title: string, load: () => object }}
 */
function getEngineMeta(name) {
  const meta = ENGINES[name];
  if (!meta) {
    throw new Error(
      `Unknown engine "${name}". Set ACTIVE_ENGINE to one of: ${listEngineNames().join(', ')}.`
    );
  }
  return meta;
}

module.exports = { ENGINES, listEngineNames, getEngineMeta };
