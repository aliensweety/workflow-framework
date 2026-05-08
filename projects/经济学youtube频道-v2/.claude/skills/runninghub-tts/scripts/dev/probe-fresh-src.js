/**
 * probe-fresh-src.js —— 刷新页面后再读 audio src，对比刷新前后是否一致
 */
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const taskId = process.argv[2];
  if (!taskId) { console.error('用法: probe-fresh-src.js <task_id>'); process.exit(1); }
  const { context } = await connectBrowser();

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto(S.APP_URL);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await sleep(5000);  // 等历史面板加载

  // 滚动到顶部
  await page.evaluate(() => { window.scrollTo(0, 0); });
  await sleep(2000);

  const hit = await page.evaluate((tid) => {
    const items = document.querySelectorAll('.history-item');
    const all = [];
    for (const item of items) {
      const t = item.textContent || '';
      const audio = item.querySelector('audio');
      const src = audio?.src || audio?.getAttribute('src') || null;
      const m = t.match(/taskid[:：\s]*(\d+)/);
      const tid2 = m ? m[1] : null;
      const dur = t.match(/(\d+:\d+)\s*\/\s*(\d+:\d+)/);
      all.push({ tid: tid2, audioSrc: src, dur: dur?.[2] });
    }
    return all;
  }, taskId);

  console.log(`fresh history items: ${hit.length}`);
  console.log(JSON.stringify(hit.slice(0, 10), null, 2));

  process.exit(0);
})().catch(e => { console.error('[probe]', e.message); process.exit(1); });
