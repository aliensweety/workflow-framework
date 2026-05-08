/**
 * human.js
 * --------------------------------------------------
 * 模拟真人操作的工具。CDP 解决了"是不是真实 Chrome 进程"，
 * 但操作模式（点击间隔、是否逐字输入、是否 hover）仍可能被反爬识别。
 *
 * 业务脚本（actions/*.js）默认用这套，不裸用 page.click / page.fill。
 *
 * ★ 重要：type() 内部用 keyboard.type() 逐字输入。千万不要换成 page.fill()——
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
 * 真人式按键。
 */
async function press(page, key) {
  await sleep(randInt(50, 150));
  await page.keyboard.press(key);
}

/**
 * 真人式粘贴：click 聚焦 → clipboard.writeText → Ctrl+V。
 * 比 type() 快得多，且走正常键盘事件链，不会被反爬检测。
 */
async function paste(page, selector, text) {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: 'visible', timeout: 10000 });
  await loc.click();
  await sleep(randInt(50, 150));
  await page.evaluate((t) => navigator.clipboard.writeText(t), text);
  await sleep(randInt(50, 150));
  await page.keyboard.press('Control+v');
}

/**
 * 上传文件：点击上传按钮 → 拦截 filechooser → setFiles。
 * 不依赖隐藏的 input[type=file]，而是通过弹出的 UI 对话框。
 */
async function uploadFile(page, filePath) {
  const uploadBtn = page.locator('button[aria-label="打开文件上传菜单"]');
  await uploadBtn.waitFor({ state: 'visible', timeout: 5000 });
  await uploadBtn.click();
  await page.waitForSelector('text=上传文件', { timeout: 5000 });

  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('text=上传文件'),
  ]);
  await fileChooser.setFiles(filePath);
  await page.waitForTimeout(1000);
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

module.exports = { click, type, paste, uploadFile, press, scroll, thinkPause, sleep, randInt };
