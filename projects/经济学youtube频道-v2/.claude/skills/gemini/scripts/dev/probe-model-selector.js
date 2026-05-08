/**
 * probe-model-selector: 找模型选项的正确 selector
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

  await human.click(page, S.MODEL_SELECTOR);
  await page.waitForTimeout(500);

  const info = await page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    if (!menu) return { error: 'no menu' };
    const items = Array.from(menu.querySelectorAll('*')).filter(el => {
      const role = el.getAttribute('role');
      return role === 'menuitem' || role === 'menuitemcheckbox';
    });
    return {
      roleMenuitem: items.filter(el => el.getAttribute('role') === 'menuitem').length,
      roleMenuitemcheckbox: items.filter(el => el.getAttribute('role') === 'menuitemcheckbox').length,
      allMenuText: Array.from(menu.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')).map(el => ({
        role: el.getAttribute('role'),
        text: el.innerText?.replace(/\n/g, '|'),
      })),
    };
  });

  console.log(JSON.stringify(info, null, 2));

  // 尝试不同 selector
  const strategies = [
    { name: 'role=menuitem has-text 思考', sel: '[role="menuitem"]:has-text("思考")' },
    { name: 'getByRole menuitem + text', sel: 'menuitem:has-text("思考")' },
    { name: 'textContent match', sel: '[role="menuitem"]' },
  ];

  for (const s of strategies) {
    try {
      const count = await page.locator(s.sel).count();
      console.log(`[${s.name}] count=${count}`);
    } catch (e) {
      console.log(`[${s.name}] error: ${e.message.slice(0, 50)}`);
    }
  }

  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
