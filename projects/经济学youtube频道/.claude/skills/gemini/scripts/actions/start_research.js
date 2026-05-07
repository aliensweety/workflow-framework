/**
 * action: start_research
 * 输入: { context, prompt, model?, conversation_id? }
 * 输出: { conversation_id, research_plan_text }
 *
 * Deep Research 两阶段第一步：发 prompt + 等研究方案 + 点击"开始研究"
 */
const human = require('../lib/human');
const S = require('../lib/signals');
const { raceSuccess } = require('../lib/wait');

async function start_research({ context, prompt, model, conversation_id }) {
  const startedAt = Date.now();
  let success = false;
  let page;

  try {
    page = await context.newPage();
    await page.bringToFront();

    if (conversation_id) {
      await page.goto(`https://gemini.google.com/app/${conversation_id}`);
    } else {
      await page.goto('https://gemini.google.com/app');
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

    // 选择模型
    if (model && model !== 'fast') {
      const modelLabel = S.MODEL_MAP[model] || model;
      await human.click(page, S.MODEL_SELECTOR);
      await page.waitForTimeout(300);
      await human.click(page, S.MODEL_OPTION(modelLabel));
      await page.waitForTimeout(300);
    }

    // 激活 Deep Research 工具
    await human.click(page, S.TOOLS_MENU);
    await page.waitForTimeout(300);
    await human.click(page, S.TOOL_OPTION('Deep Research'));
    await page.waitForTimeout(300);

    // 输入 prompt
    await human.type(page, S.COMPOSER, prompt);

    // 等发送按钮 enabled
    await page.waitForFunction(
      () => !document.querySelector('button[aria-label="发送"]')?.disabled,
      { timeout: 5000 }
    );

    // 发送
    await human.click(page, S.SUBMIT);

    // 等研究方案出现（有"开始研究"按钮），双路：成功信号 vs 失败信号
    await raceSuccess(page, () => {
      const btn = document.querySelector('button[aria-label="发送"]');
      if (!btn || btn.disabled) return false;
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.some(b => b.innerText.includes('开始研究') && !b.disabled);
    }, 60000);

    // 提取研究方案文字
    const researchPlanText = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const startBtn = btns.find(b => b.innerText.includes('开始研究'));
      if (!startBtn) return '';
      const container = startBtn.closest('div[role="textbox"]')?.parentElement;
      return container?.innerText?.slice(0, 500) || '';
    });

    // 点击"开始研究"按钮
    await human.click(page, 'button:has-text("开始研究")', { timeout: 5000 });
    await page.waitForTimeout(1000);

    // 等 composer 有"开始研究"文字
    try {
      await page.waitForFunction(
        () => {
          const c = document.querySelector('div.ql-editor[aria-label="为 Gemini 输入提示"]');
          return c && c.innerText.includes('开始研究');
        },
        { timeout: 5000 }
      );
    } catch {
      // 已发出，继续
    }

    // 点发送
    await human.click(page, S.SUBMIT, { timeout: 5000 });
    await page.waitForTimeout(2000);

    // 提取 conversation_id
    const url = page.url();
    const match = url.match(/\/app\/([a-z0-9]+)/);
    const cid = match ? match[1] : null;

    success = true;
    return {
      conversation_id: cid,
      research_plan_text: researchPlanText,
    };
  } finally {
    if (success && page) await page.close();
    // 失败时 page 留作现场（success-flag 模式）
  }
}

module.exports = start_research;
