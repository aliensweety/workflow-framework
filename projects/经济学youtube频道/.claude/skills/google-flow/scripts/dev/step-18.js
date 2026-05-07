/**
 * step-18.js —— 测试多图选择：选两张图到 prompt 上方
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = 'fdcb30f4-431e-4790-abb7-b9f649e3e707';
const URL_TAG = 'step-18';

/**
 * 在弹窗中搜索并点选一张图片
 */
async function searchAndSelect(page, keyword) {
  const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
  await searchInput.first().click({ force: true });
  await human.sleep(200);
  await page.evaluate((text) => navigator.clipboard.writeText(text), keyword);
  await page.keyboard.press('Control+v');
  await human.sleep(2000);

  const imgs = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    return [...dialog.querySelectorAll('img')]
      .filter(img => img.alt !== '搜索结果预览' && img.getBoundingClientRect().width > 0)
      .map(img => ({ alt: img.alt, rect: img.getBoundingClientRect() }));
  });

  if (imgs.length === 0) {
    console.log(`  搜索 "${keyword}" 无结果`);
    return false;
  }

  // 点第一张
  const target = imgs[0];
  console.log(`  搜索 "${keyword}" → 点选: ${target.alt}`);
  await page.mouse.click(Math.round(target.rect.x + target.rect.width / 2), Math.round(target.rect.y + target.rect.height / 2));
  await human.sleep(1500);
  return true;
}

/**
 * 检查 prompt 上方有多少张参考图
 */
async function countRefImages(page) {
  return page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return 0;
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return 0;
      const imgs = el.querySelectorAll('img');
      // 统计参考图缩略图（不是用户头像，不是生成的图片）
      let count = 0;
      for (const img of imgs) {
        if (img.alt === '由您生成或上传的媒体内容都收录在集合中。') {
          count++;
        }
      }
      if (count > 0) return count;
    }
    return 0;
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
  console.log('[1] 加载完成');

  // ===== 选择第1张：小浣熊 =====
  console.log('\n[2] 选择第1张：小浣熊...');
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(500);

  await searchAndSelect(page, '小浣熊');

  const count1 = await countRefImages(page);
  console.log(`[2] prompt 上方参考图数量: ${count1}`);

  const dialogAfter1 = await page.locator('[role="dialog"]').count();
  console.log(`[2] 弹窗是否关闭: ${dialogAfter1 === 0}`);

  // ===== 选择第2张：比奇堡 =====
  console.log('\n[3] 选择第2张：比奇堡...');
  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
  await human.sleep(500);

  await searchAndSelect(page, '比奇堡');

  const count2 = await countRefImages(page);
  console.log(`[3] prompt 上方参考图数量: ${count2}`);

  const dialogAfter2 = await page.locator('[role="dialog"]').count();
  console.log(`[3] 弹窗是否关闭: ${dialogAfter2 === 0}`);

  // ===== 输入 prompt =====
  console.log('\n[4] 输入 prompt...');
  await page.evaluate(() => document.querySelector('[contenteditable="true"]')?.focus());
  await human.sleep(200);
  await page.evaluate(() => navigator.clipboard.writeText('a felt raccoon and a sponge with pants sitting at a desk reading books together'));
  await page.keyboard.press('Control+v');
  await human.sleep(500);

  const promptText = await page.evaluate(() => document.querySelector('[contenteditable="true"]')?.textContent?.trim());
  console.log(`[4] prompt: "${promptText?.substring(0, 60)}"`);

  // 最终确认
  const finalCount = await countRefImages(page);
  console.log(`\n[5] 最终参考图数量: ${finalCount}`);
  console.log(`[5] prompt 长度: ${promptText?.length}`);

  if (finalCount >= 2) {
    console.log('\n✅ 多图选择测试成功！');
  } else {
    console.log('\n❌ 多图选择异常，参考图数量不足');
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
