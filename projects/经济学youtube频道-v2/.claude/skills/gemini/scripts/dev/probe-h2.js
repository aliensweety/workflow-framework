/**
 * probe-reply-v2
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const S = require('../lib/signals');

(async () => {
  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  await human.type(page, S.COMPOSER, '今天心情很好');
  await page.waitForTimeout(1000);
  await human.click(page, S.SUBMIT);
  await page.waitForTimeout(10000);

  const info = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(el => el.textContent.trim() === 'Gemini 说');
    console.log('[probe] total h2s:', h2s.length);
    console.log('[probe] gemini h2s:', geminiH2s.length);
    if (geminiH2s.length > 0) {
      const last = geminiH2s[geminiH2s.length - 1];
      const parent = last.parentElement;
      const container = parent ? parent.nextElementSibling : null;
      console.log('[probe] parent tag:', parent?.tagName, 'class:', parent?.className);
      console.log('[probe] container tag:', container?.tagName, 'class:', container?.className);
      console.log('[probe] container text:', container?.innerText?.slice(0, 300));
      console.log('[probe] paragraphs:', container?.querySelectorAll('p').length);
    }
    return {
      h2texts: h2s.map(h => h.textContent.trim()).filter(Boolean),
    };
  });
  console.log('[result]', JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
