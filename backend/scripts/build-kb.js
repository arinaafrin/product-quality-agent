#!/usr/bin/env node
/**
 * Regenerates data/knowledge_base/validation-rules.md directly from the
 * rule metadata in quality_engine.js. Run this after editing any rule so
 * the RAG knowledge base and the agent's answers never drift from the
 * actual validation logic.
 *
 *   node scripts/build-kb.js
 */
const fs = require('fs');
const path = require('path');
const { getRuleDocs } = require('../src/quality_engine');

const outPath = path.join(__dirname, '..', 'src', 'data', 'knowledge_base', 'validation-rules.md');

const rules = getRuleDocs();

const lines = [
  '# Product feed validation rules',
  '',
  '_This file is generated from `backend/src/quality_engine.js` — do not edit by hand,',
  'run `node scripts/build-kb.js` instead._',
  '',
];

for (const rule of rules) {
  lines.push(`## ${rule.title} (\`${rule.id}\`)`);
  lines.push('');
  lines.push(`**Severity:** ${rule.severity}`);
  lines.push('');
  lines.push(rule.description);
  lines.push('');
}

fs.writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote ${rules.length} rules to ${outPath}`);
