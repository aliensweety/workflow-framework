/**
 * step-16.js —— 补充：精确定位项目名称 textbox + 测试重命名
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const URL_TAG = 'step-16';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // 导航到刚创建的项目
  const projectId = 'da449a2c-7941-4f72-be2e-d2fce916a7ec';
  console.log('[1] 导航到项目...');
  await page.goto(`${BASE}/project/${projectId}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  await human.sleep(1000);

  // 找 navigation 下所有元素
  const navDetails = await page.evaluate(() => {
    const nav = document.querySelector('nav, [role="navigation"]');
    if (!nav) return 'no nav';
    // dump 所有子元素
    const children = nav.querySelectorAll('*');
    const items = [];
    for (const child of children) {
      const role = child.getAttribute('role');
      if (role === 'textbox' || child.tagName === 'INPUT' || child.tagName === 'TEXTAREA' || child.contentEditable === 'true') {
        items.push({
          tag: child.tagName,
          role,
          type: child.type,
          contentEditable: child.contentEditable,
          value: child.value,
          text: child.textContent?.trim().substring(0, 50),
          placeholder: child.placeholder,
          className: child.className?.substring(0, 80),
          ariaLabel: child.getAttribute('aria-label'),
          ariaRoleDescription: child.getAttribute('aria-roledescription'),
        });
      }
    }
    return items;
  });
  console.log('[1] 导航栏内可编辑元素:', JSON.stringify(navDetails, null, 2));

  // 试用 aria role 定位
  const textboxLocator = page.locator('nav [role="textbox"]');
  const textboxCount = await textboxLocator.count();
  console.log(`\n[2] nav [role="textbox"] 数量: ${textboxCount}`);

  if (textboxCount > 0) {
    // 看这个元素的标签
    const tag = await textboxLocator.first().evaluate(el => ({
      tag: el.tagName,
      contentEditable: el.contentEditable,
      text: el.textContent?.trim(),
      className: el.className?.substring(0, 80),
    }));
    console.log('[2] 元素信息:', JSON.stringify(tag));

    // 试用 Playwright 的 fill
    console.log('\n[3] 尝试重命名...');
    await textboxLocator.first().click({ force: true });
    await human.sleep(300);
    await page.keyboard.press('Control+a');
    await human.sleep(100);

    const newName = '测试项目-小浣熊';
    await page.evaluate((text) => navigator.clipboard.writeText(text), newName);
    await page.keyboard.press('Control+v');
    await human.sleep(500);

    // 按回车或点外面确认
    await page.keyboard.press('Enter');
    await human.sleep(1000);

    // 验证
    const afterText = await textboxLocator.first().textContent();
    console.log(`[3] 重命名后: "${afterText}"`);

    const title = await page.title();
    console.log(`[3] 页面 title: "${title}"`);
  } else {
    // 试用其他方式
    console.log('\n[2] 尝试其他定位方式...');
    const altLocator = page.locator('nav').locator('div[contenteditable]');
    const altCount = await altLocator.count();
    console.log(`[2] nav div[contenteditable] 数量: ${altCount}`);

    // 直接用 a11y role
    const ariaLocator = page.getByRole('textbox', { name: '可编辑文本' });
    const ariaCount = await ariaLocator.count();
    console.log(`[2] getByRole textbox "可编辑文本" 数量: ${ariaCount}`);

    if (ariaCount > 0) {
      const info = await ariaLocator.first().evaluate(el => ({
        tag: el.tagName,
        contentEditable: el.contentEditable,
        text: el.textContent?.trim(),
      }));
      console.log('[2] 元素信息:', JSON.stringify(info));

      console.log('\n[3] 重命名...');
      await ariaLocator.first().click();
      await human.sleep(300);
      await page.keyboard.press('Control+a');
      await human.sleep(100);

      const newName = '测试项目-小浣熊';
      await page.evaluate((text) => navigator.clipboard.writeText(text), newName);
      await page.keyboard.press('Control+v');
      await human.sleep(500);
      await page.keyboard.press('Enter');
      await human.sleep(1000);

      const afterText = await ariaLocator.first().textContent();
      console.log(`[3] 重命名后: "${afterText}"`);

      const title = await page.title();
      console.log(`[3] 页面 title: "${title}"`);
    }
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
