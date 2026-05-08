#!/usr/bin/env node
/**
 * run.js —— skill 主入口，根据 --action 分发到 actions/ 下的具体实现。
 * 通过 CDP 连项目级 dedicated Chrome（不自己启动浏览器）。
 *
 * 输出约定：
 *   - 不带 --output → 最终结果写 stdout（JSON.stringify）
 *   - 带 --output <路径> → 写文件（原始 JSON），stdout 只刷 { saved: <路径.json> }
 *   - 后缀固定为 .json，忽略调用方传入的任何后缀
 */

const fs = require('fs');
const path = require('path');
const { connectBrowser } = require('./lib/browser');

function parseTopArgs(argv) {
  const args = { action: null, output: null, _raw: argv };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--action' && argv[i + 1]) { args.action = argv[i + 1]; i++; }
    else if (argv[i] === '--output' && argv[i + 1]) { args.output = argv[i + 1]; i++; }
  }
  return args;
}

/**
 * 输出逻辑。
 * - 没 --output：JSON.stringify(result) 走 stdout。
 * - 有 --output：写文件（原始 JSON），stdout 返回 { saved: 路径 }。
 */
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
  const args = parseTopArgs(process.argv.slice(2));
  if (!args.action) {
    console.error('用法: node scripts/run.js --action <action-name> [--output <path>] [其他参数]');
    process.exit(1);
  }

  const { context } = await connectBrowser();

  let result;
  try {
    switch (args.action) {
      case 'start_tts': {
        const startTts = require('./actions/start_tts');
        let audioPath = null, text = null;
        for (let i = 0; i < args._raw.length; i++) {
          if (args._raw[i] === '--audio' && args._raw[i + 1]) { audioPath = args._raw[i + 1]; i++; }
          else if (args._raw[i] === '--text' && args._raw[i + 1]) { text = args._raw[i + 1]; i++; }
          else if (args._raw[i] === '--text-file' && args._raw[i + 1]) {
            const filePath = args._raw[i + 1];
            if (!require('fs').existsSync(filePath)) throw new Error(`--text-file 文件不存在: ${filePath}`);
            text = require('fs').readFileSync(filePath, 'utf8');
            i++;
          }
        }
        if (!audioPath) throw new Error('--audio 必填');
        if (!text) throw new Error('--text 或 --text-file 必填');
        result = await startTts({ context, audioPath, text });
        break;
      }
      case 'get_tts': {
        const getTts = require('./actions/get_tts');
        let taskId = null, waitSec = 0;
        for (let i = 0; i < args._raw.length; i++) {
          if (args._raw[i] === '--task-id' && args._raw[i + 1]) { taskId = args._raw[i + 1]; i++; }
          else if (args._raw[i] === '--wait' && args._raw[i + 1]) { waitSec = parseInt(args._raw[i + 1], 10); i++; }
        }
        if (!taskId) throw new Error('--task-id 必填');
        result = await getTts({ context, task_id: taskId, outputPath: args.output, waitSec });
        emitResult(result, null);
        process.exit(0);
      }
      default:
        throw new Error(`未知 action: ${args.action}`);
    }
  } catch (err) {
    console.error('[run.js]', err.message);
    process.exit(1);
  }

  emitResult(result, args.output);
  process.exit(0);   // ★ 必须：CDP WebSocket 阻止 Node 自动退出
}

main();
