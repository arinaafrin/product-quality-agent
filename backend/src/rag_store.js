/**
 * rag_store.js
 * ------------
 * A deliberately small, dependency-free retrieval store.
 *
 * It indexes two kinds of documents:
 *   1. Knowledge base markdown files (the "why" — validation rules, FAQ)
 *   2. Validation run logs (the "what happened" — actual rejections)
 *
 * Retrieval uses TF-IDF-weighted cosine similarity over a bag-of-words
 * index. That is intentionally simple: it needs no API key, no network
 * call, and no vector database to run this project end-to-end. In a real
 * production deployment you would swap this module for a real embedding
 * model + vector store (pgvector, Pinecone, Qdrant, ...) — every other
 * file in this project (mcp_server.js, agent.js, the API routes) only
 * calls `ragStore.search(query, k)`, so that swap is contained to this
 * one file.
 */
const fs = require('fs');
const path = require('path');

const KB_DIR = path.join(__dirname, 'data', 'knowledge_base');
const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'to', 'of',
  'and', 'or', 'in', 'on', 'for', 'it', 'this', 'that', 'as', 'with', 'by',
  'at', 'from', 'not', 'but', 'if', 'so', 'has', 'have', 'had', 'do', 'does',
]);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => !STOPWORDS.has(t));
}

class RagStore {
  constructor() {
    /** @type {{id: string, source: string, type: string, text: string, tokens: string[]}[]} */
    this.docs = [];
    this._idf = null;
    this._loadKnowledgeBase();
  }

  _loadKnowledgeBase() {
    if (!fs.existsSync(KB_DIR)) return;
    for (const file of fs.readdirSync(KB_DIR)) {
      if (!file.endsWith('.md')) continue;
      const full = path.join(KB_DIR, file);
      const raw = fs.readFileSync(full, 'utf-8');
      // chunk by markdown h2 sections; keep the doc title (h1) as context
      const chunks = raw.split(/\n(?=## )/);
      chunks.forEach((chunk, i) => {
        const text = chunk.trim();
        if (!text) return;
        this.docs.push({
          id: `kb:${file}:${i}`,
          source: file,
          type: 'knowledge_base',
          text,
          tokens: tokenize(text),
        });
      });
    }
    this._idf = null; // invalidate cache
  }

  /**
   * Add a validation run's failures as retrievable "incident" documents.
   * Called by the API after every /validate run so the agent can answer
   * questions about what actually happened, not just the static rules.
   * @param {object} runSummary - the object returned by validateFeed()
   */
  ingestValidationRun(runSummary) {
    const byRule = new Map();
    for (const r of runSummary.results) {
      for (const f of r.failures) {
        if (!byRule.has(f.ruleId)) byRule.set(f.ruleId, []);
        byRule.get(f.ruleId).push({ sku: r.sku, title: r.title, message: f.message });
      }
    }

    const text = [
      `## Validation run ${runSummary.timestamp}`,
      `Total records: ${runSummary.total}. Passed: ${runSummary.passed}. Rejected: ${runSummary.rejected}.`,
      ...[...byRule.entries()].map(([ruleId, items]) => {
        const examples = items
          .slice(0, 5)
          .map((it) => `${it.sku || 'no-sku'} (${it.title || 'untitled'}): ${it.message}`)
          .join('; ');
        return `Rule "${ruleId}" failed ${items.length} time(s). Examples: ${examples}`;
      }),
    ].join('\n');

    this.docs.push({
      id: `run:${runSummary.timestamp}`,
      source: 'validation_run',
      type: 'validation_log',
      text,
      tokens: tokenize(text),
    });
    this._idf = null;
  }

  _computeIdf() {
    if (this._idf) return this._idf;
    const df = new Map();
    for (const doc of this.docs) {
      for (const term of new Set(doc.tokens)) {
        df.set(term, (df.get(term) || 0) + 1);
      }
    }
    const idf = new Map();
    const N = this.docs.length || 1;
    for (const [term, count] of df.entries()) {
      idf.set(term, Math.log((N + 1) / (count + 1)) + 1);
    }
    this._idf = idf;
    return idf;
  }

  _vector(tokens, idf) {
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) || 0) + 1);
    const vec = new Map();
    for (const [term, freq] of tf.entries()) {
      vec.set(term, freq * (idf.get(term) || 1));
    }
    return vec;
  }

  _cosine(a, b) {
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (const [term, weight] of a.entries()) {
      normA += weight * weight;
      if (b.has(term)) dot += weight * b.get(term);
    }
    for (const weight of b.values()) normB += weight * weight;
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Retrieve the top-k most relevant chunks for a query.
   * @param {string} query
   * @param {number} k
   * @returns {{id: string, source: string, type: string, text: string, score: number}[]}
   */
  search(query, k = 4) {
    if (this.docs.length === 0) return [];
    const idf = this._computeIdf();
    const queryVec = this._vector(tokenize(query), idf);
    const scored = this.docs.map((doc) => ({
      ...doc,
      score: this._cosine(queryVec, this._vector(doc.tokens, idf)),
    }));
    return scored
      .filter((d) => d.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map(({ tokens, ...rest }) => rest);
  }
}

// Singleton — one process-wide store, mirroring how a real vector DB client would be shared.
const ragStore = new RagStore();

module.exports = { ragStore, RagStore };
