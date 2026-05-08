/**
 * dev step-upload: 文件上传 + 提交 + 等回复完成
 * 验证：上传文件 + 提交 → Grok 能读取并回答
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-upload';
const TEST_FILE = 'D:/cc-project/web-skill-creator-cdp-3/temp-test-file.txt';
const PROMPT = 'Answer the question in the attached file.';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });

  // ── 上传文件 ──
  await human.uploadFile(page, TEST_FILE);
  await human.thinkPause(500, 1000); // 等 React 状态更新
  console.log('[step-upload] file uploaded:', TEST_FILE);

  // ── probe: 找 Submit 按钮 ──
  const submitInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns
      .filter(b => b.textContent.trim() === 'Submit')
      .map(b => ({
        text: b.textContent.trim(),
        aria: b.getAttribute('aria-label'),
        disabled: b.disabled,
      }));
  });
  console.log('[step-upload] submit buttons after upload:', JSON.stringify(submitInfo));

  // ── 输入 prompt ──
  await human.paste(page, S.COMPOSER, PROMPT);
  await human.thinkPause(300, 800);

  // ── 等 Submit 按钮出现（输入后才 enable）──
  const submitVisible = await page.waitForSelector('button[aria-label="Submit"]', { timeout: 8000 }).catch(() => null);
  if (submitVisible) {
    await human.click(page, 'button[aria-label="Submit"]');
    console.log('[step-upload] submitted via aria-label');
  } else {
    // fallback: 直接键盘 Enter
    console.log('[step-upload] no Submit button, trying Enter key');
    await page.keyboard.press('Enter');
  }

  // ── 等 URL 跳转 ──
  await page.waitForFunction(
    () => window.location.pathname.startsWith('/c/'),
    { timeout: 15000 },
  );
  const convId = page.url().match(/\/c\/([a-f0-9-]+)/)?.[1] || '';
  console.log('[step-upload] conversation_id:', convId);

  // ── 等回复完成 ──
  console.log('[step-upload] waiting for reply...');
  const done = page.waitForSelector(S.REPLY_DONE, { timeout: 120000 }).then(() => 'done');
  const antibot = page.waitForSelector(S.ANTIBOT, { timeout: 120000 }).then(() => 'antibot').catch(() => null);
  const raceResult = await Promise.race([done, antibot]);
  console.log('[step-upload] race result:', raceResult);
  await page.waitForTimeout(1500);

  // ── 提取 reply ──
  const extracted = await page.evaluate(() => {
    const likeBtns = Array.from(document.querySelectorAll('button[aria-label="Like"]'));
    const likeBtn = likeBtns[likeBtns.length - 1];
    if (!likeBtn) return { reply: '' };
    let el = likeBtn;
    for (let i = 0; i < 15; i++) {
      el = el.parentElement;
      if (!el) break;
      const bubble = el.querySelector(':scope > .message-bubble');
      if (bubble) {
        let text = (bubble.innerText || '').trim();
        text = text.replace(/^Thought for \d+s\s*/, '').trim();
        return { reply: text };
      }
    }
    return { reply: '' };
  });
  console.log('[step-upload] reply:', extracted.reply.slice(0, 200));

  await dev.hold(`step-upload done: conversation_id=${convId}`);
}

main().catch(err => {
  console.error('[step-upload]', err.message);
  process.exit(1);
});
