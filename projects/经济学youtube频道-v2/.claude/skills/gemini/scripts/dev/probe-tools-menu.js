/**
 * probe-tools-menu: 检查工具下拉菜单里的选项
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

  await human.type(page, S.COMPOSER, '测试工具菜单');
  await page.waitForTimeout(500);

  // 点击工具按钮
  await human.click(page, S.TOOLS_MENU);
  await page.waitForTimeout(1000);

  const menuInfo = await page.evaluate(() => {
    const menus = Array.from(document.querySelectorAll('menuitemcheckbox, [role="menuitemcheckbox"], [role="menu"]'));
    const allMenuItems = Array.from(document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]'));
    return {
      menuCount: menus.length,
      menuItems: allMenuItems.map(el => ({
        role: el.getAttribute('role'),
        text: el.innerText?.trim().slice(0, 50),
        ariaLabel: el.getAttribute('aria-label'),
        checked: el.getAttribute('aria-checked'),
      })),
    };
  });

  console.log(JSON.stringify(menuInfo, null, 2));

  // 尝试点击 Deep Research
  try {
    await human.click(page, S.TOOL_OPTION('Deep Research'));
    console.log('[clicked Deep Research]');
  } catch (e) {
    console.log('[click Deep Research error]', e.message.slice(0, 100));
  }

  await page.waitForTimeout(500);
  const afterClick = await page.evaluate(() => {
    const checked = Array.from(document.querySelectorAll('[aria-checked="true"]'));
    return checked.map(el => ({ role: el.getAttribute('role'), text: el.innerText?.trim().slice(0, 30) }));
  });
  console.log('[checked after]', JSON.stringify(afterClick, null, 2));

  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
