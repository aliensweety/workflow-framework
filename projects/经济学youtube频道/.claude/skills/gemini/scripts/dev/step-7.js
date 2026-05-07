/**
 * step-7: 测试 conversation_id 恢复已有对话
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const CONV_ID = 'b8085213ab7bc18b'; // step-6 的对话

(async () => {
  const { context } = await connectBrowser();

  // 新开一个 page，直接 goto conversation_id
  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app/${CONV_ID}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  console.log('[step-7] loaded conversation:', CONV_ID);

  // 确认页面显示的是历史对话（应该有旧消息）
  const h2Count = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).filter(h => h.textContent.trim() === 'Gemini 说').length;
  });
  console.log('[step-7] h2 count (should be >= 2):', h2Count);

  // 发一条新消息
  await human.type(page, S.COMPOSER, '那3+3呢？');
  await page.waitForTimeout(500);
  await human.click(page, S.SUBMIT);
  console.log('[step-7] new message sent');

  // 等回复
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      if (!btn || btn.disabled) return false;
      const h2s = Array.from(document.querySelectorAll('h2'));
      const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
      return geminiH2s.length >= 3;
    },
    { timeout: 30000 }
  );

  const url = page.url();
  const newMatch = url.match(/\/app\/([a-z0-9]+)/);
  console.log('[step-7] URL after sending:', url);
  console.log('[step-7] conversation_id changed?', newMatch ? newMatch[1] !== CONV_ID : 'no match');

  const allReplies = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
    return geminiH2s.map((h2, i) => {
      const container = h2.parentElement;
      return { index: i, text: container.innerText.slice(0, 60) };
    });
  });
  console.log('[step-7] all replies:', JSON.stringify(allReplies, null, 2));

  await dev.hold('step-7: conversation_id recovery test done');
})().catch(e => { console.error(e); process.exit(1); });
