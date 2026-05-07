/**
 * step-20.js —— 验证 get_generate 流程：检测图片状态 → 下载
 * 用 step-19 生成的 UUID 测试完整的下载链路。
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const path = require('path');
const fs = require('fs');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const IMAGE_UUID = 'fed9603a-d5f0-49e2-ad33-7eeae82c8e22';
const URL_TAG = 'step-20';
const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'runtime');

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  // ── 段 1：找已有 tab 或新开 ──
  console.log('[1] 查找已有 tab...');
  const pagesBefore = context.pages();
  let page = pagesBefore.find(p => p.url().includes(IMAGE_UUID));
  let isNewPage = false;

  if (!page) {
    console.log('[1] 未找到已有 tab，新开页面');
    page = await context.newPage();
    await page.bringToFront();
    await page.setViewportSize({ width: 1280, height: 1024 });
    await page.goto(`${BASE}/project/${PROJECT_ID}#${URL_TAG}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
    isNewPage = true;
  } else {
    console.log('[1] 复用已有 tab');
    await page.bringToFront();
  }

  // ── 段 2：检测图片状态 ──
  console.log('[2] 检测图片状态...');
  const { ready, failure } = await page.evaluate((uuid) => {
    const url = window.location.href;
    if (url.includes('/login') || url.includes('accounts.google.com')) {
      return { ready: false, failure: 'LoginRequired' };
    }
    const body = document.body?.innerText || '';
    if (body.includes('unusual activity') || body.includes('异常活动')) {
      return { ready: false, failure: 'AntiBotError' };
    }

    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (!link) return { ready: false, failure: null };

    const tile = link.closest('[data-tile-id]');
    if (tile && (tile.textContent?.includes('失败') || tile.textContent?.includes('unusual activity'))) {
      return { ready: false, failure: 'GenerationFailed' };
    }

    return { ready: true, failure: null };
  }, IMAGE_UUID);

  console.log(`[2] ready=${ready}, failure=${failure}`);

  if (failure) {
    console.log(`❌ 失败: ${failure}`);
    await dev.hold();
    return;
  }
  if (!ready) {
    console.log('[2] 图片还在生成中');
    await dev.hold();
    return;
  }

  // ── 段 3：hover 触发工具栏 ──
  console.log('[3] hover 触发工具栏...');
  await page.evaluate((uuid) => {
    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (!link) return;
    const parent = link.closest('div[class]');
    if (parent) parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }, IMAGE_UUID);
  await human.sleep(600);

  // ── 段 4：点更多按钮 ──
  console.log('[4] 点更多按钮...');
  await human.physicalClick(page, '[data-testid="virtuoso-item-list"] button:has-text("更多")', { timeout: 5000 });
  await human.sleep(500);

  // ── 段 5：hover 下载项触发子菜单 ──
  console.log('[5] hover 下载菜单...');
  const dlItem = page.locator('[role="menuitem"]:has-text("下载"):not(:has-text("添加"))');
  const dlRect = await dlItem.first().boundingBox();
  if (!dlRect) {
    console.log('❌ DownloadMenuItemNotFound');
    await dev.hold();
    return;
  }
  await page.mouse.move(
    Math.round(dlRect.x + dlRect.width / 2),
    Math.round(dlRect.y + dlRect.height / 2)
  );
  await human.sleep(800);

  // ── 段 6：选分辨率 + 下载 ──
  console.log('[6] 选分辨率并下载...');
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
  if (!targetBtn) {
    targetBtn = page.locator('[role="menuitem"]:has-text("1K")');
  }

  const targetRect = await targetBtn.first().boundingBox();
  if (!targetRect) {
    console.log('❌ ResolutionOptionNotFound');
    await dev.hold();
    return;
  }

  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.mouse.click(
      Math.round(targetRect.x + targetRect.width / 2),
      Math.round(targetRect.y + targetRect.height / 2)
    ),
  ]);

  if (!download) {
    console.log('❌ DownloadEventNotFound');
    await dev.hold();
    return;
  }

  const filename = download.suggestedFilename();
  const savePath = path.join(DOWNLOAD_DIR, filename);
  await download.saveAs(savePath);
  const stats = fs.statSync(savePath);

  console.log(`\n✅ 下载成功！`);
  console.log(`  resolution: ${resolution}`);
  console.log(`  filename: ${filename}`);
  console.log(`  size: ${stats.size} bytes`);
  console.log(`  path: ${savePath}`);

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
