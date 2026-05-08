/**
 * step-2: 完整流程 —— 输入 prompt → 提交 → 等生成完成 → 下载图片
 * 验证 UUID diff 检测 + 物理鼠标下载流程
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const path = require('path');
const fs = require('fs');

const URL_TAG = 'flow3-dev';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const BASE = 'https://labs.google/fx/zh/tools/flow';

const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'runtime');

async function collectUuids(page) {
  return page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/edit/"]');
    const uuids = new Set();
    links.forEach(a => {
      const m = a.href.match(/\/edit\/([0-9a-f-]+)$/);
      if (m) uuids.add(m[1]);
    });
    return [...uuids];
  });
}

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // ── 段 1: 导航 ──
  await page.goto(`${BASE}/project/${PROJECT_ID}#${URL_TAG}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[step-2] project page loaded');

  // ── 段 2: 记录旧 UUID ──
  const oldUuids = await collectUuids(page);
  console.log(`[step-2] old images: ${oldUuids.length}`);

  // ── 段 3: 输入 prompt ──
  await page.evaluate(() => {
    document.querySelector('[contenteditable="true"]')?.focus();
  });
  await human.thinkPause();

  const prompt = 'a fluffy white dog sleeping on couch';
  for (const ch of prompt) {
    await page.keyboard.type(ch, { delay: 40 + Math.random() * 60 });
  }
  console.log(`[step-2] typed prompt`);

  // ── 段 4: 提交 ──
  await page.locator('button:has-text("arrow_forward")').first().click({ force: true });
  console.log('[step-2] submitted');

  // ── 段 5: 轮询等新 UUID 出现（最多 120 秒）──
  const startTime = Date.now();
  const TIMEOUT = 120000;
  let newUuid = null;

  while (Date.now() - startTime < TIMEOUT) {
    await human.sleep(2000);
    const currentUuids = await collectUuids(page);
    const newUuids = currentUuids.filter(u => !oldUuids.includes(u));
    if (newUuids.length > 0) {
      newUuid = newUuids[0];
      console.log(`[step-2] generation complete! new uuid: ${newUuid}`);
      break;
    }
    // 检查失败
    const hasFailed = await page.evaluate(() => document.body.innerText.includes('失败'));
    if (hasFailed) {
      console.log('[step-2] some generation failed, continuing to wait for success...');
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`[step-2] waiting... ${elapsed}s`);
  }

  if (!newUuid) {
    throw new Error('timeout: no new image UUID appeared within 120s');
  }

  // ── 段 6: 下载图片 ──
  console.log('[step-2] starting download...');

  // 6.1: 用 JS dispatchEvent 触发图片 hover toolbar
  await page.evaluate((uuid) => {
    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (!link) return 'not found';
    const parent = link.closest('div[class]');
    if (parent) parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }, newUuid);
  await human.sleep(600);

  // 6.2: 找到 grid 内的"更多"按钮并物理点击
  const moreBtn = page.locator('[data-testid="virtuoso-item-list"] button:has-text("更多")');
  const moreRect = await moreBtn.first().boundingBox();
  if (!moreRect) throw new Error('more button not found');
  await page.mouse.click(
    Math.round(moreRect.x + moreRect.width / 2),
    Math.round(moreRect.y + moreRect.height / 2)
  );
  await human.sleep(500);
  console.log('[step-2] clicked more button');

  // 6.3: 移动鼠标到"下载"触发 Radix 子菜单
  const dlItem = page.locator('[role="menuitem"]:has-text("下载"):not(:has-text("添加"))');
  const dlRect = await dlItem.first().boundingBox();
  if (!dlRect) throw new Error('download menuitem not found');
  await page.mouse.move(
    Math.round(dlRect.x + dlRect.width / 2),
    Math.round(dlRect.y + dlRect.height / 2)
  );
  await human.sleep(800);
  console.log('[step-2] hovered download, submenu should appear');

  // 6.4: 优先 2K，降级 1K
  const twoK = page.locator('[role="menuitem"]:has-text("2K"):not([aria-disabled])');
  const oneK = page.locator('[role="menuitem"]:has-text("1K")');
  let targetBtn = twoK;
  let resolution = '2K';

  const twoKCount = await twoK.count();
  const twoKDisabled = twoKCount > 0 && await twoK.first().getAttribute('aria-disabled');
  if (twoKCount === 0 || twoKDisabled === 'true') {
    targetBtn = oneK;
    resolution = '1K';
  }

  const targetRect = await targetBtn.first().boundingBox();
  if (!targetRect) throw new Error(`${resolution} option not found`);

  // 6.5: 点击并捕获下载
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.mouse.click(
      Math.round(targetRect.x + targetRect.width / 2),
      Math.round(targetRect.y + targetRect.height / 2)
    ),
  ]);

  if (!download) throw new Error('no download event');

  const filename = download.suggestedFilename();
  const savePath = path.join(DOWNLOAD_DIR, filename);
  await download.saveAs(savePath);
  const stats = fs.statSync(savePath);

  console.log(`[step-2] downloaded: ${filename}`);
  console.log(`[step-2] saved to: ${savePath}`);
  console.log(`[step-2] size: ${stats.size} bytes`);
  console.log(`[step-2] resolution: ${resolution}`);

  // ── 输出结果 ──
  const result = {
    success: true,
    imagePath: savePath,
    imageUuid: newUuid,
    resolution,
    filename,
    sizeBytes: stats.size,
    prompt,
    projectId: PROJECT_ID,
  };
  console.log(`[step-2] RESULT=${JSON.stringify(result)}`);

  await dev.hold('step-2: complete generate + download flow');
})().catch(e => { console.error(e); process.exit(1); });
