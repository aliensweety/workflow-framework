/**
 * human.js
 * --------------------------------------------------
 * 模拟真人操作的工具。CDP 解决了"是不是真实 Chrome 进程"，
 * 但操作模式（点击间隔、是否逐字输入、是否 hover）仍可能被反爬识别。
 *
 * 业务脚本（actions/*.js）默认用这套，不裸用 page.click / page.fill。
 *
 * ★ 重要：type() 内部用 keyboard.type() 逐字输入（也可用 paste() 粘贴）。**禁用 page.fill()**——
 *   fill() 跳过键盘事件链，被 Google 级反爬 100% 拦截（google-flow 实测）。
 */

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/** 随机思考停顿，用在两个动作之间 */
async function thinkPause(min = 300, max = 1500) {
  await sleep(randInt(min, max));
}

/**
 * 真人式点击：先 hover、停 80-250ms、再 click。
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {{ timeout?: number }} [opts]
 */
async function click(page, selector, opts = {}) {
  const { timeout = 10000 } = opts;
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.hover();
  await sleep(randInt(80, 250));
  await loc.click();
}

/**
 * 真人式输入：逐字打，每字之间随机 30-100ms。
 * 支持普通 input/textarea 和 contenteditable。
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @param {{ clear?: boolean, timeout?: number }} [opts]
 */
async function type(page, selector, text, opts = {}) {
  const { clear = false, timeout = 10000 } = opts;
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.click();
  if (clear) {
    await page.keyboard.press('Control+A');
    await sleep(randInt(50, 120));
    await page.keyboard.press('Delete');
    await sleep(randInt(50, 120));
  }
  for (const ch of text) {
    await page.keyboard.type(ch, { delay: randInt(30, 100) });
  }
}

/**
 * 剪贴板粘贴：先把文本写入浏览器 clipboard，再 Ctrl+V 粘贴。
 * 比 type 快得多，且走正常键盘事件链（不是 fill），不会被反爬检测。
 * @param {import('playwright').Page} page
 * @param {string} selector
 * @param {string} text
 * @param {{ clear?: boolean, timeout?: number }} [opts]
 */
async function paste(page, selector, text, opts = {}) {
  const { clear = false, timeout = 10000 } = opts;
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout });
  await loc.click();
  if (clear) {
    await page.keyboard.press('Control+A');
    await sleep(randInt(50, 120));
    await page.keyboard.press('Delete');
    await sleep(randInt(50, 120));
  }
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await sleep(randInt(50, 150));
  await page.keyboard.press('Control+v');
}

/**
 * 真人式按键。
 */
async function press(page, key) {
  await sleep(randInt(50, 150));
  await page.keyboard.press(key);
}

/**
 * 真人式滚动：分多步小幅滚动，每步停一下。
 */
async function scroll(page, opts = {}) {
  const { dy = 400, steps = 4 } = opts;
  const stepDy = Math.round(dy / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepDy);
    await sleep(randInt(80, 200));
  }
}

/**
 * 真人式滚动：分多步小幅滚动，每步停一下。
 */
async function scroll(page, opts = {}) {
  const { dy = 400, steps = 4 } = opts;
  const stepDy = Math.round(dy / steps);
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, stepDy);
    await sleep(randInt(80, 200));
  }
}

/**
 * 上传文件：Node.js 读文件 → base64 传浏览器 → DataTransfer + File API 注入 input。
 * @param {import('playwright').Page} page
 * @param {string} filePath - 文件绝对路径
 */
async function uploadFile(page, filePath) {
  const fs = require('fs');
  const path = require('path');
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath);
  const ext = path.extname(fileName).toLowerCase();
  const mimeMap = {
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.js': 'text/javascript', '.py': 'text/x-python', '.html': 'text/html',
    '.pdf': 'application/pdf', '.csv': 'text/csv',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';

  await page.evaluate(({ name, bufBase64, mime }) => {
    const fileInput = document.querySelector('input[type="file"]');
    if (!fileInput) return;
    const bytes = atob(bufBase64);
    const ab = new ArrayBuffer(bytes.length);
    const ua = new Uint8Array(ab);
    for (let i = 0; i < bytes.length; i++) ua[i] = bytes.charCodeAt(i);
    const file = new File([ab], name, { type: mime });
    const dt = new DataTransfer();
    dt.items.add(file);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
  }, { name: fileName, bufBase64: content.toString('base64'), mime: mimeType });

  await sleep(randInt(300, 800));
}

/**
 * 上传多个文件（依次上传每个）。
 * @param {import('playwright').Page} page
 * @param {string[]} filePaths - 文件路径数组
 */
async function uploadFiles(page, filePaths) {
  for (const path of filePaths) {
    await uploadFile(page, path);
  }
}

module.exports = { click, type, paste, press, scroll, thinkPause, sleep, randInt, uploadFile, uploadFiles };
