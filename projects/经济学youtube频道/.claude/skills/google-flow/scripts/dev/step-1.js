/**
 * step-1: 导航到已有项目 → 记录旧 UUID → 输入 prompt → 提交生成
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'flow3-dev';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const BASE = 'https://labs.google/fx/zh/tools/flow';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  // ── 段 1: 导航到项目 ──
  await page.goto(`${BASE}/project/${PROJECT_ID}#${URL_TAG}`, { waitUntil: 'networkidle' });
  await page.waitForSelector(S.PROMPT_INPUT, { timeout: 15000 });
  console.log('[step-1] project page loaded');

  // ── 段 2: 记录旧 UUID ──
  const oldUuids = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/edit/"]');
    const uuids = new Set();
    links.forEach(a => {
      const m = a.href.match(/\/edit\/([0-9a-f-]+)$/);
      if (m) uuids.add(m[1]);
    });
    return [...uuids];
  });
  console.log(`[step-1] existing images: ${oldUuids.length}`, oldUuids);

  // ── 段 3: 输入 prompt ──
  // 用 JS focus 避免被搜索框遮挡
  await page.evaluate((sel) => {
    document.querySelector(sel)?.focus();
  }, S.PROMPT_INPUT);
  await human.thinkPause();

  const prompt = 'a small orange cat reading a book';
  await page.keyboard.type(prompt, { delay: 50 });
  console.log(`[step-1] typed prompt: "${prompt}"`);

  // ── 段 4: 提交生成 ──
  // force click 避免被遮挡
  const submitBtn = page.locator(S.SUBMIT_BTN).first();
  await submitBtn.click({ force: true });
  console.log('[step-1] submitted generation');

  // ── 短暂等一下让生成启动 ──
  await human.thinkPause(1000, 2000);

  // ── 输出旧 UUID 供后续 step 使用 ──
  console.log(`[step-1] OLD_UUIDS=${JSON.stringify(oldUuids)}`);

  await dev.hold('step-1: submitted generation, oldUuids recorded');
})().catch(e => { console.error(e); process.exit(1); });
