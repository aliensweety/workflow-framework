/**
 * step-4: 切换到 think 模型，发一个复杂问题
 * 接 step-3 验证过的模型菜单 selector
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-step4';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  // 切换到 think 模型
  await human.click(page, S.MODEL_SELECTOR);
  await page.waitForTimeout(300);
  await human.click(page, S.MODEL_OPTION('思考'));
  await page.waitForTimeout(500);

  // 确认模型已切换
  const modelText = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="打开模式选择器"]');
    if (!btn) return 'not found';
    const inner = btn.querySelector('[class*="model"], [class*="Mode"]');
    return btn.innerText?.trim() || 'empty';
  });
  console.log('[step-4] current model text:', modelText);

  // 输入 prompt
  await human.type(page, S.COMPOSER, '为什么天空是蓝色的？');
  await page.waitForFunction(
    () => !document.querySelector('button[aria-label="发送"]').disabled,
    { timeout: 5000 }
  );
  await human.click(page, S.SUBMIT);
  console.log('[step-4] submitted');

  // 等回复
  await page.waitForFunction(
    () => !document.querySelector('button[aria-label="发送"]').disabled,
    { timeout: 60000 }
  );
  await page.waitForTimeout(1000);

  // 提取回复
  const replyText = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2 = h2s.find(h => h.textContent.trim() === 'Gemini 说');
    if (!geminiH2) return '';
    const container = geminiH2.parentElement;
    return container ? container.innerText?.slice(0, 500) : '';
  });

  const cid = page.url().match(/\/app\/([a-z0-9]+)/)?.[1] || '';
  console.log('[step-4] reply:', replyText?.slice(0, 200));
  console.log('[step-4] conversation_id:', cid);

  await dev.hold('step-4: think model response received');
})().catch(e => { console.error(e); process.exit(1); });
