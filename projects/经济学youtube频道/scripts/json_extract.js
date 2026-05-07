/**
 * json_extract.js
 * 从 Grok/Gemini 等 skill 的 JSON 输出中提取 reply 字段，写成纯文本。
 * 用途：workflow 里 skill 输出 JSON 后，用这个脚本提取纯文本。
 *
 * 用法:
 *   node scripts/json_extract.js <input.json> <output.txt>
 *   node scripts/json_extract.js <input.json> <output.txt> --field reply
 *
 * 自动处理 Grok 的 "Executed code" 末尾污染问题。
 */

const fs = require('fs');

const args = process.argv.slice(2);
const inputPath = args[0];
const outputPath = args[1];
const field = args.includes('--field') ? args[args.indexOf('--field') + 1] : 'reply';

if (!inputPath || !outputPath) {
  console.error('Usage: node json_extract.js <input.json> <output.txt> [--field reply]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let text = data[field] || '';

if (field === 'reply') {
  // 去掉 Grok expert 模型末尾的 "Executed code" 污染
  text = text.replace(/\n*Executed code\s*$/i, '').trim();
}

fs.writeFileSync(outputPath, text);
console.log(`Extracted ${text.length} chars to ${outputPath}`);
