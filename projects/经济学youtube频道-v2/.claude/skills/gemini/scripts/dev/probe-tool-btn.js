/**
 * probe-tool-real: 找到工具按钮的真实 DOM 属性
 */
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');

(async () => {
  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  const info = await page.evaluate(() => {
    // 找所有包含"工具"文字的 button
    const allBtns = Array.from(document.querySelectorAll('button'));
    const toolBtns = allBtns.filter(b => {
      const txt = b.innerText || '';
      const aria = b.getAttribute('aria-label') || '';
      return txt.includes('工具') || aria.includes('工具');
    });

    // 也找 page-info 图标的 button
    const pageInfoBtns = allBtns.filter(b => {
      const imgs = b.querySelectorAll('img, svg');
      return Array.from(imgs).some(img => {
        const src = img.src || '';
        const alt = img.getAttribute('alt') || '';
        return src.includes('page_info') || alt.includes('page_info');
      });
    });

    return {
      toolBtns: toolBtns.map(b => ({ ariaLabel: b.getAttribute('aria-label'), text: b.innerText?.trim().slice(0, 30), html: b.outerHTML.slice(0, 200) })),
      pageInfoBtns: pageInfoBtns.map(b => ({ ariaLabel: b.getAttribute('aria-label'), text: b.innerText?.trim().slice(0, 30) })),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
