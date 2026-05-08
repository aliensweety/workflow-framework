/**
 * dev step-D: 完整流程跑通 + 等回复完成（双路等待）
 * 验证：
 *   - Promise.race 双路等待正常（REPLY_DONE / ANTIBOT / RATE_LIMIT）
 *   - Like 按钮出现即回复完成
 *   - 回复内容提取逻辑
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const probe = require('../lib/probe');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-d';

const TEST_PROMPT = '1+1=? reply in one word';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  // ── 段 A + B：输入 prompt ──
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });
  await human.type(page, S.COMPOSER, TEST_PROMPT);
  await human.thinkPause(300, 800);

  // ── 段 C：提交 ──
  await page.waitForSelector(S.SUBMIT_ENABLED, { timeout: 5000 });
  await human.click(page, S.SUBMIT);
  console.log('[step-D] submitted');

  // ── 段 D：等 URL 跳转 ──
  await page.waitForFunction(
    () => window.location.pathname.startsWith('/c/'),
    { timeout: 15000 },
  );
  console.log('[step-D] URL:', page.url());

  // ── 段 E：等回复完成（双路 race）──
  console.log('[step-D] waiting for reply...');
  const start = Date.now();

  const done = page.waitForSelector(S.REPLY_DONE, { timeout: 120000 }).then(() => 'done');
  const antibot = page.waitForSelector(S.ANTIBOT, { timeout: 120000 }).then(() => 'antibot').catch(() => null);
  const rateLimit = page.waitForSelector(S.RATE_LIMIT, { timeout: 120000 }).then(() => 'rate-limit').catch(() => null);

  const raceResult = await Promise.race([done, antibot, rateLimit]);
  console.log(`[step-D] race result: ${raceResult} (${Date.now() - start}ms)`);

  if (raceResult === 'antibot') {
    console.error('[step-D] AntiBot detected!');
    await dev.hold('step-D: AntiBot triggered');
    return;
  }
  if (raceResult === 'rate-limit') {
    console.error('[step-D] Rate limit!');
    await dev.hold('step-D: Rate limit triggered');
    return;
  }

  // 回复完成后等 DOM 稳定
  await page.waitForTimeout(1500);

  // ── 段 F：提取回复 ──
  const convId = page.url().match(/\/c\/([a-f0-9-]+)/)?.[1] || '';
  const extracted = await page.evaluate(() => {
    const likeBtns = Array.from(document.querySelectorAll('button[aria-label="Like"]'));
    const likeBtn = likeBtns[likeBtns.length - 1];
    if (!likeBtn) return { reply: '', method: 'no like btn' };

    let el = likeBtn;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) break;
      const bubble = el.querySelector('.message-bubble');
      if (bubble) {
        let text = (bubble.innerText || '').trim();
        text = text.replace(/^Thought for \d+s\s*/, '').trim();
        return { reply: text, parents: i, method: 'bubble' };
      }
    }
    return { reply: '', method: 'not found' };
  });

  console.log('[step-D] extracted:', JSON.stringify(extracted, null, 2));
  console.log('[step-D] conversation_id:', convId);

  // probe: dump 周围结构
  await probe.dumpAround(page, 'button[aria-label="Like"]');

  await dev.hold(`step-D done: reply="${extracted.reply.slice(0, 50)}..."`);
}

main().catch(err => {
  console.error('[step-D]', err.message);
  process.exit(1);
});
