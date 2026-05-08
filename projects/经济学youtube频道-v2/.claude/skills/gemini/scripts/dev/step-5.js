/**
 * step-5: 验证多消息场景——连续发两条，确认最后一条回复的定位
 * 正确姿势：同一个 page，dev.hold() 挂住，MCP 验证
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-step5';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);
  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  console.log('[step-5] page loaded');

  // ── 第一条消息 ──
  await human.type(page, S.COMPOSER, '1+1等于几？');
  await page.waitForFunction(() => !document.querySelector('button[aria-label="发送"]').disabled, { timeout: 5000 });
  await human.click(page, S.SUBMIT);
  console.log('[step-5] first message sent');

  // 等第一条回复完成
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      if (!btn || btn.disabled) return false;
      const h2s = Array.from(document.querySelectorAll('h2'));
      const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
      if (geminiH2s.length === 0) return false;
      const lastH2 = geminiH2s[geminiH2s.length - 1];
      const container = lastH2.parentElement;
      return container && container.innerText.trim().length > 10;
    },
    { timeout: 30000 }
  );

  // 抓第一条回复
  const reply1 = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
    const lastH2 = geminiH2s[geminiH2s.length - 1];
    return lastH2.parentElement.innerText.slice(0, 100);
  });
  console.log('[step-5] reply1:', reply1);

  // ── 挂住，等 MCP 确认第一条回复 ──
  await dev.hold('step-5: first reply ready, checking h2 count');
})().catch(e => { console.error(e); process.exit(1); });
