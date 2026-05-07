/**
 * step-5.js —— 端到端验证：搜索参考图 + 生成
 * 用 referenceSearch 模式搜索 "cat" 选中第一张 → 输入 prompt → 提交 → 等 UUID diff → 下载
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-5';
const DOWNLOAD_DIR = require('path').join(__dirname, '..', '..', 'runtime');

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

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  const startedAt = Date.now();

  // 导航
  console.log('[1] 导航...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 页面加载完成');

  const oldUuids = await collectUuids(page);
  console.log(`[1] 旧 UUID 数: ${oldUuids.length}`);

  // 搜索参考图
  console.log('[2] 打开弹窗搜索参考图...');
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(500);

  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click();
  await human.thinkPause();
  for (const ch of 'cat') {
    await page.keyboard.type(ch, { delay: 50 + Math.random() * 60 });
  }
  await human.sleep(1500);

  // 点击第一张搜索结果
  console.log('[2] 点击第一张搜索结果...');
  const firstImg = page.locator('[role="dialog"] img').first();
  const rect = await firstImg.boundingBox();
  if (rect) {
    await page.mouse.click(Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2));
  }
  await human.sleep(1500);

  // 确认参考图出现在 prompt 上方
  const refImg = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return null;
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return null;
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) return imgs[0].src.substring(0, 100);
    }
    return null;
  });
  console.log(`[2] 参考图 src: ${refImg}`);

  // 输入 prompt
  console.log('[3] 输入 prompt...');
  await page.evaluate(() => {
    document.querySelector('[contenteditable="true"]')?.focus();
  });
  await human.thinkPause();
  for (const ch of 'a cute cat wearing a tiny hat') {
    await page.keyboard.type(ch, { delay: 40 + Math.random() * 60 });
  }

  // 提交
  console.log('[4] 提交生成...');
  await page.locator('button:has-text("arrow_forward")').first().click({ force: true });

  // 等 UUID diff
  console.log('[5] 等待新图片...');
  const genStart = Date.now();
  let newUuid = null;
  while (Date.now() - genStart < 120000) {
    await human.sleep(3000);
    const current = await collectUuids(page);
    const newUuids = current.filter(u => !oldUuids.includes(u));
    if (newUuids.length > 0) {
      newUuid = newUuids[0];
      break;
    }
  }
  if (!newUuid) throw new Error('GenerationTimeout');
  console.log(`[5] 新 UUID: ${newUuid} (等了 ${Date.now() - genStart}ms)`);

  // 下载
  console.log('[6] 下载...');
  await page.evaluate((uuid) => {
    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (!link) return;
    const parent = link.closest('div[class]');
    if (parent) parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }, newUuid);
  await human.sleep(600);

  const moreBtn = page.locator('[data-testid="virtuoso-item-list"] button:has-text("更多")');
  const moreRect = await moreBtn.first().boundingBox();
  if (!moreRect) throw new Error('MoreButtonNotFound');
  await page.mouse.click(Math.round(moreRect.x + moreRect.width / 2), Math.round(moreRect.y + moreRect.height / 2));
  await human.sleep(500);

  const dlItem = page.locator('[role="menuitem"]:has-text("下载"):not(:has-text("添加"))');
  const dlRect = await dlItem.first().boundingBox();
  if (!dlRect) throw new Error('DownloadMenuItemNotFound');
  await page.mouse.move(Math.round(dlRect.x + dlRect.width / 2), Math.round(dlRect.y + dlRect.height / 2));
  await human.sleep(800);

  const twoK = page.locator('[role="menuitem"]:has-text("2K"):not([aria-disabled="true"])');
  let targetBtn;
  let resolution = '1K';
  const twoKCount = await twoK.count();
  if (twoKCount > 0) {
    const disabled = await twoK.first().getAttribute('aria-disabled');
    if (disabled !== 'true') {
      targetBtn = twoK;
      resolution = '2K';
    }
  }
  if (!targetBtn) targetBtn = page.locator('[role="menuitem"]:has-text("1K")');

  const targetRect = await targetBtn.first().boundingBox();
  if (!targetRect) throw new Error('ResolutionOptionNotFound');

  const fs = require('fs');
  const path = require('path');
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.mouse.click(Math.round(targetRect.x + targetRect.width / 2), Math.round(targetRect.y + targetRect.height / 2)),
  ]);

  if (!download) throw new Error('DownloadEventNotFound');
  const filename = download.suggestedFilename();
  const savePath = path.join(DOWNLOAD_DIR, filename);
  await download.saveAs(savePath);
  const stats = fs.statSync(savePath);

  console.log('[完成]', JSON.stringify({
    success: true,
    imagePath: savePath,
    imageUuid: newUuid,
    resolution,
    filename,
    sizeBytes: stats.size,
    prompt: 'a cute cat wearing a tiny hat',
    projectId: PROJECT_ID,
    took_ms: Date.now() - startedAt,
  }, null, 2));

  await page.close();
}

main().catch(err => {
  console.error('[step-5 ERROR]', err.message);
  process.exit(1);
});
