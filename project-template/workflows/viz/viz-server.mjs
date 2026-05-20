/**
 * viz-server.mjs — 实时读取 flow.yaml + steps/*.yaml，返回 JSON 给前端
 *
 * 用法（在项目根目录运行）:
 *   node workflows/viz/viz-server.mjs
 *   node workflows/viz/viz-server.mjs --port 8080
 *
 * 或双击 start.bat
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WORKFLOWS = path.resolve(__dirname, '..');  // viz/ 的上级就是 workflows/
const PROJECT = path.resolve(WORKFLOWS, '..');

const args = process.argv.slice(2);
let PORT = 3456;
const portIdx = args.indexOf('--port');
if (portIdx !== -1 && args[portIdx + 1]) PORT = parseInt(args[portIdx + 1], 10);

function fixBoolKeys(obj) {
  if (Array.isArray(obj)) return obj.map(fixBoolKeys);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const fixedKey = typeof k === 'boolean' ? (k === true ? 'on' : 'off') : k;
      out[fixedKey] = fixBoolKeys(v);
    }
    return out;
  }
  return obj;
}

function readFlowData() {
  const flowPath = path.join(WORKFLOWS, 'flow.yaml');
  if (!fs.existsSync(flowPath)) return null;

  const flow = fixBoolKeys(yaml.parse(fs.readFileSync(flowPath, 'utf-8')));

  const steps = {};
  const stepsDir = path.join(WORKFLOWS, 'steps');
  if (fs.existsSync(stepsDir)) {
    for (const fn of fs.readdirSync(stepsDir)) {
      if (!fn.endsWith('.yaml') && !fn.endsWith('.yml')) continue;
      const step = yaml.parse(fs.readFileSync(path.join(stepsDir, fn), 'utf-8'));
      if (step && step.id) steps[step.id] = step;
    }
  }

  return { flow, steps };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API: /api/flow
  if (url.pathname === '/api/flow') {
    const data = readFlowData();
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'flow.yaml not found' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(data));
    return;
  }

  // 静态文件：从 viz/ 目录 serve
  let filePath;
  if (url.pathname === '/' || url.pathname === '/index.html') {
    filePath = path.join(__dirname, 'Workflow.html');
  } else {
    filePath = path.join(__dirname, url.pathname);
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(resolved)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(resolved);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(resolved).pipe(res);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`端口 ${PORT} 被占用，尝试 ${PORT + 1}...`);
    PORT++;
    server.listen(PORT);
  } else {
    throw e;
  }
});

server.listen(PORT, () => {
  console.log(``);
  console.log(`  flow viz -> http://localhost:${PORT}`);
  console.log(`  按 Ctrl+C 停止`);
  console.log(``);
});
