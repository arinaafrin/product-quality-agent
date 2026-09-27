const fs = require('fs');
const path = require('path');
const { getRuleDocs, activeEngine, activeEngineTitle } = require('../src/quality_engine');

const outPath = path.join(__dirname, '..', 'src', 'data', 'knowledge_base', 'validation-rules.md');

const rules = getRuleDocs();

const lines = [
  `# ${activeEngineTitle} validation rules`,
  '',
  `_Generated from the "${activeEngine}" engine (backend/src/engines/) — do not edit by hand,`,
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
console.log(`Wrote ${rules.length} rules (engine: ${activeEngine}) to ${outPath}`);
