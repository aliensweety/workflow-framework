/**
 * dev step-C: 打开主页 + 输入 prompt + 提交 + 等 URL 跳转到 /c/{id}
 * 验证：提交按钮点击后 URL 正确跳转（conversation 创建成功）
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-c';

const TEST_PROMPT = '1+1=? reply in one word';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  // ── 段 A + B：等输入框 + 输入 ──
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });
  await human.type(page, S.COMPOSER, TEST_PROMPT);
  await human.thinkPause(300, 800);

  // ── 段 C：提交 + 等 URL 跳转 ──
  await page.waitForSelector(S.SUBMIT_ENABLED, { timeout: 5000 });
  await human.click(page, S.SUBMIT);
  console.log('[step-C] submitted');

  await page.waitForFunction(
    () => window.location.pathname.startsWith('/c/'),
    { timeout: 15000 },
  );
  const url = page.url();
  console.log('[step-C] URL:', url);

  await dev.hold('step-C done: conversation created, URL jumped to /c/');
}

main().catch(err => {
  console.error('[step-C]', err.message);
  process.exit(1);
});
