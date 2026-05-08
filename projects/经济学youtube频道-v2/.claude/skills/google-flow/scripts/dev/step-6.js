/**
 * step-6.js —— 测试搜索关键词精确度
 * 分别搜索部分关键词和完整名称，对比结果数量
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-6';

async function searchAndGetCount(page, keyword) {
  // 清空搜索框
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await human.sleep(300);
  // 输入关键词
  for (const ch of keyword) {
    await page.keyboard.type(ch, { delay: 30 + Math.random() * 40 });
  }
  await human.sleep(2000);

  // 获取搜索结果
  const results = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const imgs = dialog.querySelectorAll('img');
    const items = [];
    for (const img of imgs) {
      if (img.alt === '搜索结果预览') continue;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({ alt: img.alt, src: img.src.substring(0, 120) });
      }
    }
    return items;
  });
  return results;
}

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  console.log('[1] 导航...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 加载完成');

  // 打开弹窗
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(1000);

  // 测试 1: 部分 "cat"
  console.log('\n=== 搜索 "cat" ===');
  const catResults = await searchAndGetCount(page, 'cat');
  console.log(`结果数: ${catResults.length}`);
  catResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  // 测试 2: 更精确 "a simple test cat"
  console.log('\n=== 搜索 "a simple test cat" ===');
  const fullResults = await searchAndGetCount(page, 'a simple test cat');
  console.log(`结果数: ${fullResults.length}`);
  fullResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  // 测试 3: 部分场景 "scene"
  console.log('\n=== 搜索 "scene" ===');
  const sceneResults = await searchAndGetCount(page, 'scene');
  console.log(`结果数: ${sceneResults.length}`);
  sceneResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  // 测试 4: 完整 "Orange cat reading book"
  console.log('\n=== 搜索 "Orange cat reading book" ===');
  const orangeResults = await searchAndGetCount(page, 'Orange cat reading book');
  console.log(`结果数: ${orangeResults.length}`);
  orangeResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  // 测试 5: 部分 "Red panda"
  console.log('\n=== 搜索 "Red panda" ===');
  const pandaResults = await searchAndGetCount(page, 'Red panda');
  console.log(`结果数: ${pandaResults.length}`);
  pandaResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  // 测试 6: 完整 "Red panda with IOU bag"
  console.log('\n=== 搜索 "Red panda with IOU bag" ===');
  const pandaFullResults = await searchAndGetCount(page, 'Red panda with IOU bag');
  console.log(`结果数: ${pandaFullResults.length}`);
  pandaFullResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}"`));

  await dev.hold();
}

main().catch(err => {
  console.error('[step-6 ERROR]', err.message);
  process.exit(1);
});
