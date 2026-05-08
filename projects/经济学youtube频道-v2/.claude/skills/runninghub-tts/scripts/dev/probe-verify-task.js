/**
 * probe-verify-task.js —— dump 当前 history 里指定 task 的 audio src，
 * 验证拿到的 task_id 是否真是本次提交而非历史里某个旧的。
 */
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const taskId = process.argv[2];
  if (!taskId) { console.error('用法: probe-verify-task.js <task_id>'); process.exit(1); }
  const { context } = await connectBrowser();

  // 用现有 tab 或开新的
  let page = context.pages().find(p => p.url().includes(S.APP_URL));
  if (!page) {
    page = await context.newPage();
    await page.bringToFront();
    await page.goto(S.APP_URL);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await sleep(3000);
  } else {
    await page.bringToFront();
  }

  // 收集所有历史中的 (taskid, audioSrc) 对
  const tasks = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    const found = [];
    for (const el of all) {
      const t = (el.textContent || '').slice(0, 200);
      const m = t.match(/taskid[:：\s]*(\d{15,})/);
      if (!m) continue;
      // 同一 ancestor 找 audio
      let p = el;
      let hops = 0;
      while (p && hops < 8) {
        const a = p.querySelector ? p.querySelector('audio') : null;
        if (a) {
          found.push({ taskid: m[1], audioSrc: a.src || a.getAttribute('src') });
          break;
        }
        p = p.parentElement;
        hops++;
      }
    }
    // 去重
    const uniq = [];
    const seen = new Set();
    for (const f of found) {
      const k = f.taskid + '|' + f.audioSrc;
      if (!seen.has(k)) { uniq.push(f); seen.add(k); }
    }
    return uniq;
  });

  console.log(`history task count: ${tasks.length}`);
  console.log(JSON.stringify(tasks, null, 2));
  console.log('---');
  console.log('looking for', taskId);
  const hit = tasks.find(t => t.taskid === taskId);
  console.log('hit:', hit || 'NOT FOUND');

  process.exit(0);
})().catch(e => { console.error('[probe]', e.message); process.exit(1); });
