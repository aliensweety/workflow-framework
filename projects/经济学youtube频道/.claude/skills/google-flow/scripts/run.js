#!/usr/bin/env node
/**
 * run.js —— skill 主入口，根据 --action 分发到 actions/ 下的具体实现。
 * 通过 CDP 连项目级 dedicated Chrome（不自己启动浏览器）。
 *
 * 输出约定：
 *   - 不带 --output → JSON 写 stdout
 *   - 带 --output <路径> → 写文件（原始 JSON），stdout 返回 { saved: <路径.json> }
 *   - 后缀固定为 .json，忽略调用方传入的任何后缀
 */

const fs = require('fs');
const path = require('path');
const { connectBrowser } = require('./lib/browser');

function extractParam(raw, flag) {
  const idx = raw.indexOf(flag);
  if (idx >= 0 && raw[idx + 1]) return raw[idx + 1];
  return undefined;
}

function extractParams(raw, flag) {
  const vals = [];
  for (let i = 0; i < raw.length; i++) {
    if (raw[i] === flag && raw[i + 1]) vals.push(raw[i + 1]);
  }
  return vals.length > 0 ? vals : undefined;
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
    console.log(JSON.stringify(result, null, 2));
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
    console.error('用法: node scripts/run.js --action <action> [--output <路径>] [其他参数]');
    process.exit(1);
  }

  const { context } = await connectBrowser();

  let result;
  try {
    switch (args.action) {
      case 'generate': {
        const generate = require('./actions/generate');
        const prompt = extractParam(args._raw, '--prompt');
        if (!prompt) throw new Error('--prompt 必填');
        const projectId = extractParam(args._raw, '--project-id');
        if (!projectId) throw new Error('--project-id 必填');
        result = await generate({
          context,
          prompt,
          projectId,
          referenceSearch: extractParams(args._raw, '--reference-search'),
          model: extractParam(args._raw, '--model'),
          aspectRatio: extractParam(args._raw, '--aspect-ratio'),
          count: extractParam(args._raw, '--count') ? parseInt(extractParam(args._raw, '--count')) : undefined,
          downloadResolution: extractParam(args._raw, '--download-resolution'),
        });
        break;
      }
      case 'list-media': {
        const listMedia = require('./actions/list-media');
        result = await listMedia({
          context,
          projectId: extractParam(args._raw, '--project-id'),
          search: extractParam(args._raw, '--search'),
        });
        break;
      }
      case 'create-project': {
        const createProject = require('./actions/create-project');
        result = await createProject({
          context,
          name: extractParam(args._raw, '--name'),
        });
        break;
      }
      case 'list-projects': {
        const listProjects = require('./actions/list-projects');
        result = await listProjects({ context });
        break;
      }
      case 'upload-media': {
        const uploadMedia = require('./actions/upload-media');
        const imagePath = extractParam(args._raw, '--image');
        if (!imagePath) throw new Error('--image 必填');
        result = await uploadMedia({
          context,
          projectId: extractParam(args._raw, '--project-id'),
          imagePath,
        });
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
  process.exit(0);
}

main();
