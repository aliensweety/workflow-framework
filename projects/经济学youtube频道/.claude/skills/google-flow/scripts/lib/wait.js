/**
 * wait.js
 * 双路等待：成功信号 + 失败信号 Promise.race。
 * 项目规范：所有长时间等待必须双路并行，禁止干等到 timeout。
 */

/**
 * 双路等待：成功条件 vs 页面失败信号 race。
 * 失败信号检测：登录丢失 / 反爬。
 * @param {import('playwright').Page} page
 * @param {() => any} successFn - 成功条件（browser 内执行）
 * @param {number} [timeout=30000]
 */
async function raceSuccess(page, successFn, timeout = 30000) {
  const failurePromise = page.waitForFunction(() => {
    const url = window.location.href;
    if (url.includes('/login') || url.includes('accounts.google.com')) return 'LoginRequired';
    const body = document.body?.innerText || '';
    if (body.includes('unusual activity') || body.includes('异常活动') || body.includes('verify you are human')) return 'AntiBotError';
    return false;
  }, { timeout, polling: 1000 })
    .then(h => h.jsonValue())
    .then(name => { throw new Error(name); });

  await Promise.race([
    page.waitForFunction(successFn, { timeout }),
    failurePromise,
  ]);
}

module.exports = { raceSuccess };
