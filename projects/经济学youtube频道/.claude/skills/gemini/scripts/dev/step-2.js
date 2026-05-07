/**
 * step-2: 输入 prompt，发送，等待回复完成
 * 验证：发送按钮 disabled → enabled 变化，回复出现
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-step2';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForSelector('.ql-editor', { timeout: 10000 });

  // 输入 prompt（用 human.type 逐字）
  await human.type(page, S.COMPOSER, '今天北京天气怎么样？');
  await human.thinkPause(500);

  // 确认输入框有内容
  const inputText = await page.locator(S.COMPOSER).innerText();
  console.log('[step-2] input text:', inputText);

  // 等发送按钮变为 enabled
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      return btn && !btn.disabled;
    },
    { timeout: 5000 }
  );
  console.log('[step-2] send button enabled');

  // 点击发送
  await human.click(page, S.SUBMIT);
  console.log('[step-2] submitted');

  // 等回复出现 - 找 heading "Gemini 说"
  try {
    await page.waitForSelector('heading[aria-level="2"]:has-text("Gemini 说")', { timeout: 30000 });
    console.log('[step-2] Gemini reply appeared');

    // 抓回复文字
    const replyText = await page.locator('heading[aria-level="2"]:has-text("Gemini 说")').locator('..').locator('paragraph').first().innerText().catch(() => 'N/A');
    console.log('[step-2] reply text:', replyText);

    // 看 URL 里的 conversation_id
    const url = page.url();
    const match = url.match(/\/app\/([a-z0-9]+)/);
    console.log('[step-2] conversation_id:', match ? match[1] : 'none');
  } catch (e) {
    console.error('[step-2] wait reply error:', e.message);
  }

  await dev.hold('step-2: prompt sent, reply received');
})().catch(e => { console.error(e); process.exit(1); });
