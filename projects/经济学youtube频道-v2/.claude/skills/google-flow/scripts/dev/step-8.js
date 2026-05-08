/**
 * step-8.js —— 仔细观察参考图上传进度 + 完整生成流程
 * 1. 导航
 * 2. 点 add_2 → 上传图片
 * 3. 等上传进度完成（百分比）
 * 4. 确认参考图出现在文本框上方
 * 5. 记录旧 UUID
 * 6. 输入 prompt → 提交
 * 7. 等新 UUID → 下载
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const path = require('path');
const fs = require('fs');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-8';
const DOWNLOAD_DIR = path.join(__dirname, '..', '..', 'runtime');
const REF_IMAGE = 'E:\\Downloads\\Gemini_Generated_Image_sh7jbsh7jbsh7jbs.png';

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

  // ── 导航 ──
  console.log('[1] 导航...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 加载完成');

  // ── 上传参考图 ──
  console.log('[2] 打开弹窗上传参考图...');
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(500);

  await page.waitForSelector(':text("上传图片")', { timeout: 5000 });
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.locator(':text("上传图片")').click(),
  ]);
  await fileChooser.setFiles(REF_IMAGE);
  console.log('[2] 文件已选择');
  await human.sleep(2000);

  // ── 观察上传后的状态 ──
  console.log('[3] 观察上传进度...');

  // 轮询看文本框上方的参考图区域，检查有没有百分比/进度
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => {
      const editable = document.querySelector('[contenteditable="true"]');
      if (!editable) return { status: 'no-editable' };
      let el = editable;
      for (let j = 0; j < 10; j++) {
        el = el.parentElement;
        if (!el) return { status: 'no-parent', level: j };
      }
      // 查找这个容器及其子元素中所有的文字
      const allText = el.innerText?.substring(0, 300) || '';
      const imgs = el.querySelectorAll('img');
      const imgCount = imgs.length;
      const imgSrcs = [...imgs].map(img => img.src.substring(0, 80));

      // 检查有没有百分比文字
      const hasPercentage = /\d+%/g.test(allText);
      // 检查有没有进度条
      const progressBars = el.querySelectorAll('[role="progressbar"], [aria-valuenow]');
      const hasProgress = progressBars.length > 0;

      // 检查有没有 loading/spinner
      const hasLoading = allText.includes('上传') || allText.includes('loading') || allText.includes('处理');

      return {
        allText: allText.substring(0, 200),
        imgCount,
        imgSrcs,
        hasPercentage,
        hasProgress,
        progressBars: progressBars.length,
        hasLoading,
      };
    });
    console.log(`[3] 轮询 ${i}: imgs=${state.imgCount}, pct=${state.hasPercentage}, progress=${state.hasProgress}(${state.progressBars}), loading=${state.hasLoading}`);
    if (state.allText && state.allText.length > 5) {
      console.log(`[3] 文本: ${state.allText}`);
    }

    // 如果没有百分比且没有进度条且有图片，说明上传完成了
    if (state.imgCount > 0 && !state.hasPercentage && !state.hasProgress) {
      console.log('[3] 参考图上传完成（无进度指示）');
      break;
    }
    // 如果有进度条但值是100或完成
    if (state.hasProgress) {
      const progressValue = await page.evaluate(() => {
        const pb = document.querySelector('[role="progressbar"][aria-valuenow]');
        return pb ? pb.getAttribute('aria-valuenow') : null;
      });
      console.log(`[3] 进度值: ${progressValue}`);
      if (progressValue === '100') {
        console.log('[3] 上传完成 (100%)');
        break;
      }
    }

    await human.sleep(1500);
  }

  // 再等一下确保稳定
  await human.sleep(2000);

  // dump 参考图区域的完整 DOM
  console.log('[4] 参考图区域 DOM:');
  const refAreaDom = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return 'no editable';
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return 'no parent';
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        // 递归 dump 3层
        function dump(node, depth) {
          if (depth > 3 || !node) return '';
          const tag = node.tagName?.toLowerCase() || '#text';
          const text = node.nodeType === 3 ? node.textContent?.trim().substring(0, 50) : '';
          if (text) return '  '.repeat(depth) + `"${text}"\n`;
          const cls = node.className && typeof node.className === 'string' ? node.className.substring(0, 40) : '';
          const attrs = [];
          if (node.src) attrs.push(`src="${node.src.substring(0, 60)}"`);
          if (node.alt) attrs.push(`alt="${node.alt}"`);
          if (node.href) attrs.push(`href="${node.href.substring(0, 60)}"`);
          if (node.role) attrs.push(`role="${node.role}"`);
          if (node.getAttribute('aria-valuenow')) attrs.push(`valuenow="${node.getAttribute('aria-valuenow')}"`);
          let result = '  '.repeat(depth) + `<${tag}${cls ? ' class="' + cls + '"' : ''}${attrs.length ? ' ' + attrs.join(' ') : ''}>\n`;
          for (const child of node.childNodes) {
            result += dump(child, depth + 1);
          }
          return result;
        }
        return dump(el, 0);
      }
    }
    return 'no img found';
  });
  console.log(refAreaDom);

  // ── 记录旧 UUID（上传完成后）──
  const oldUuids = await collectUuids(page);
  console.log(`[5] 旧 UUID 数: ${oldUuids.length}`);

  // ── 输入 prompt ──
  console.log('[6] 输入 prompt...');
  await page.evaluate(() => {
    document.querySelector('[contenteditable="true"]')?.focus();
  });
  await human.thinkPause();
  const promptText = 'a felt raccoon cooking in a kitchen';
  for (const ch of promptText) {
    await page.keyboard.type(ch, { delay: 40 + Math.random() * 60 });
  }

  // ── 提交 ──
  console.log('[7] 提交生成...');
  await page.locator('button:has-text("arrow_forward")').first().click({ force: true });

  // ── 等新 UUID ──
  console.log('[8] 等待新图片...');
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
  console.log(`[8] 新 UUID: ${newUuid} (${Date.now() - genStart}ms)`);

  // ── 下载 ──
  console.log('[9] 下载...');
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
    if (disabled !== 'true') { targetBtn = twoK; resolution = '2K'; }
  }
  if (!targetBtn) targetBtn = page.locator('[role="menuitem"]:has-text("1K")');
  const targetRect = await targetBtn.first().boundingBox();
  if (!targetRect) throw new Error('ResolutionOptionNotFound');

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
    prompt: promptText,
    projectId: PROJECT_ID,
    took_ms: Date.now() - startedAt,
  }, null, 2));

  await page.close();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
