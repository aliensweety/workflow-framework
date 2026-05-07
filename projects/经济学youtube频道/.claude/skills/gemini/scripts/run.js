#!/usr/bin/env node
/**
 * run.js —— skill 主入口，根据 --action 分发到 actions/ 下的具体实现。
 * 通过 CDP 连项目级 dedicated Chrome（不自己启动浏览器）。
 *
 * 输出约定（项目级规范）：
 *   - 不带 --output → 最终结果写 stdout（JSON.stringify）
 *   - 带 --output <路径> → 写文件（原始 JSON），stdout 只刷 { saved: <路径.json> }
 *   - 后缀固定为 .json，忽略调用方传入的任何后缀
 */

const fs = require('fs');
const path = require('path');
const { connectBrowser } = require('./lib/browser');

function parseChatArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt' && argv[i + 1]) { params.prompt = argv[i + 1]; i++; }
    else if (argv[i] === '--model' && argv[i + 1]) { params.model = argv[i + 1]; i++; }
    else if (argv[i] === '--tool' && argv[i + 1]) { params.tool = argv[i + 1]; i++; }
    else if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
    else if (argv[i] === '--temporary' && argv[i + 1]) { params.temporary = argv[i + 1] === 'true'; i++; }
    else if (argv[i] === '--files' && argv[i + 1]) { params.files = argv[i + 1].split(',').map(f => f.trim()); i++; }
  }
  if (!params.prompt) {
    throw new Error('--prompt 必填');
  }
  return params;
}

function parseStartChatArgs(argv) {
  // 同 chat 参数，但 --tool 不适用
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt' && argv[i + 1]) { params.prompt = argv[i + 1]; i++; }
    else if (argv[i] === '--model' && argv[i + 1]) { params.model = argv[i + 1]; i++; }
    else if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
    else if (argv[i] === '--temporary' && argv[i + 1]) { params.temporary = argv[i + 1] === 'true'; i++; }
    else if (argv[i] === '--files' && argv[i + 1]) { params.files = argv[i + 1].split(',').map(f => f.trim()); i++; }
  }
  if (!params.prompt) {
    throw new Error('--prompt 必填');
  }
  return params;
}

function parseGetChatArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
  }
  if (!params.conversation_id) {
    throw new Error('--conversation_id 必填');
  }
  return params;
}

function parseResearchArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt' && argv[i + 1]) { params.prompt = argv[i + 1]; i++; }
    else if (argv[i] === '--model' && argv[i + 1]) { params.model = argv[i + 1]; i++; }
    else if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
  }
  if (!params.prompt) {
    throw new Error('--prompt 必填');
  }
  return params;
}

function parseReportArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
  }
  if (!params.conversation_id) {
    throw new Error('--conversation_id 必填');
  }
  return params;
}

function parseArgs(argv) {
  const args = { action: null, output: null, _raw: argv };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--action' && argv[i + 1]) { args.action = argv[i + 1]; i++; }
    else if (argv[i] === '--output' && argv[i + 1]) { args.output = argv[i + 1]; i++; }
  }
  return args;
}

function emitResult(result, outputPath) {
  if (!outputPath) {
    console.log(JSON.stringify(result));
    return;
  }
  const resolved = path.resolve(outputPath);
  // 后缀固定为 .json，忽略调用方传入的任何后缀
  const basename = path.basename(resolved, path.extname(resolved));
  const finalPath = path.join(path.dirname(resolved), basename + '.json');
  fs.mkdirSync(path.dirname(finalPath), { recursive: true });
  const content = typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  fs.writeFileSync(finalPath, content, 'utf8');
  console.log(JSON.stringify({ saved: finalPath }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.action) {
    console.error('用法: node scripts/run.js --action <action-name> [--output <路径>] [其他参数]');
    process.exit(1);
  }

  const { context } = await connectBrowser();

  let result;
  try {
    switch (args.action) {
      case 'chat': {
        const chat = require('./actions/chat');
        const params = parseChatArgs(args._raw);
        result = await chat({ context, ...params });
        break;
      }
      case 'start_chat': {
        const startChat = require('./actions/start_chat');
        const params = parseStartChatArgs(args._raw);
        result = await startChat({ context, ...params });
        break;
      }
      case 'get_chat': {
        const getChat = require('./actions/get_chat');
        const params = parseGetChatArgs(args._raw);
        result = await getChat({ context, ...params });
        break;
      }
      case 'start_research': {
        const startResearch = require('./actions/start_research');
        const params = parseResearchArgs(args._raw);
        result = await startResearch({ context, ...params });
        break;
      }
      case 'get_research_report': {
        const getReport = require('./actions/get_research_report');
        const params = parseReportArgs(args._raw);
        result = await getReport({ context, ...params });
        break;
      }
      default:
        throw new Error(`未知 action: ${args.action}`);
    }
  } catch (err) {
    console.error('[run.js]', err.message);
    process.exit(1);
  }

  emitResult(result, args.output);
}

main();
