/**
 * probe-shadow: 用 Playwright locator 找 shadow DOM 里的按钮
 */
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');

(async () => {
  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  // 尝试各种 locator 策略找工具按钮
  const strategies = [
    { name: 'aria-label 工具', sel: 'button[aria-label="工具"]' },
    { name: 'aria-label 打开文件上传', sel: 'button[aria-label="打开文件上传菜单"]' },
    { name: 'aria-label 打开模式选择器', sel: 'button[aria-label="打开模式选择器"]' },
    { name: 'text 工具', sel: 'button:has-text("工具")' },
    { name: 'img alt add_2', sel: 'img[alt="add_2"]' },
    { name: 'img alt page_info', sel: 'img[alt="page_info"]' },
    { name: 'role=button + aria-label containing 工具', sel: 'button[aria-label*="具"]' },
  ];

  for (const s of strategies) {
    try {
      const count = await page.locator(s.sel).count();
      const visible = count > 0 ? await page.locator(s.sel).first().isVisible().catch(() => 'error') : false;
      console.log(`[${s.name}] count=${count}, visible=${visible}`);
    } catch (e) {
      console.log(`[${s.name}] error: ${e.message.slice(0, 50)}`);
    }
  }

  // 找 shadow DOM 里的按钮 - 用evaluate 找 shadow root
  const shadowInfo = await page.evaluate(() => {
    // 找所有 shadow root
    function findShadowRoots(el, path = '') {
      const results = [];
      if (el.shadowRoot) {
        results.push({ path, found: true });
        const buttons = el.shadowRoot.querySelectorAll('button');
        results.push(...Array.from(buttons).map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.innerText?.trim().slice(0, 20),
        })));
      }
      for (const child of el.children || []) {
        results.push(...findShadowRoots(child, path + '>' + child.tagName));
      }
      return results;
    }
    return findShadowRoots(document.body, 'body');
  });
  console.log('[shadow roots]', JSON.stringify(shadowInfo, null, 2));

  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
