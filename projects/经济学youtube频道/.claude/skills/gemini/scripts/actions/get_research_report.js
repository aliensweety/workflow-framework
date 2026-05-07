/**
 * action: get_research_report
 * 输入: { context, conversation_id }
 * 输出: { text, completed }
 *
 * Deep Research 两阶段第二步：打开页面，检查"已完成"状态，返回报告（如有）
 * 不轮询等待——一次检查即返回。未完成时 completed=false，text 为空
 */
const S = require('../lib/signals');

async function get_research_report({ context, conversation_id }) {
  // 先在已有 tab 里找这个 conversation_id 的页面（SPA 状态不会丢失）
  const existingPages = context.pages();
  let page = existingPages.find(p => p.url().includes(conversation_id));

  if (!page) {
    // 没有已存在的 tab，才新开一个
    page = await context.newPage();
    await page.bringToFront();
    await page.goto(`https://gemini.google.com/app/${conversation_id}`);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  } else {
    await page.bringToFront();
    await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  }

  // 一次性检查"已完成"状态
  const { completed, reportText } = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let hasCompleted = false;
    while (node = walker.nextNode()) {
      if (node.textContent?.trim().includes('已完成')) {
        hasCompleted = true;
        break;
      }
    }

    if (!hasCompleted) return { completed: false, reportText: '' };

    // 提取报告：最后一个 "Gemini 说" h2 的父容器
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(h => h.textContent.trim() === 'Gemini 说');
    const lastH2 = geminiH2s[geminiH2s.length - 1];
    const container = lastH2?.parentElement;
    if (!container) return { completed: true, reportText: '' };
    const paragraphs = container.querySelectorAll('p');
    const text = paragraphs.length > 0
      ? Array.from(paragraphs).map(p => p.innerText).join(' ')
      : container.innerText?.trim() || '';
    return { completed: true, reportText: text };
  });

  // 只有新开的 page 需要关闭，已有 tab 保留
  const wasNewPage = !existingPages.find(p => p.url().includes(conversation_id));
  if (wasNewPage) await page.close();

  return { text: reportText, completed };
}

module.exports = get_research_report;
