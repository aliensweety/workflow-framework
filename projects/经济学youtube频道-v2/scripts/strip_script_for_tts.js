#!/usr/bin/env node
// Strip a markdown script down to pure voiceover text suitable for TTS.
// Removes: # / ## / ### headings, *[Visual:...]* stage directions,
// horizontal rules (---), block-quotes, and trailing italic notes.
// Preserves paragraph breaks (\n\n) so TTS pacing has natural pauses.

const fs = require('fs');

const inFile = process.argv[2];
const outFile = process.argv[3];
if (!inFile || !outFile) {
  console.error('usage: strip_script_for_tts.js <input.md> <output.txt>');
  process.exit(2);
}

let t = fs.readFileSync(inFile, 'utf8');

t = t.replace(/\*\[[^\]]*\]\*/g, '');
t = t.replace(/^#{1,6}\s+.*$/gm, '');
t = t.replace(/^---+\s*$/gm, '');
t = t.replace(/^\s*>.*$/gm, '');
t = t.replace(/^\s*\*[^*\n]+\*\s*$/gm, '');
t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
t = t.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '$1');
t = t.replace(/\n{3,}/g, '\n\n');
t = t.trim() + '\n';

fs.writeFileSync(outFile, t);
console.log(`stripped: ${t.length} chars -> ${outFile}`);
