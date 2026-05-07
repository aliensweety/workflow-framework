/**
 * browser.js (CDP 模式)
 * --------------------------------------------------
 * 通过 CDP attach 到项目级 dedicated Chrome（cdp-launch.js 启动的）。
 * 不自己启动浏览器、不带 stealth 注入——这就是真实 Chrome。
 *
 * ★ 本项目所有需要操作浏览器的脚本（run.js / probe / actions）都通过这里 attach。
 * ★ 禁止使用 chromium.launch() / launchPersistentContext()。
 */

const { chromium } = require('playwright');

const CDP_ENDPOINT = process.env.CDP_ENDPOINT || 'http://localhost:9222';

/**
 * Attach 到 dedicated Chrome，返回可用 context。
 * 不接受 headless 等参数——dedicated Chrome 是真实 Chrome，永远有头。
 *
 * @returns {Promise<{ browser, context }>}
 */
async function connectBrowser() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  } catch (err) {
    throw new Error(
      `无法连接到 CDP 端点 ${CDP_ENDPOINT}。\n` +
      `请先在项目根跑: node scripts/cdp-launch.js\n` +
      `原始错误: ${err.message}`
    );
  }

  const contexts = browser.contexts();
  if (contexts.length === 0) {
    throw new Error('Chrome 没有可用 context（异常状态）。请尝试关闭并重启 dedicated Chrome。');
  }

  // dedicated Chrome 默认只有一个 context，所有 tab 都在它下面
  const context = contexts[0];
  return { browser, context };
}

module.exports = { connectBrowser, CDP_ENDPOINT };
