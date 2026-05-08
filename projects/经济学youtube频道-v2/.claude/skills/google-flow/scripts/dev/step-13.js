/**
 * step-13.js —— 测试粘贴输入是否触发反爬
 * 用 clipboard API + Ctrl+V 粘贴 prompt
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-13';

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

  // 用 clipboard API 粘贴
  const promptText = 'a fluffy orange cat sleeping on a pile of books in a sunlit room';
  console.log(`[2] 粘贴 prompt: "${promptText}"`);

  await page.evaluate(() => {
    document.querySelector('[contenteditable="true"]')?.focus();
  });
  await human.sleep(300);

  // 方式: 通过 evaluate 写入剪贴板，然后 Ctrl+V
  await page.evaluate((text) => {
    navigator.clipboard.writeText(text);
  }, promptText);
  await human.sleep(200);

  await page.keyboard.press('Control+v');
  await human.sleep(1000);

  // 验证输入是否成功
  const inputText = await page.evaluate(() => {
    return document.querySelector('[contenteditable="true"]')?.textContent?.trim();
  });
  console.log(`[2] 输入框内容: "${inputText}"`);

  const match = inputText === promptText;
  console.log(`[2] 匹配: ${match}`);

  if (match) {
    // 提交看看会不会被拦
    console.log('[3] 提交...');
    await page.locator('button:has-text("arrow_forward")').first().click({ force: true });
    await human.sleep(5000);

    // 看有没有 unusual activity / 失败
    const hasError = await page.evaluate(() => {
      const tiles = document.querySelectorAll('[data-tile-id]');
      for (const tile of tiles) {
        if (tile.textContent?.includes('失败') || tile.textContent?.includes('unusual activity')) {
          return tile.textContent?.trim().substring(0, 100);
        }
      }
      return null;
    });

    if (hasError) {
      console.log(`[3] 被拦截: ${hasError}`);
    } else {
      console.log('[3] 未被拦截，生成中...');
    }
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
