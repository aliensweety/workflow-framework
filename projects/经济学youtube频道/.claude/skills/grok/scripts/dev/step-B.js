/**
 * dev step-B: 打开主页 + 等输入框 + 输入 prompt
 * 验证：human.type 逐字输入正常，提交按钮 enabled
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-b';

const TEST_PROMPT = '1+1=? reply in one word';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  // ── 段 A：等输入框就绪 ──
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });

  // ── 段 B：输入 prompt（逐字）──
  await human.type(page, S.COMPOSER, TEST_PROMPT);
  console.log('[step-B] typed:', TEST_PROMPT);
  await human.thinkPause(300, 800);

  // 验证提交按钮 enabled
  const enabled = await page.locator(S.SUBMIT_ENABLED).isVisible().catch(() => false);
  console.log('[step-B] SUBMIT enabled:', enabled);

  await dev.hold('step-B done: prompt typed, submit ready');
}

main().catch(err => {
  console.error('[step-B]', err.message);
  process.exit(1);
});
