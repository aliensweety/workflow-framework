/**
 * step-7.js —— 查找小浣熊图片的名称，然后用它做参考图生成
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const path = require('path');
const fs = require('fs');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-7';
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
  console.log('[1] 加载完成');

  // 打开弹窗看所有图片名称
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(1000);

  const allImgs = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const imgs = dialog.querySelectorAll('img');
    const items = [];
    for (const img of imgs) {
      if (img.alt === '搜索结果预览') continue;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({ alt: img.alt, src: img.src });
      }
    }
    return items;
  });
  console.log(`\n所有图片 (${allImgs.length}):`);
  allImgs.forEach((r, i) => console.log(`  ${i + 1}. "${r.alt}"`));

  // 搜索 "raccoon" 或 "浣熊" 试试
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await human.thinkPause();
  for (const ch of 'raccoon') {
    await page.keyboard.type(ch, { delay: 30 + Math.random() * 40 });
  }
  await human.sleep(2000);

  let raccoonResults = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const imgs = dialog.querySelectorAll('img');
    const items = [];
    for (const img of imgs) {
      if (img.alt === '搜索结果预览') continue;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({ alt: img.alt });
      }
    }
    return items;
  });
  console.log(`\n搜索 "raccoon" (${raccoonResults.length}):`);
  raccoonResults.forEach((r, i) => console.log(`  ${i + 1}. "${r.alt}"`));

  // 如果没结果，清空搜 "felt" 或 "Gemini"
  if (raccoonResults.length === 0) {
    await searchInput.first().click({ force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await human.sleep(300);
    for (const ch of 'felt') {
      await page.keyboard.type(ch, { delay: 30 + Math.random() * 40 });
    }
    await human.sleep(2000);
    raccoonResults = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const imgs = dialog.querySelectorAll('img');
      const items = [];
      for (const img of imgs) {
        if (img.alt === '搜索结果预览') continue;
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) items.push({ alt: img.alt });
      }
      return items;
    });
    console.log(`\n搜索 "felt" (${raccoonResults.length}):`);
    raccoonResults.forEach((r, i) => console.log(`  ${i + 1}. "${r.alt}"`));
  }

  // 再试 "Gemini"
  if (raccoonResults.length === 0) {
    await searchInput.first().click({ force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await human.sleep(300);
    for (const ch of 'Gemini') {
      await page.keyboard.type(ch, { delay: 30 + Math.random() * 40 });
    }
    await human.sleep(2000);
    raccoonResults = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const imgs = dialog.querySelectorAll('img');
      const items = [];
      for (const img of imgs) {
        if (img.alt === '搜索结果预览') continue;
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) items.push({ alt: img.alt });
      }
      return items;
    });
    console.log(`\n搜索 "Gemini" (${raccoonResults.length}):`);
    raccoonResults.forEach((r, i) => console.log(`  ${i + 1}. "${r.alt}"`));
  }

  // 最后试空搜索看完整列表
  if (raccoonResults.length === 0) {
    await searchInput.first().click({ force: true });
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Backspace');
    await human.sleep(2000);
    const fullList = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const imgs = dialog.querySelectorAll('img');
      const items = [];
      for (const img of imgs) {
        if (img.alt === '搜索结果预览') continue;
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) items.push({ alt: img.alt });
      }
      return items;
    });
    console.log(`\n空搜索完整列表 (${fullList.length}):`);
    fullList.forEach((r, i) => console.log(`  ${i + 1}. "${r.alt}"`));
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[step-7 ERROR]', err.message);
  process.exit(1);
});
