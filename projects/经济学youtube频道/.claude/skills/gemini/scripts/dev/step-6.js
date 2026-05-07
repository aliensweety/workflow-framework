/**
 * step-6: 在 step-5 的 page 上继续，发第二条消息，验证最后一条回复定位
 * 注意：step-5 kill 后，page 保留在 Chrome 里，可以直接继续
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

(async () => {
  const { context } = await connectBrowser();
  // 不开新 page，复用 context 里的 tab

  // 找到 gemini-dev 的 page（URL 里有 b8085213ab7bc18b）
  const pages = context.pages();
  const targetPage = pages.find(p => p.url().includes('b8085213ab7bc18b'));
  if (!targetPage) {
    console.error('[step-6] target page not found');
    process.exit(1);
  }

  await targetPage.bringToFront();

  // 此时 send button 应该 disabled，等它 enabled
  console.log('[step-6] waiting for send button to be enabled...');
  try {
    await targetPage.waitForFunction(
      () => {
        const btn = document.querySelector('button[aria-label="发送"]');
        return btn && !btn.disabled;
      },
      { timeout: 10000 }
    );
    console.log('[step-6] send button now enabled');
  } catch {
    console.log('[step-6] send button still disabled, trying anyway...');
  }

  // 看一下现在有几条 "Gemini 说" h2
  const h2CountBefore = await targetPage.evaluate(() => {
    return Array.from(document.querySelectorAll('h2')).filter(h => h.textContent.trim() === 'Gemini 说').length;
  });
  console.log('[step-6] h2 count before 2nd message:', h2CountBefore);

  // 发第二条
  await human.type(targetPage, S.COMPOSER, '那2+2呢？');
  await targetPage.waitForTimeout(500);
  await human.click(targetPage, S.SUBMIT);
  console.log('[step-6] second message sent');

  // 等回复完成：按钮重新 enabled
  await targetPage.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      if (!btn || btn.disabled) return false;
      const h2s = Array.from(document.querySelectorAll('h2'));
      const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
      return geminiH2s.length >= 2; // 至少两条消息
    },
    { timeout: 30000 }
  );
  console.log('[step-6] second reply done');

  // 提取所有 "Gemini 说" h2 的 innerText，验证最后一条是第2条
  const allReplies = await targetPage.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
    return geminiH2s.map((h2, i) => {
      const container = h2.parentElement;
      return { index: i, text: container.innerText.slice(0, 80) };
    });
  });
  console.log('[step-6] all replies:', JSON.stringify(allReplies, null, 2));

  await dev.hold('step-6: two replies verified');
})().catch(e => { console.error(e); process.exit(1); });
