/**
 * Thin dispatcher: every existing call site in this app
 * (routes/validate.js, mcp_server.js, scripts/build-kb.js) requires this
 * file exactly as before. What actually runs is chosen at startup by
 * ACTIVE_ENGINE (default "product"), from the registry in ./engines/index.js.
 *
 * This is what makes "swap the domain" a real, tested switch instead of a
 * manual file-copy exercise: set ACTIVE_ENGINE=invoice and the whole app —
 * validation rules, the knowledge base build script, the RAG-backed agent,
 * the MCP server — starts talking about invoices instead of products,
 * with zero code changes anywhere else.
 */
const { getEngineMeta } = require('./engines');

const ACTIVE_ENGINE = process.env.ACTIVE_ENGINE || 'product';
const { title, load } = getEngineMeta(ACTIVE_ENGINE);
const engine = load();

module.exports = { ...engine, activeEngine: ACTIVE_ENGINE, activeEngineTitle: title };
