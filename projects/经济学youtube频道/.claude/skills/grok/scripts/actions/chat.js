/**
 * action: chat
 * 输入: { context, prompt, model?, conversation_id?, files?: string[], private?: boolean }
 *   private 传 true 则开隐私对话（一次性，无历史，不可 continue）
 *   conversation_id 传了则继续已有对话，不传则新对话
 *   files 传了则先上传附件，再输入 prompt
 * 输出: { reply, conversation_id, conversation_url, model_used, took_ms, status }
 * 失败: 抛 Error，message 含失败原因。失败时 page 不关，留作现场。
 */

const S = require('../lib/signals');
const human = require('../lib/human');

async function chat({ context, prompt, model, conversation_id, files, private: isPrivate }) {
  const startedAt = Date.now();
  let success = false;
  let page;

  try {
    page = await context.newPage();
    await page.bringToFront();

    // ── 段 A：打开主页/已有对话/隐私对话 ──
    const targetUrl = isPrivate
      ? 'https://grok.com/c#private'
      : conversation_id
        ? `https://grok.com/c/${conversation_id}`
        : 'https://grok.com/';
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

    // 弹窗兜底：等页面 DOM Ready 后先尝试关掉任何遮住输入框的弹窗
    await human.thinkPause(500, 1000);
    for (const closeSelector of [
      'button:has-text("Dismiss")',    // X 账号关联弹窗
      'button:has-text("dismiss")',    // 大小写不敏感变体
      'button:has-text("连接")',        // "连接" 按钮（跳过关联）
      '[aria-label="关闭"]',           // 添加连接器弹窗关闭按钮
      '[data-analytics-name="add-connector-modal"] button',  // 连接器弹窗
    ]) {
      const btn = page.locator(closeSelector).first();
      if (await btn.isVisible().catch(() => false)) {
        await btn.click({ force: true });
        await human.thinkPause(400, 600);
        break;
      }
    }
    // 兜底：隐私偏好中心弹窗，接受/好的/确认 按钮
    const privacyClose = page.locator('[aria-label="隐私偏好中心"] button:has-text("接受"), [aria-label="隐私偏好中心"] button:has-text("好的"), [aria-label="隐私偏好中心"] button:has-text("确认")').first();
    if (await privacyClose.isVisible().catch(() => false)) {
      await privacyClose.click({ force: true });
      await human.thinkPause(400, 600);
    }
    // 终极兜底：OneTrust cookie 弹窗（pointerEvents 拦截但子按钮不可见）
    // 直接隐藏该遮罩层，不等它渲染完成
    await page.evaluate(() => {
      const blockers = [
        '[id="onetrust-banner-sdk"]',
        '[id="onetrust-consent-sdk"]',
        '[aria-label="隐私偏好中心"]',
        '#dialog-portal',
        '[class*="cookie-banner"]',
        '[class*="cookie-modal"]',
      ];
      for (const sel of blockers) {
        const el = document.querySelector(sel);
        if (el) {
          const style = getComputedStyle(el);
          // 如果 display!=none 但所有子按钮不可见（cookie 弹窗），直接隐藏
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            const btns = el.querySelectorAll('button');
            const allHidden = Array.from(btns).every(b => b.getBoundingClientRect().width === 0);
            if (allHidden) {
              el.style.display = 'none';
            }
          }
        }
      }
    });

    await page.waitForSelector(S.COMPOSER, { timeout: 15000 });

    // 继续对话时，底部可能有滚动按钮挡着
    const scrollBtn = page.locator('button[aria-label="Scroll down"]');
    if (await scrollBtn.isVisible().catch(() => false)) {
      await scrollBtn.click();
      await human.thinkPause(200, 400);
    }

    // ── 段 B：上传附件（可选，多文件依次上传）──
    if (files && files.length > 0) {
      for (const filePath of files) {
        await human.uploadFile(page, filePath);
        console.error('[chat] uploaded:', filePath);
      }
    }

    // ── 段 C：输入 prompt（粘贴，避免 \n 触发意外发送）──
    await human.paste(page, S.COMPOSER, prompt);
    await human.thinkPause(300, 800);

    // ── 段 D：提交（直接按 Enter，不依赖 Submit 按钮）──
    let modelUsed = 'auto';
    await page.keyboard.press('Enter');

    // ── 段 E：等 URL 跳转到 /c/{id} ──
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/c/'),
      { timeout: 15000 },
    );

    // ── 段 F：等回复完成（双路：成功信号 + 失败信号）──
    const phase2 = await Promise.race([
      page.waitForSelector(S.REPLY_DONE, { timeout: 120000 }).then(() => 'done'),
      page.waitForSelector(S.ANTIBOT, { timeout: 120000 }).then(() => 'antibot').catch(() => null),
      page.waitForSelector(S.RATE_LIMIT, { timeout: 120000 }).then(() => 'rate-limit').catch(() => null),
    ]);
    if (phase2 === 'antibot') throw new Error('AntiBotError: 触发反爬检测');
    if (phase2 === 'rate-limit') throw new Error('RateLimitError: 频率限制');
    // done 时正常继续

    await page.waitForTimeout(1500); // DOM 稳定一下

    // ── 段 G：提取回复正文 ──
    const convId = page.url().match(/\/c\/([a-f0-9-]+)/)?.[1] || '';
    const extracted = await page.evaluate(() => {
      const likeBtns = Array.from(document.querySelectorAll('button[aria-label="赞"]'));
      const likeBtn = likeBtns[likeBtns.length - 1];
      if (!likeBtn) return { reply: '' };

      let el = likeBtn;
      for (let i = 0; i < 15; i++) {
        el = el.parentElement;
        if (!el) break;
        // :scope > .message-bubble 只找直接子元素
        const bubble = el.querySelector(':scope > .message-bubble');
        if (bubble) {
          let text = (bubble.innerText || '').trim();
          text = text.replace(/^Thought for \d+s\s*/, '').trim();
          return { reply: text };
        }
      }
      return { reply: '' };
    });

    success = true;
    return {
      reply: extracted.reply,
      conversation_id: convId,
      conversation_url: `https://grok.com/c/${convId}`,
      model_used: modelUsed,
      took_ms: Date.now() - startedAt,
      status: 'success',
    };
  } finally {
    if (success && page) await page.close();
    // 失败时 page 留作现场（success-flag 模式）
  }
}

module.exports = chat;
