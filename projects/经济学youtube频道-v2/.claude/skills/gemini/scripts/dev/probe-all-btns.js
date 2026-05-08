/**
 * probe-all-btns: 打印页面上所有 button 的 aria-label
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
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      text: b.innerText?.trim().slice(0, 30),
      disabled: b.disabled,
      hidden: b.offsetHeight === 0,
    }));
  });

  console.log(JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
