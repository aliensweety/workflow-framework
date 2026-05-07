#!/usr/bin/env node
/**
 * run.js —— grok skill 主入口。
 * 通过 CDP 连项目级 dedicated Chrome，不自己启动浏览器。
 *
 * 输出约定：
 *   - 不带 --output → 最终结果 JSON.stringify 写 stdout
 *   - 带 --output <路径> → 写文件（原始 JSON），stdout 只刷 { saved: <路径.json> }
 *   - 后缀固定为 .json，忽略调用方传入的任何后缀
 */

const fs = require('fs');
const path = require('path');
const { connectBrowser } = require('./lib/browser');

// ── 参数解析 ──────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { action: null, output: null, _raw: argv };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--action' && argv[i + 1]) { args.action = argv[i + 1]; i++; }
    else if (argv[i] === '--output' && argv[i + 1]) { args.output = argv[i + 1]; i++; }
  }
  return args;
}

function parseChatArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--prompt' && argv[i + 1]) { params.prompt = argv[i + 1]; i++; }
    else if (argv[i] === '--model' && argv[i + 1]) { params.model = argv[i + 1]; i++; }
    else if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
    else if (argv[i] === '--file' && argv[i + 1]) {
      if (!params.files) params.files = [];
      params.files.push(argv[i + 1]);
      i++;
    }
    else if (argv[i] === '--private') { params.private = true; }
  }
  if (!params.prompt) throw new Error('--prompt 必填');
  return params;
}

function parseGetChatArgs(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--conversation_id' && argv[i + 1]) { params.conversation_id = argv[i + 1]; i++; }
  }
  if (!params.conversation_id) throw new Error('--conversation_id 必填');
  return params;
}

// ── 输出 ───────────────────────────────────────────────────────────────────

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

// ── 主入口 ─────────────────────────────────────────────────────────────────

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
        const startChat = require('./actions/start-chat');
        const params = parseChatArgs(args._raw);
        result = await startChat({ context, ...params });
        break;
      }
      case 'get_chat': {
        const getChat = require('./actions/get-chat');
        const params = parseGetChatArgs(args._raw);
        result = await getChat({ context, ...params });
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
  process.exit(0); // CDP WebSocket 阻止 Node 自动退出，必须显式 exit
}

main();
