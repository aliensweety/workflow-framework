/**
 * step-10: 等 tab 19 的研究完成（polling 方式）
 * 复用 tab 19 (9da6f145630eeabd) 的已启动研究
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');

const TARGET_CONV = '9da6f145630eeabd';

(async () => {
  const { context } = await connectBrowser();

  // 找到 tab 19 (9da6f145630eeabd)
  const pages = context.pages();
  const targetPage = pages.find(p => p.url().includes(TARGET_CONV));
  if (!targetPage) {
    console.error('[step-10] target page not found');
    process.exit(1);
  }

  await targetPage.bringToFront();
  console.log('[step-10] monitoring:', targetPage.url());

  // 轮询检查是否完成
  let attempts = 0;
  while (attempts < 120) { // 最多等10分钟
    const done = await targetPage.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent?.trim().includes('已完成')) return true;
      }
      return false;
    });

    if (done) {
      console.log('[step-10] COMPLETED after', attempts * 5, 'seconds!');
      break;
    }

    // 每5秒检查一次
    await targetPage.waitForTimeout(5000);
    attempts++;

    // 每分钟打印一次状态
    if (attempts % 12 === 0) {
      const status = await targetPage.evaluate(() => {
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let node;
        let lastStatus = '';
        while (node = walker.nextNode()) {
          const t = node.textContent?.trim() || '';
          if (t.includes('网站') || t.includes('正在') || t.includes('已完成')) {
            lastStatus = t.slice(0, 80);
          }
        }
        return lastStatus;
      });
      console.log('[step-10] status:', status);
    }
  }

  // 提取报告
  const reportText = await targetPage.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    let texts = [];
    while (node = walker.nextNode()) {
      const t = node.textContent?.trim() || '';
      if (t.length > 50) texts.push(t.slice(0, 100));
    }
    return texts.slice(0, 20);
  });
  console.log('[step-10] report text samples:', JSON.stringify(reportText, null, 2));

  await dev.hold('step-10: research completed, report extracted');
})().catch(e => { console.error(e); process.exit(1); });
