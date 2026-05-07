/**
 * dev step-A: 打开主页 + 等输入框就绪
 * 验证：S.COMPOSER = 'div.ProseMirror[contenteditable="true"]' 能正常等待
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-a';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  // ── 段 A：等输入框就绪 ──
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });
  console.log('[step-A] COMPOSER visible');

  // probe: 确认 DOM 类型
  const info = await page.evaluate(() => {
    const el = document.querySelector('div[contenteditable="true"]');
    return {
      tag: el?.tagName,
      contenteditable: el?.getAttribute('contenteditable'),
      class: el?.className,
      placeholder: el?.getAttribute('data-placeholder'),
    };
  });
  console.log('[step-A] DOM:', JSON.stringify(info));

  await dev.hold('step-A done: composer ready');
}

main().catch(err => {
  console.error('[step-A]', err.message);
  process.exit(1);
});
