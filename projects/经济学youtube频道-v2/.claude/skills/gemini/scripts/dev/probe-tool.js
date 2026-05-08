/**
 * probe-tool: 检查工具按钮是否可点击
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

  const info = await page.evaluate(() => {
    const toolsBtn = document.querySelector('button[aria-label="工具"]');
    const toolsMenu = document.querySelector('button[aria-label="打开文件上传菜单"]');
    const sendBtn = document.querySelector('button[aria-label="发送"]');
    return {
      toolsBtnFound: !!toolsBtn,
      toolsBtnHTML: toolsBtn ? toolsBtn.outerHTML.slice(0, 200) : null,
      toolsBtnVisible: toolsBtn ? toolsBtn.offsetHeight > 0 : false,
      toolsBtnDisabled: toolsBtn ? toolsBtn.disabled : null,
      menuBtnFound: !!toolsMenu,
      sendBtnFound: !!sendBtn,
    };
  });
  console.log('[before submit]', JSON.stringify(info, null, 2));

  await human.type(page, S.COMPOSER, '画一只蓝色的鸟');
  await page.waitForTimeout(1000);
  await human.click(page, S.SUBMIT);
  await page.waitForTimeout(15000);

  const info2 = await page.evaluate(() => {
    const toolsBtn = document.querySelector('button[aria-label="工具"]');
    const sendBtn = document.querySelector('button[aria-label="发送"]');
    const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('aria-label')).filter(Boolean);
    return {
      toolsBtnFound: !!toolsBtn,
      toolsBtnVisible: toolsBtn ? toolsBtn.offsetHeight > 0 : false,
      toolsBtnDisabled: toolsBtn ? toolsBtn.disabled : null,
      sendBtnFound: !!sendBtn,
      sendBtnDisabled: sendBtn ? sendBtn.disabled : null,
      allBtnLabels: allBtns,
    };
  });
  console.log('[after submit + 15s]', JSON.stringify(info2, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
