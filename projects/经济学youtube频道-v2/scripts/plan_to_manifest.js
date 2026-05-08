#!/usr/bin/env node
// Take Grok's reply (a JSON array possibly wrapped in markdown / preamble)
// and write the units into runs/<run_id>/manifest.yaml.
// Usage: plan_to_manifest.js <grok_reply.json> <manifest.yaml>

const fs = require('fs');

const replyFile = process.argv[2];
const manifestFile = process.argv[3];
if (!replyFile || !manifestFile) {
  console.error('usage: plan_to_manifest.js <grok_reply.json> <manifest.yaml>');
  process.exit(2);
}

const grokWrap = JSON.parse(fs.readFileSync(replyFile, 'utf8'));
let reply = grokWrap.reply;

// Strip "思考了 Ns" preamble if present.
reply = reply.replace(/^思考了 \d+s\s*/, '').trim();

// Strip a markdown code-fence wrap or a "JSON\n复制\n" preamble if present.
const fenceMatch = reply.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
if (fenceMatch) {
  reply = fenceMatch[1];
} else {
  // find first '[' and last ']' as JSON boundaries
  const start = reply.indexOf('[');
  const end = reply.lastIndexOf(']');
  if (start >= 0 && end > start) reply = reply.slice(start, end + 1);
}

const arr = JSON.parse(reply);
if (!Array.isArray(arr)) throw new Error('expected JSON array');

// Build YAML units block manually (avoid pulling in a yaml lib).
const yamlEscape = (s) => {
  // Use double-quoted YAML string with escaped backslash and quote.
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
};

const lines = ['units:'];
arr.forEach((seg, i) => {
  const id = 'seg_' + String(i).padStart(3, '0');
  lines.push(`  - id: ${id}`);
  lines.push(`    status: pending`);
  lines.push(`    time_range: ${yamlEscape(seg.time_range)}`);
  lines.push(`    text: ${yamlEscape(seg.text)}`);
  lines.push(`    image_prompt: ${yamlEscape(seg.image_prompt)}`);
  lines.push(`    image_path: null`);
});
const unitsYaml = lines.join('\n') + '\n';

// Read existing manifest, replace the `units:` block.
let mf = fs.readFileSync(manifestFile, 'utf8');
mf = mf.replace(/units:\s*\[\]\s*\n?/, unitsYaml);
if (!mf.includes('units:\n  - id:')) {
  // Fallback: replace any units: ... block (until next top-level key or EOF).
  mf = mf.replace(/units:[\s\S]*$/, unitsYaml);
}
fs.writeFileSync(manifestFile, mf);
console.log(`wrote ${arr.length} units to ${manifestFile}`);
