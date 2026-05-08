/**
 * action: get_chat
 * 输入: { context, conversation_id }
 * 输出: { conversation_id, status, text?, images?, model_used?, error? }
 *
 * 决策 12 异步规范：
 * - 查到完成 → { status: 'completed', text, images, model_used }
 * - 还在跑 → { status: 'running' }
 * - 自身出错（selector 失效等）→ 抛异常
 */

const S = require('../lib/signals');

async function get_chat({ context, conversation_id }) {
  let page;
  try {
    // 先在已有 tab 里找这个 conversation_id（SPA 状态不会丢失）
    const pagesBefore = context.pages();
    page = pagesBefore.find(p => p.url().includes(conversation_id));

    if (!page) {
      page = await context.newPage();
      await page.bringToFront();
      await page.goto(`https://gemini.google.com/app/${conversation_id}`);
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
      await page.waitForTimeout(2000); // DOM 异步渲染，等待稳定
    } else {
      await page.bringToFront();
      await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
      await page.waitForTimeout(1000);
    }

    // 完成信号：最后一个 "Gemini 说" 容器里有实质文字（>= 5 字符）
    // 不依赖按钮状态——按钮 disabled 只表示 composer 为空，不代表生成中
    const { done, replyText, images, failure } = await page.evaluate(() => {
      // 失败信号检测（双路等待）
      const url = window.location.href;
      if (url.includes('/login') || url.includes('accounts.google.com')) {
        return { done: false, replyText: '', images: [], failure: 'LoginRequired' };
      }
      const body = document.body?.innerText || '';
      if (body.includes('unusual activity') || body.includes('异常活动') || body.includes('verify you are human')) {
        return { done: false, replyText: '', images: [], failure: 'AntiBotError' };
      }
      if (body.includes('rate limit') || body.includes('频率限制') || body.includes('too many requests')) {
        return { done: false, replyText: '', images: [], failure: 'RateLimitError' };
      }

      const all = Array.from(document.querySelectorAll('h2'));
      const geminiH2s = all.filter(el => el.textContent.trim() === 'Gemini 说');
      if (geminiH2s.length === 0) return { done: false, replyText: '', images: [] };

      const lastH2 = geminiH2s[geminiH2s.length - 1];
      const container = lastH2.parentElement;
      if (!container) return { done: false, replyText: '', images: [] };

      const paragraphs = container.querySelectorAll('p');
      const text = paragraphs.length > 0
        ? Array.from(paragraphs).map(p => p.innerText).join(' ')
        : container.innerText?.trim() || '';

      const imgs = container.querySelectorAll('img');
      const imgResults = [];
      for (const img of imgs) {
        const src = img.src || img.getAttribute('data-src');
        if (!src) continue;
        if (src.includes('google.com/gen_204') || src.includes('gcs.google.com/stickers') ||
            src.includes('萌娘') || src.includes('lottie') || src.includes('weather')) continue;
        const hdUrl = src.includes('/thumb/') ? src.replace(/\/thumb\/\d+\//, '/thumb/2000/') : src;
        imgResults.push({ thumbnail_url: src, hd_url: hdUrl });
      }

      const done = text.length >= 5;
      return { done, replyText: text, images: imgResults };
    });

    if (failure) throw new Error(failure);

    // page 保持 open， caller 负责关闭

    if (!done) {
      return {
        conversation_id,
        status: 'running',
      };
    }

    // 提取当前使用的模型
    const modelUsed = await page.evaluate(() => {
      const btn = document.querySelector('button[aria-label="打开模式选择器"]');
      if (!btn) return 'fast';
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      const active = menuItems.find(el => el.getAttribute('aria-checked') === 'true');
      return active?.textContent?.trim() || 'fast';
    });

    return {
      conversation_id,
      status: 'completed',
      text: replyText,
      images,
      model_used: modelUsed,
    };
  } catch (err) {
    // 失败时 page 留作现场（success-flag 模式）
    throw err;
  }
}

module.exports = get_chat;
