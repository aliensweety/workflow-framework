/**
 * step-12.js —— 对比搜索 "Gemini" vs 完整文件名 vs 不带后缀
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-12';

async function searchAndGet(page, keyword) {
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await page.keyboard.press('Control+a');
  await page.keyboard.press('Backspace');
  await human.sleep(300);
  for (const ch of keyword) {
    await page.keyboard.type(ch, { delay: 30 + Math.random() * 40 });
  }
  await human.sleep(2000);
  return page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const imgs = dialog.querySelectorAll('img');
    const items = [];
    for (const img of imgs) {
      if (img.alt === '搜索结果预览') continue;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) items.push(img.alt);
    }
    return items;
  });
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

  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(1000);

  // 测试 1: "Gemini"
  const r1 = await searchAndGet(page, 'Gemini');
  console.log(`\n"Gemini" → ${r1.length} 结果:`);
  r1.forEach((a, i) => console.log(`  ${i + 1}. "${a}"`));

  // 测试 2: 完整文件名带后缀
  const r2 = await searchAndGet(page, 'Gemini_Generated_Image_sh7jbsh7jbsh7jbs.png');
  console.log(`\n"Gemini_Generated_Image_sh7jbsh7jbsh7jbs.png" → ${r2.length} 结果:`);
  r2.forEach((a, i) => console.log(`  ${i + 1}. "${a}"`));

  // 测试 3: 完整文件名不带后缀
  const r3 = await searchAndGet(page, 'Gemini_Generated_Image_sh7jbsh7jbsh7jbs');
  console.log(`\n"Gemini_Generated_Image_sh7jbsh7jbsh7jbs" → ${r3.length} 结果:`);
  r3.forEach((a, i) => console.log(`  ${i + 1}. "${a}"`));

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
