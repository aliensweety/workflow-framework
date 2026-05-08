/**
 * probe-task-detail.js —— 通过 RunningHub API（task/openapi/outputs 之类）查 task 详情
 * 看任务参数和输出的真实关系。
 */
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const taskId = process.argv[2];
  if (!taskId) { console.error('用法: probe-task-detail.js <task_id>'); process.exit(1); }
  const { context } = await connectBrowser();

  let page = context.pages().find(p => p.url().includes(S.APP_URL));
  if (!page) {
    page = await context.newPage();
    await page.bringToFront();
    await page.goto(S.APP_URL);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
    await sleep(3000);
  }

  // 抓所有 webapp/task 相关 API
  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('runninghub.cn') && (url.includes('task') || url.includes('history'))) {
      requests.push({ method: req.method(), url, postData: req.postData()?.slice(0, 400) });
    }
  });

  // 通过 cookie 拿 token，然后调 task 详情 API（猜几个常见路径）
  const auth = await page.evaluate(() => {
    const m = document.cookie.match(/Rh-Accesstoken=([^;]+)/);
    return m ? 'Bearer ' + m[1] : null;
  });
  console.log('auth ok:', !!auth);

  // 试几个可能的 detail API
  const apis = [
    `https://www.runninghub.cn/task/openapi/outputs?taskId=${taskId}`,
    `https://www.runninghub.cn/task/${taskId}`,
    `https://www.runninghub.cn/task/openapi/detail?taskId=${taskId}`,
    `https://www.runninghub.cn/task/openapi/get?taskId=${taskId}`,
    `https://www.runninghub.cn/api/task/detail?taskId=${taskId}`,
  ];

  for (const api of apis) {
    const resp = await page.evaluate(async ({ api, auth }) => {
      try {
        const r = await fetch(api, { headers: { Authorization: auth } });
        return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 1500) };
      } catch (e) { return { error: e.message }; }
    }, { api, auth });
    console.log('=== ' + api);
    console.log(JSON.stringify(resp, null, 2));
  }

  // 滚动到顶部，刷新 history 看新任务的实际 src
  await page.evaluate(() => {
    const panel = document.querySelector('.history-panel, [class*="history"]');
    if (panel) panel.scrollTop = 0;
  });
  await sleep(2000);

  // 用更精准方式：找 .history-item 里 textContent 含 taskid 的那一项
  const hit = await page.evaluate((tid) => {
    const items = document.querySelectorAll('[class*="history-item"], [class*="history-detail"] > div');
    for (const item of items) {
      const t = item.textContent || '';
      if (t.includes(`taskid: ${tid}`) || t.includes(`taskid：${tid}`) || t.includes(tid)) {
        const audio = item.querySelector('audio');
        return {
          tag: item.tagName,
          cls: item.className,
          text: t.slice(0, 300),
          audioSrc: audio?.src || audio?.getAttribute('src') || null,
        };
      }
    }
    return null;
  }, taskId);
  console.log('=== history-item match:');
  console.log(JSON.stringify(hit, null, 2));

  process.exit(0);
})().catch(e => { console.error('[probe]', e.message); process.exit(1); });
