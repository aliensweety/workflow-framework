/**
 * dev.js
 * --------------------------------------------------
 * 开发期 dev step 脚本用的辅助工具。
 *
 * 核心机制：dev step 脚本 “跑一步 → 挂住 → Claude 用 MCP 看现场 → 决定下一步”。
 * 挂住进程是必须的——进程退出后 Playwright 会清理它创建的 page，
 * 但在脚本运行期间 page 会保留在 Chrome 里供 MCP 查看。
 */

/**
 * 挂住当前 Node 进程，永远不退出。调用者负责 TaskStop 或 Ctrl+C。
 *
 * 使用者需要用 `run_in_background=true` 跑脚本，否则 Claude 的 tool turn 会被阻塞。
 */
async function hold(label = 'step done') {
  console.log(`[dev] ${label}`);
  console.log('[dev] Process held. Claude can now use MCP to inspect the page.');
  console.log('[dev] To exit: TaskStop this background job (or Ctrl+C in foreground).');
  await new Promise(() => {});
}

/**
 * 在当前 context 里关掉所有 URL 匹配给定调用者的旧 tab。
 * 调这个在 step 脚本开头，避免多次跑脚本之后累积同名 tab。
 *
 * 只关掉 URL 包含 urlFragment 的 tab（不要关用户手动打开的同源站点页面的主 tab，需使用者传入项目独有的 hash 或 query）。
 *
 * @param {import('playwright').BrowserContext} context
 * @param {string} urlFragment - 要匹配的 URL 片段，例 'flow.skill=true' 或 '#dev-step'
 */
async function closeOldTabs(context, urlFragment) {
  if (!urlFragment) {
    console.warn('[dev] closeOldTabs: urlFragment empty, skipped to avoid closing user tabs');
    return 0;
  }
  const pages = context.pages();
  let closed = 0;
  for (const p of pages) {
    try {
      if (p.url().includes(urlFragment)) {
        await p.close();
        closed++;
      }
    } catch {
      // page 可能已关，忽略
    }
  }
  if (closed > 0) console.log(`[dev] closed ${closed} old tab(s) matching '${urlFragment}'`);
  return closed;
}

module.exports = { hold, closeOldTabs };
