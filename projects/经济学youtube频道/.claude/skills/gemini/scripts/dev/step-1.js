/**
 * step-1: 打开 Gemini 主页，验证输入区就绪
 * 验证：.ql-editor 是否可交互
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const probe = require('../lib/probe');

const URL_TAG = 'gemini-dev-step1';

(async () => {
  const { context } = await connectBrowser();

  // 清理本 skill 之前残留的 dev tab
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

  // 等待输入框出现
  await page.waitForSelector('.ql-editor', { timeout: 10000 });

  // probe 看一下真实 DOM 结构
  const inputInfo = await page.evaluate(() => {
    const el = document.querySelector('.ql-editor');
    if (!el) return 'NOT FOUND';
    return {
      tag: el.tagName,
      className: el.className,
      contenteditable: el.getAttribute('contenteditable'),
      id: el.id,
      ariaLabel: el.getAttribute('aria-label'),
      parentClass: el.parentElement?.className,
      grandparentClass: el.parentElement?.parentElement?.className,
    };
  });
  console.log('[probe] .ql-editor:', JSON.stringify(inputInfo));

  // 看输入框旁边的按钮
  const buttons = await page.evaluate(() => {
    const allBtns = Array.from(document.querySelectorAll('button'));
    return allBtns.map(b => ({
      ariaLabel: b.getAttribute('aria-label'),
      text: b.innerText?.trim().slice(0, 20),
      disabled: b.disabled,
    }));
  });
  console.log('[probe] buttons:', JSON.stringify(buttons, null, 2));

  await dev.hold('step-1: gemini page loaded, .ql-editor ready for input');
})().catch(e => { console.error(e); process.exit(1); });
