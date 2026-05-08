/**
 * probe-tool-real-v2: 找到工具按钮（输入区旁边那个）的真实 DOM
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
    // 找输入框容器
    const composer = document.querySelector('[aria-label="为 Gemini 输入提示"]');
    if (!composer) return { error: 'composer not found' };

    // 输入框附近的 buttons
    const container = composer.closest('form') || composer.parentElement;
    const allInContainer = container ? Array.from(container.querySelectorAll('button')) : [];
    const siblings = container ? Array.from(container.parentElement.querySelectorAll('button')) : [];

    // 找包含 img[alt="page_info"] 的 button
    const pageInfoBtn = Array.from(document.querySelectorAll('button')).find(b => {
      const imgs = b.querySelectorAll('img');
      return Array.from(imgs).some(img => img.getAttribute('alt') === 'page_info');
    });

    return {
      containerButtons: allInContainer.map(b => ({ ariaLabel: b.getAttribute('aria-label'), text: b.innerText?.trim().slice(0, 20) })),
      siblingButtons: siblings.map(b => ({ ariaLabel: b.getAttribute('aria-label'), text: b.innerText?.trim().slice(0, 20) })),
      pageInfoBtnFound: !!pageInfoBtn,
      pageInfoBtnAriaLabel: pageInfoBtn?.getAttribute('aria-label'),
      pageInfoBtnHTML: pageInfoBtn?.outerHTML?.slice(0, 300),
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
