/**
 * step-11.js —— 搜索已上传的参考图并选中到对话框上方
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-11';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // 导航
  console.log('[1] 导航...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 加载完成');

  // 打开弹窗
  console.log('[2] 打开弹窗...');
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(1000);

  // 先看完整列表
  const allImgs = await page.evaluate(() => {
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
  console.log(`[2] 完整列表 (${allImgs.length}):`);
  allImgs.forEach((alt, i) => console.log(`  ${i + 1}. "${alt}"`));

  // 搜索 "Gemini"
  console.log('\n[3] 搜索 "Gemini"...');
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await human.thinkPause();
  for (const ch of 'Gemini') {
    await page.keyboard.type(ch, { delay: 40 + Math.random() * 60 });
  }
  await human.sleep(2000);

  const geminiResults = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const imgs = dialog.querySelectorAll('img');
    const items = [];
    for (const img of imgs) {
      if (img.alt === '搜索结果预览') continue;
      const rect = img.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        items.push({ alt: img.alt, x: rect.x, y: rect.y, w: rect.width, h: rect.height, src: img.src.substring(0, 100) });
      }
    }
    return items;
  });
  console.log(`搜索结果 (${geminiResults.length}):`);
  geminiResults.forEach((r, i) => console.log(`  ${i + 1}. alt="${r.alt}" src=${r.src}`));

  // 点击第一张
  if (geminiResults.length > 0) {
    const target = geminiResults[0];
    console.log(`\n[4] 点击第一张: "${target.alt}" at (${target.x}, ${target.y})`);
    await page.mouse.click(Math.round(target.x + target.w / 2), Math.round(target.y + target.h / 2));
    await human.sleep(2000);

    // 确认弹窗关闭 + 参考图出现在 prompt 上方
    const dialogClosed = (await page.locator('[role="dialog"]').count()) === 0;
    console.log(`[4] 弹窗关闭: ${dialogClosed}`);

    const refCheck = await page.evaluate(() => {
      const editable = document.querySelector('[contenteditable="true"]');
      if (!editable) return null;
      let el = editable;
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) return null;
        const imgs = el.querySelectorAll('img');
        if (imgs.length > 0) {
          return { count: imgs.length, src: imgs[0].src.substring(0, 100), alt: imgs[0].alt };
        }
      }
      return null;
    });
    console.log(`[4] 参考图: ${JSON.stringify(refCheck)}`);
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
