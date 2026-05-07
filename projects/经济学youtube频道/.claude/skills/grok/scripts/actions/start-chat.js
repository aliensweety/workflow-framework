/**
 * action: start_chat
 * 输入: { context, prompt, model?, conversation_id?, files?: string[] }
 * 输出: { conversation_id, conversation_url, model_used, status, started_at }
 * 失败: 抛 Error，page 留作现场。
 *
 * 决策 12 异步规范：提交后立即拿 handle 返回，不等回复。
 * 回复完成后用 get_chat(conversation_id) 取结果。
 */

const S = require('../lib/signals');
const human = require('../lib/human');

async function startChat({ context, prompt, model, conversation_id, files, private: isPrivate }) {
  const startedAt = Date.now();
  let success = false;
  let page;

  try {
    page = await context.newPage();
    await page.bringToFront();

    // ── 打开主页/已有对话/隐私对话 ──
    const targetUrl = isPrivate
      ? 'https://grok.com/c#private'
      : conversation_id
        ? `https://grok.com/c/${conversation_id}`
        : 'https://grok.com/';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector(S.COMPOSER, { timeout: 15000 });

    // 继续对话时底部可能有滚动按钮挡着
    const scrollBtn = page.locator('button[aria-label="Scroll down"]');
    if (await scrollBtn.isVisible().catch(() => false)) {
      await scrollBtn.click();
      await human.thinkPause(200, 400);
    }

    // ── 上传附件（可选，多文件依次上传）──
    if (files && files.length > 0) {
      for (const filePath of files) {
        await human.uploadFile(page, filePath);
        console.error('[start_chat] uploaded:', filePath);
      }
    }

    // ── 输入 prompt（用 paste，快）──
    await human.paste(page, S.COMPOSER, prompt);
    await human.thinkPause(300, 800);

    // ── 可选切模型 ──
    let modelUsed = 'auto';
    if (model && model !== 'auto') {
      await human.click(page, S.MODEL_SELECT);
      await human.thinkPause(200, 500);
      await human.click(page, S.modelOption(model));
      await human.thinkPause(200, 500);
      modelUsed = model;
    }

    // ── 提交 ──
    await page.waitForSelector(S.SUBMIT_ENABLED, { timeout: 5000 });
    await human.click(page, S.SUBMIT);

    // ── 等 URL 跳转到 /c/{id}，拿到 handle 立即返回 ──
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/c/'),
      { timeout: 15000 },
    );

    const convId = page.url().match(/\/c\/([a-f0-9-]+)/)?.[1] || '';
    const conversationUrl = `https://grok.com/c/${convId}`;

    success = true;
    return {
      conversation_id: convId,
      conversation_url: conversationUrl,
      model_used: modelUsed,
      status: 'running',
      started_at: startedAt,
    };
  } finally {
    if (success && page) await page.close();
    // 失败时 page 留作现场
  }
}

module.exports = startChat;
