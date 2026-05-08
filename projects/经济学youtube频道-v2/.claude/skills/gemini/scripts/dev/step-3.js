/**
 * step-3: 验证模型切换（fast → think → pro）
 * 接 step-2 的页面，打开模型选择器，选 think
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-step3';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  // 点击模型选择器
  await human.click(page, S.MODEL_SELECTOR);
  await page.waitForTimeout(500);

  // probe 看菜单里的选项
  const menuInfo = await page.evaluate(() => {
    const menu = document.querySelector('[role="menu"]');
    if (!menu) return { error: 'no menu found' };
    const items = Array.from(menu.querySelectorAll('[role="menuitem"]'));
    return items.map(el => ({
      text: el.innerText?.trim().slice(0, 50),
      ariaLabel: el.getAttribute('aria-label'),
    }));
  });
  console.log('[probe] model menu items:', JSON.stringify(menuInfo, null, 2));

  // 等 MCP 确认
  await dev.hold('step-3: model selector opened, menu items visible');
})().catch(e => { console.error(e); process.exit(1); });
