/**
 * step-4.js —— 探索搜索+选中已有图片作为参考图
 * 段 1: 导航到项目
 * 段 2: 打开弹窗 → 搜索 "cat" → 看筛选结果
 * 段 3: 点击一张搜索到的图片 → 选中作为参考
 * 段 4: 确认图片出现在 prompt 上方
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-4';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // ── 段 1: 导航 ──
  console.log('[段1] 导航到项目...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[段1] 页面加载完成');

  // ── 段 2: 打开弹窗并搜索 ──
  console.log('[段2] 点击 add_2...');
  await human.sleep(1000);
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await human.sleep(1500);

  // 确认弹窗打开
  const dialogBefore = await page.locator('[role="dialog"]').count();
  console.log(`[段2] 弹窗打开: ${dialogBefore > 0}`);

  // 找到搜索框并输入 "cat"
  console.log('[段2] 在搜索框输入 "cat"...');
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  const searchCount = await searchInput.count();
  console.log(`[段2] 搜索框数量: ${searchCount}`);

  if (searchCount > 0) {
    await searchInput.first().click();
    await human.thinkPause();
    for (const ch of 'cat') {
      await page.keyboard.type(ch, { delay: 60 + Math.random() * 80 });
    }
    await human.sleep(2000);

    // 看搜索结果
    const dialogA11y = await page.locator('[role="dialog"]').first().ariaSnapshot();
    console.log('[段2] 搜索 "cat" 后弹窗 a11y:\n', dialogA11y);

    // 搜索后的图片数量
    const imgCount = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return 0;
      return dialog.querySelectorAll('img').length;
    });
    console.log(`[段2] 搜索后弹窗内图片数: ${imgCount}`);

    // ── 段 3: 点击搜索到的图片选中 ──
    console.log('[段3] 点击搜索结果中的第一张图片...');
    // 获取弹窗内可点击的图片元素信息
    const clickableImgs = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      // 找所有图片容器（通常图片被包在可点击的容器中）
      const imgs = dialog.querySelectorAll('img');
      const results = [];
      for (const img of imgs) {
        if (img.alt === '搜索结果预览') continue; // 跳过预览图
        const rect = img.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          results.push({
            alt: img.alt?.substring(0, 60),
            src: img.src.substring(0, 100),
            width: rect.width,
            height: rect.height,
            x: rect.x,
            y: rect.y,
            clickable: img.closest('button, a, [role="button"], [role="option"], [tabindex]') !== null,
            parentTag: img.parentElement?.tagName,
            parentClass: img.parentElement?.className?.substring(0, 80),
            grandParentTag: img.parentElement?.parentElement?.tagName,
            grandParentClass: img.parentElement?.parentElement?.className?.substring(0, 80),
          });
        }
      }
      return results;
    });
    console.log(`[段3] 可见图片 (${clickableImgs.length}):`, JSON.stringify(clickableImgs.slice(0, 5), null, 2));

    // 点击第一张可见图片（不是搜索预览）
    if (clickableImgs.length > 0) {
      const target = clickableImgs[0];
      console.log(`[段3] 点击: alt="${target.alt}" at (${target.x}, ${target.y})`);

      // 尝试点击图片本身
      await page.mouse.click(
        Math.round(target.x + target.width / 2),
        Math.round(target.y + target.height / 2)
      );
      await human.sleep(2000);

      // ── 段 4: 确认选中状态 ──
      console.log('[段4] 检查选中状态...');

      // 弹窗是否关闭了？
      const dialogAfter = await page.locator('[role="dialog"]').count();
      console.log(`[段4] 弹窗关闭: ${dialogAfter === 0}`);

      // prompt 上方有没有参考图
      const refImgInfo = await page.evaluate(() => {
        const editable = document.querySelector('[contenteditable="true"]');
        if (!editable) return 'no editable';
        let el = editable;
        for (let i = 0; i < 10; i++) {
          el = el.parentElement;
          if (!el) return `no parent at level ${i}`;
          const imgs = el.querySelectorAll('img');
          if (imgs.length > 0) {
            return {
              level: i + 1,
              tag: el.tagName,
              className: el.className?.substring(0, 100),
              imgCount: imgs.length,
              imgAlts: [...imgs].map(img => img.alt?.substring(0, 60)),
              imgSrcs: [...imgs].map(img => img.src.substring(0, 100)),
            };
          }
        }
        return 'no img in 10 levels';
      });
      console.log('[段4] 参考图状态:', JSON.stringify(refImgInfo, null, 2));

      // 如果弹窗没关，看弹窗当前状态
      if (dialogAfter > 0) {
        const dialogA11yAfter = await page.locator('[role="dialog"]').first().ariaSnapshot();
        console.log('[段4] 弹窗仍开着，当前 a11y:\n', dialogA11yAfter);

        // 可能需要双击？或者有确认按钮？
        const dialogBtns = await page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          if (!dialog) return [];
          const btns = dialog.querySelectorAll('button');
          return [...btns].map(b => b.textContent?.trim().substring(0, 60));
        });
        console.log('[段4] 弹窗按钮:', dialogBtns);
      }
    } else {
      console.log('[段3] 没有可点击的图片');
    }
  } else {
    console.log('[段2] 没找到搜索框');
  }

  // 挂住
  await dev.hold();
}

main().catch(err => {
  console.error('[step-4 ERROR]', err.message);
  process.exit(1);
});
