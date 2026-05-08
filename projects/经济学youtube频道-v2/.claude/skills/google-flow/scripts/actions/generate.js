/**
 * action: generate
 * 同步一把梭：导航 → 配置 → 输入 → 提交 → 等生成 → 下载。
 *
 * 模型: nano-banana-2 (默认) / nano-banana-pro
 * 数量: 1 (默认) / 2 / 3 / 4
 * 比例: 3:4 (默认) / 16:9 / 4:3 / 1:1 / 9:16
 */

const human = require('../lib/human');
const path = require('path');
const fs = require('fs');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'runtime');
const GENERATE_TIMEOUT = 120000;
const POLL_INTERVAL = 2000;

const MODELS = {
  'nano-banana-2': 'Nano Banana 2',
  'nano-banana-pro': 'Nano Banana Pro',
};

const RATIOS = ['16:9', '4:3', '1:1', '3:4', '9:16'];

// ── Helpers ──

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

async function waitForRefThumbnail(page) {
  await page.waitForFunction(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return false;
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return false;
      if (el.querySelectorAll('img').length > 0) return true;
    }
    return false;
  }, { timeout: 15000 }).catch(() => {});
  await human.sleep(3000);
}

async function searchAndSelectRef(page, keyword) {
  await human.physicalClick(page, 'button:has-text("add_2")');
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(500);

  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await human.sleep(200);
  await page.evaluate((text) => navigator.clipboard.writeText(text), keyword);
  await page.keyboard.press('Control+v');
  await human.sleep(1500);

  const firstImg = page.locator('[role="dialog"] img').first();
  const rect = await firstImg.boundingBox();
  if (rect) {
    await page.mouse.click(Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2));
  }
  await human.sleep(500);
  await waitForRefThumbnail(page);
}

/**
 * 等待指定数量的新 UUID 出现。失败信号检测只看页面级重定向，
 * 不扫整个 body（避免旧 tile 的 "unusual activity" 文字误判）。
 */
async function waitForNewUuids(page, oldUuids, expectedCount, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  const found = [];
  const oldSet = new Set(oldUuids);

  while (found.length < expectedCount && Date.now() < deadline) {
    // 页面级失败信号：登录丢失（URL 变化）
    const url = page.url();
    if (url.includes('/login') || url.includes('accounts.google.com')) {
      throw new Error('LoginRequired');
    }

    // 反爬检测：DOM 里出现 "unusual activity" 警告区域
    const antiBot = await page.evaluate(() => {
      return !!document.querySelector('[data-testid="generating-failed"]') ||
        !!document.body.innerText.includes('unusual activity') ||
        !!document.body.innerText.includes('We noticed some');
    });
    if (antiBot) {
      throw new Error('AntiBotDetected: unusual activity detected, profile may be blocked');
    }

    const current = await collectUuids(page);
    for (const uuid of current) {
      if (!oldSet.has(uuid) && !found.includes(uuid)) {
        found.push(uuid);
      }
    }
    if (found.length >= expectedCount) break;
    await human.sleep(POLL_INTERVAL);
  }

  return found;
}

/**
 * 下载单张图片：scrollIntoView → hover → 更多 → 下载子菜单 → 选分辨率 → 捕获下载
 */
async function downloadImage(page, imageUuid, downloadResolution) {
  // 滚动到目标图片可见
  await page.evaluate((uuid) => {
    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (link) link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, imageUuid);
  await human.sleep(400);

  // hover 触发工具栏（JS dispatchEvent，因为 React 合成事件）
  await page.evaluate((uuid) => {
    const link = document.querySelector(`a[href*="${uuid}"]`);
    if (!link) return;
    const parent = link.closest('div[class]');
    if (parent) parent.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    link.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }, imageUuid);
  await human.sleep(600);

  // 点击"更多"
  await human.physicalClick(page, '[data-testid="virtuoso-item-list"] button:has-text("更多")', { timeout: 5000 });
  await human.sleep(500);

  // 物理移动到"下载"菜单项（Radix 子菜单只响应 PointerEvent）
  const dlItem = page.locator('[role="menuitem"]:has-text("下载"):not(:has-text("添加"))');
  const dlRect = await dlItem.first().boundingBox();
  if (!dlRect) throw new Error('DownloadMenuItemNotFound');
  await page.mouse.move(
    Math.round(dlRect.x + dlRect.width / 2),
    Math.round(dlRect.y + dlRect.height / 2)
  );

  // 动态等待子菜单出现（替代硬编码 800ms）
  await page.waitForSelector(
    '[role="menuitem"]:has-text("2K"), [role="menuitem"]:has-text("1K")',
    { timeout: 5000 }
  );

  // 选分辨率：优先 2K（未被 disabled），否则 1K
  const preferBest = !downloadResolution || downloadResolution === 'best';
  let resolution = '1K';
  let targetBtn;

  if (preferBest || downloadResolution === '2k') {
    const twoK = page.locator('[role="menuitem"]:has-text("2K"):not([aria-disabled="true"])');
    if (await twoK.count() > 0) {
      const disabled = await twoK.first().getAttribute('aria-disabled');
      if (disabled !== 'true') {
        targetBtn = twoK;
        resolution = '2K';
      }
    }
  }

  if (!targetBtn) {
    targetBtn = page.locator('[role="menuitem"]:has-text("1K")');
  }

  const targetRect = await targetBtn.first().boundingBox();
  if (!targetRect) throw new Error('ResolutionOptionNotFound');

  // 点击 + 捕获下载
  fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.mouse.click(
      Math.round(targetRect.x + targetRect.width / 2),
      Math.round(targetRect.y + targetRect.height / 2)
    ),
  ]);

  if (!download) throw new Error('DownloadEventNotFound');

  const filename = download.suggestedFilename();
  const savePath = path.join(DOWNLOAD_DIR, filename);
  await download.saveAs(savePath);
  const stats = fs.statSync(savePath);

  return {
    imageUuid,
    imagePath: savePath,
    resolution,
    filename,
    sizeBytes: stats.size,
  };
}

// ── Main ──

async function generate({ context, prompt, projectId, referenceSearch, model, aspectRatio, count, downloadResolution }) {
  const startedAt = Date.now();
  if (!projectId) throw new Error('--project-id 必填');
  const pid = projectId;
  const imgCount = count || 1;
  let page;
  let success = false;

  try {
    page = await context.newPage();
    await page.bringToFront();
    await page.setViewportSize({ width: 1280, height: 1024 });

    // ── 导航到项目 ──
    await page.goto(`${BASE}/project/${pid}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });

    // ── 添加参考图（通过搜索已上传图片）──
    const refSearches = [];
    if (referenceSearch) {
      if (Array.isArray(referenceSearch)) refSearches.push(...referenceSearch);
      else refSearches.push(...referenceSearch.split(',').map(s => s.trim()).filter(Boolean));
    }

    for (const kw of refSearches) {
      await searchAndSelectRef(page, kw);
    }

    // ── 配置参数（始终打开面板，显式设置所有值，避免残留旧设置）──
    await human.physicalClick(page, 'button:has-text("Nano Banana")');
    await human.sleep(500);

    if (model && MODELS[model]) {
      await human.physicalClick(page, 'button:has-text("arrow_drop_down")');
      await human.sleep(300);
      await human.physicalClick(page, `[role="menuitem"]:has-text("${MODELS[model]}")`);
      await human.sleep(300);
    }

    if (aspectRatio && RATIOS.includes(aspectRatio)) {
      const tab = page.locator(`[role="tab"]:has-text("${aspectRatio}")`);
      if (await tab.count() > 0) await tab.click({ force: true });
      await human.sleep(200);
    }

    // 始终设置 count，包括 count=1（重置平台残留的 x2/x3/x4）
    const countLabel = imgCount === 1 ? '1x' : `x${imgCount}`;
    const countTab = page.locator(`[role="tab"]:has-text("${countLabel}")`);
    if (await countTab.count() > 0) await countTab.click({ force: true });
    await human.sleep(200);

    await page.keyboard.press('Escape');
    await human.sleep(300);

    // ── 记录旧 UUID ──
    const oldUuids = await collectUuids(page);

    // ── 输入 prompt ──
    await page.evaluate(() => {
      document.querySelector('[contenteditable="true"]')?.focus();
    });
    await human.sleep(200);
    await page.evaluate((text) => navigator.clipboard.writeText(text), prompt);
    await page.keyboard.press('Control+v');
    await human.sleep(500);

    // ── 提交生成 ──
    await human.physicalClick(page, 'button:has-text("arrow_forward")');

    // ── 等待新 UUID 出现 ──
    const newUuids = await waitForNewUuids(page, oldUuids, imgCount, GENERATE_TIMEOUT);
    if (newUuids.length === 0) throw new Error('GenerationTimeout');

    // ── 逐张下载 ──
    const images = [];
    for (const uuid of newUuids) {
      const dlResult = await downloadImage(page, uuid, downloadResolution);
      images.push(dlResult);
    }

    success = true;
    return {
      success: true,
      images,
      prompt,
      projectId: pid,
      took_ms: Date.now() - startedAt,
    };
  } finally {
    if (page) await page.close();
  }
}

module.exports = generate;
