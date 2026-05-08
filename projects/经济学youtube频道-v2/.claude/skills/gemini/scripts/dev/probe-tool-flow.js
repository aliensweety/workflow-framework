/**
 * probe-tool-flow: 测试工具菜单打开和选项点击
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-toolflow';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);
  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  await human.type(page, S.COMPOSER, '画一只蓝色的猫');
  await page.waitForTimeout(500);

  // 点击工具按钮
  console.log('[1] clicking tools button...');
  await human.click(page, S.TOOLS_MENU);
  await page.waitForTimeout(1000);

  // probe 看菜单状态
  const menuInfo1 = await page.evaluate(() => {
    const menus = document.querySelectorAll('[role="menu"], menu');
    return {
      menuCount: menus.length,
      items: Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).map(el => ({
        text: el.innerText?.replace(/\n/g, '|'),
        checked: el.getAttribute('aria-checked'),
      })),
    };
  });
  console.log('[2] menu state:', JSON.stringify(menuInfo1, null, 2));

  // 点击"制作图片"
  console.log('[3] clicking 制作图片...');
  try {
    await human.click(page, S.TOOL_OPTION('制作图片'));
    console.log('[3] click succeeded');
  } catch (e) {
    console.log('[3] click failed:', e.message.slice(0, 100));
  }

  await page.waitForTimeout(500);

  const menuInfo2 = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[role="menuitemcheckbox"]')).map(el => ({
      text: el.innerText?.replace(/\n/g, '|'),
      checked: el.getAttribute('aria-checked'),
    }));
  });
  console.log('[4] menu after click:', JSON.stringify(menuInfo2, null, 2));

  await dev.hold('tool flow debug');
})().catch(e => { console.error(e); process.exit(1); });
