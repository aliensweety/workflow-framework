/**
 * step-17.js —— 探索多图选择流程：选择信号、缩略图反馈、完整交互时序
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = 'fdcb30f4-431e-4790-abb7-b9f649e3e707';
const URL_TAG = 'step-17';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  console.log('[1] 导航到项目...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 加载完成');

  // 打开弹窗
  console.log('\n[2] 打开 add_2 弹窗...');
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(1000);

  // 搜索 "小浣熊"
  console.log('\n[3] 搜索 "小浣熊"...');
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await human.sleep(200);
  await page.evaluate(() => navigator.clipboard.writeText('小浣熊'));
  await page.keyboard.press('Control+v');
  await human.sleep(2000);

  // 看搜索结果
  const imgsBefore = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return [...dialog.querySelectorAll('img')]
      .filter(img => img.alt !== '搜索结果预览' && img.getBoundingClientRect().width > 0)
      .map(img => ({ alt: img.alt, src: img.src.substring(0, 80) }));
  });
  console.log(`[3] 搜索结果 (${imgsBefore.length} 张):`);
  imgsBefore.forEach((r, i) => console.log(`  ${i+1}. alt="${r.alt}"`));

  // 看 prompt 上方当前有没有参考图
  const refBefore = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return [];
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return [];
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        return [...imgs].map(img => ({
          alt: img.alt,
          src: img.src.substring(0, 80),
          displayWidth: img.getBoundingClientRect().width,
        }));
      }
    }
    return [];
  });
  console.log(`\n[3] 选择前 prompt 上方图片: ${refBefore.length} 张`);
  refBefore.forEach(r => console.log(`  alt="${r.alt}" w=${r.displayWidth}`));

  // 点击第一张图片
  console.log('\n[4] 点击第一张图片...');
  const firstImg = page.locator('[role="dialog"] img').first();
  const rect = await firstImg.boundingBox();
  console.log(`[4] 图片位置: (${rect.x}, ${rect.y}) w=${rect.width} h=${rect.height}`);

  await page.mouse.click(Math.round(rect.x + rect.width / 2), Math.round(rect.y + rect.height / 2));
  await human.sleep(1500);

  // 看选择后 prompt 上方的图片
  const refAfter1 = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return [];
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return [];
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        return [...imgs].map(img => ({
          alt: img.alt,
          src: img.src.substring(0, 80),
          displayWidth: img.getBoundingClientRect().width,
        }));
      }
    }
    return [];
  });
  console.log(`[4] 选择后 prompt 上方图片: ${refAfter1.length} 张`);
  refAfter1.forEach(r => console.log(`  alt="${r.alt}" w=${r.displayWidth}`));

  // 弹窗还在吗？
  const dialogAfter1 = await page.locator('[role="dialog"]').count();
  console.log(`[4] 弹窗仍开着: ${dialogAfter1 > 0}`);

  // 如果弹窗还开着，再选一张
  if (dialogAfter1 > 0) {
    console.log('\n[5] 再选一张...');
    // 重新搜一下确保列表刷新
    await searchInput.first().click({ force: true });
    await page.keyboard.press('Control+a');
    await human.sleep(100);
    await page.evaluate(() => navigator.clipboard.writeText('小浣熊'));
    await page.keyboard.press('Control+v');
    await human.sleep(2000);

    const imgs2 = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return [...dialog.querySelectorAll('img')]
        .filter(img => img.alt !== '搜索结果预览' && img.getBoundingClientRect().width > 0)
        .map(img => ({ alt: img.alt }));
    });
    console.log(`[5] 搜索结果: ${imgs2.length} 张`);

    if (imgs2.length > 1) {
      // 点击第二张
      const secondImg = page.locator('[role="dialog"] img').nth(1);
      const rect2 = await secondImg.boundingBox();
      console.log(`[5] 点击第二张: alt="${imgs2[1].alt}"`);
      await page.mouse.click(Math.round(rect2.x + rect2.width / 2), Math.round(rect2.y + rect2.height / 2));
      await human.sleep(1500);
    }

    const refAfter2 = await page.evaluate(() => {
      const editable = document.querySelector('[contenteditable="true"]');
      if (!editable) return [];
      let el = editable;
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) return [];
        const imgs = el.querySelectorAll('img');
        if (imgs.length > 0) {
          return [...imgs].map(img => ({
            alt: img.alt,
            displayWidth: img.getBoundingClientRect().width,
          }));
        }
      }
      return [];
    });
    console.log(`[5] 选择后 prompt 上方图片: ${refAfter2.length} 张`);
    refAfter2.forEach(r => console.log(`  alt="${r.alt}" w=${r.displayWidth}`));

    const dialogAfter2 = await page.locator('[role="dialog"]').count();
    console.log(`[5] 弹窗仍开着: ${dialogAfter2 > 0}`);
  }

  // 尝试输入 prompt，看多图是否影响
  console.log('\n[6] 输入 prompt 测试...');
  await page.evaluate(() => {
    document.querySelector('[contenteditable="true"]')?.focus();
  });
  await human.sleep(200);
  await page.evaluate(() => navigator.clipboard.writeText('a cute raccoon reading a book'));
  await page.keyboard.press('Control+v');
  await human.sleep(500);

  const promptText = await page.evaluate(() => {
    return document.querySelector('[contenteditable="true"]')?.textContent?.trim();
  });
  console.log(`[6] prompt 内容: "${promptText}"`);

  // 看 prompt 上方的缩略图
  const finalRef = await page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return [];
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return [];
      const imgs = el.querySelectorAll('img');
      if (imgs.length > 0) {
        return [...imgs].map(img => ({
          alt: img.alt,
          displayWidth: img.getBoundingClientRect().width,
          complete: img.complete && img.naturalWidth > 0,
        }));
      }
    }
    return [];
  });
  console.log(`[6] 最终 prompt 上方图片: ${finalRef.length} 张`);
  finalRef.forEach(r => console.log(`  alt="${r.alt}" w=${r.displayWidth} complete=${r.complete}`));

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
