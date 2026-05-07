/**
 * action: start_chat
 * 输入: { context, prompt, model?, files?, conversation_id?, temporary? }
 * 输出: { conversation_id, model_used, status: 'running' }
 *
 * 决策 12 异步规范：提交后立即拿 handle 返回，不等回复。
 * 回复完成后用 get_chat(conversation_id) 取结果。
 *
 * 注意：成功时 page 不关闭，留给 get_chat 复用（避免 CDP 竞态）。
 * 失败时 page 留作现场（success-flag 模式）。
 */

const human = require('../lib/human');
const S = require('../lib/signals');
const { raceSuccess } = require('../lib/wait');

async function start_chat({ context, prompt, model, files, conversation_id, temporary }) {
  const startedAt = Date.now();
  let success = false;
  let page;

  try {
    page = await context.newPage();
    await page.bringToFront();

    // ── 打开对话 ──
    if (conversation_id) {
      await page.goto(`https://gemini.google.com/app/${conversation_id}`);
    } else {
      await page.goto('https://gemini.google.com/app');
    }
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

    // ── 临时对话 ──
    if (temporary) {
      await human.click(page, S.TEMPORARY_CHAT);
      await page.waitForTimeout(1000);
    }

    // ── 上传文件（可选，多文件依次上传）──
    if (files && files.length > 0) {
      for (const filePath of files) {
        await human.uploadFile(page, filePath);
        console.error('[start_chat] uploaded:', filePath);
      }
    }

    // ── 输入 prompt ──
    await human.paste(page, S.COMPOSER, prompt);
    await human.thinkPause(300, 800);

    // ── 选择模型 ──
    let modelUsed = 'fast';
    if (model && model !== 'fast') {
      const modelLabel = S.MODEL_MAP[model] || model;
      await human.click(page, S.MODEL_SELECTOR);
      await page.waitForTimeout(300);
      await human.click(page, S.MODEL_OPTION(modelLabel));
      await page.waitForTimeout(300);
      modelUsed = model;
    }

    // ── 发送 ──
    await page.waitForFunction(
      () => !document.querySelector('button[aria-label="发送"]')?.disabled,
      { timeout: 5000 }
    );
    await human.click(page, S.SUBMIT);

    // ── 等发送动作发生（按钮变 disabled）──
    try {
      await page.waitForFunction(
        () => document.querySelector('button[aria-label="发送"]')?.disabled,
        { timeout: 5000 }
      );
    } catch {
      // 忽略
    }

    // ── 等 URL 有 conversation_id，双路：成功信号 vs 失败信号 ──
    await raceSuccess(page, () => /\/app\/[a-z0-9]+/.test(window.location.pathname), 15000);

    const url = page.url();
    const match = url.match(/\/app\/([a-z0-9]+)/);
    const cid = match ? match[1] : '';

    success = true;
    return {
      conversation_id: cid,
      model_used: modelUsed,
      status: 'running',
      started_at: startedAt,
    };
  } finally {
    // 失败时 page 留作现场（success-flag 模式）；成功时保持 open 供 get_chat 复用
  }
}

module.exports = start_chat;
