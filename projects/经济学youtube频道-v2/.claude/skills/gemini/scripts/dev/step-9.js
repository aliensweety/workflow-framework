/**
 * step-9: 测试 deep research 完整两阶段流程
 * 阶段1: 激活 deep_research 工具 + 发 prompt + 获得研究方案（含"开始研究"按钮）
 * 阶段2: 点击"开始研究" + 等完成信号 + 提取完整报告
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'gemini-dev-step9';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);
  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  console.log('[step-9] page loaded');

  // ── 激活 deep_research 工具 ──
  await page.click(S.TOOLS_MENU);
  await page.waitForTimeout(300);
  const deepResearchOpt = await page.waitForSelector('[role="menuitemcheckbox"]:has-text("Deep Research")', { timeout: 5000 });
  await deepResearchOpt.click();
  console.log('[step-9] deep_research tool activated');

  // ── 发 prompt ──
  await human.type(page, S.COMPOSER, '研究一下 AI 的发展历史');
  await page.waitForFunction(() => !document.querySelector('button[aria-label="发送"]').disabled, { timeout: 5000 });
  await human.click(page, S.SUBMIT);
  console.log('[step-9] prompt sent');

  // ── 等研究方案出现（第一阶段回复）──
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      if (!btn || btn.disabled) return false;
      // 找"开始研究"按钮
      const researchBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('开始研究'));
      return !!researchBtn;
    },
    { timeout: 60000 }
  );
  console.log('[step-9] research plan received');

  // dump 研究方案 UI
  const planHTML = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const researchBtns = btns.filter(b => b.innerText.includes('开始研究'));
    return researchBtns.map(b => ({
      text: b.innerText,
      ariaLabel: b.getAttribute('aria-label'),
      disabled: b.disabled
    }));
  });
  console.log('[step-9] research plan buttons:', JSON.stringify(planHTML, null, 2));

  // ── 阶段2：点击"开始研究"（只是把文字填进 composer，真正的研究要发出去）──
  const startBtn = await page.waitForSelector('button:has-text("开始研究")', { timeout: 5000 });
  await startBtn.click();
  console.log('[step-9] clicked 开始研究 button');

  // 等 composer 出现"开始研究"文字（最多等5秒）
  try {
    await page.waitForFunction(
      () => {
        const composer = document.querySelector('div.ql-editor[aria-label="为 Gemini 输入提示"]');
        return composer && composer.innerText.includes('开始研究');
      },
      { timeout: 5000 }
    );
  } catch {
    // 如果 composer 里没文字（可能上一个 run 已经发过了），说明研究已开始
    console.log('[step-9] composer check skipped (already sent in previous run?)');
  }

  // 发出去
  const sendBtn = await page.waitForSelector('button[aria-label="发送"]', { timeout: 5000 });
  await sendBtn.click();
  console.log('[step-9] sent 开始研究');

  // 记录当前 URL
  const urlBefore = page.url();
  console.log('[step-9] URL after sending:', urlBefore);

  // 等 composer 清空或变为占位符（研究开始后 composer 重置）
  try {
    await page.waitForFunction(
      () => {
        const composer = document.querySelector('div.ql-editor[aria-label="为 Gemini 输入提示"]');
        if (!composer) return false;
        const text = composer.innerText?.trim() || '';
        return text === '' || text.includes('你想研究什么');
      },
      { timeout: 10000 }
    );
    console.log('[step-9] composer cleared (research started)');
  } catch {
    console.log('[step-9] composer check skipped');
  }

  // ── 等完成信号：DOM 里出现"已完成" ──
  console.log('[step-9] waiting for completion (text contains 已完成)...');
  await page.waitForFunction(
    () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        const t = node.textContent?.trim();
        if (t && t.includes('已完成')) return true;
      }
      return false;
    },
    { timeout: 600000 }
  );
  console.log('[step-9] research completed!');

  // dump 报告 UI
  const reportHTML = await page.evaluate(() => {
    const containers = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = containers.filter(h => h.textContent.trim() === 'Gemini 说');
    return geminiH2s.map((h2, i) => ({
      index: i,
      text: h2.parentElement.innerText.slice(0, 200)
    }));
  });
  console.log('[step-9] report structure:', JSON.stringify(reportHTML, null, 2));

  // 检查 URL 变化
  const urlAfter = page.url();
  console.log('[step-9] URL after completion:', urlAfter);

  await dev.hold('step-9: deep research two-phase flow done');
})().catch(e => { console.error(e); process.exit(1); });
