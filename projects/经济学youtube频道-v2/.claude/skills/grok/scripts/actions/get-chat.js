/**
 * action: get_chat
 * 输入: { context, conversation_id }
 * 输出: { conversation_id, status, reply?, model_used?, error? }
 *
 * 决策 12 异步规范：
 * - 查到完成 → { status: 'completed', reply, model_used }
 * - 还在跑 → { status: 'running' }
 * - 找不到 conversation_id → { status: 'not_found' }（不抛异常）
 * - 自身出错（selector 失效等）→ 抛异常
 *
 * 完成信号：URL 含 rid= 参数（Grokn 回复完成后自动追加），不依赖 Like 按钮的 opacity。
 */

const S = require('../lib/signals');

async function getChat({ context, conversation_id }) {
  let page;
  try {
    page = await context.newPage();
    await page.bringToFront();

    const conversationUrl = `https://grok.com/c/${conversation_id}`;
    await page.goto(conversationUrl, { waitUntil: 'domcontentloaded' });

    await page.waitForTimeout(2000);

    // 回复完成的信号：Like 按钮存在于 DOM 中（opacity-0 不影响 querySelector 能找到）
    const hasReply = await page.evaluate(() => {
      return document.querySelectorAll('button[aria-label="Like"]').length > 0;
    });

    if (!hasReply) {
      // 还在生成中
      await page.close();
      return {
        conversation_id,
        status: 'running',
      };
    }

    // 回复完成，提取内容
    await page.waitForTimeout(1500); // DOM 稳定
    const extracted = await page.evaluate(() => {
      const likeBtns = Array.from(document.querySelectorAll('button[aria-label="Like"]'));
      const likeBtn = likeBtns[likeBtns.length - 1];
      if (!likeBtn) return { reply: '' };

      // 从 Like 按钮向上找最近的直接子 bubble（不用 querySelector 会跨子树）
      let el = likeBtn;
      for (let i = 0; i < 15; i++) {
        el = el.parentElement;
        if (!el) break;
        // :scope > .message-bubble 只找直接子元素，避免祖先里任何 descendant 都匹配
        const bubble = el.querySelector(':scope > .message-bubble');
        if (bubble) {
          let text = (bubble.innerText || '').trim();
          text = text.replace(/^Thought for \d+s\s*/, '').trim();
          return { reply: text };
        }
      }
      return { reply: '' };
    });

    // 提取当前使用的模型
    const modelUsed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="Model select"]');
      if (!btn) return 'auto';
      const spans = btn.querySelectorAll('span');
      return spans[0]?.textContent?.trim().toLowerCase() || 'auto';
    });

    await page.close();
    return {
      conversation_id,
      status: 'completed',
      reply: extracted.reply,
      model_used: modelUsed,
    };
  } catch (err) {
    if (page) await page.close().catch(() => {});
    // 找不到 conversation_id → not_found，不抛
    if (err.message.includes('timeout') || err.message.includes('navigation')) {
      return {
        conversation_id,
        status: 'not_found',
        error: 'conversation_id not found or expired',
      };
    }
    throw err;
  }
}

module.exports = getChat;
