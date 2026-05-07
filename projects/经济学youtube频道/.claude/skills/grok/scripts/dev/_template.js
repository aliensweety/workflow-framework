/**
 * dev/_template.js
 * --------------------------------------------------
 * dev step 脚本模板。复制此文件为 step-X.js，修改后跑。
 *
 * 规则：
 * - URL_TAG 必须唯一（同一个 dev folder 里不能有重复）
 * - 跑完末尾自动挂住，Claude 用 MCP 看现场
 * - 永远用 run_in_background=true 跑
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const probe = require('../lib/probe');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.<TEMPLATE>'; // 改这里

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  // ── 起点 URL ──────────────────────────────────────────────
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  // ── TODO: 替换为这一段要验证的操作 ──────────────────────────

  await dev.hold(`${URL_TAG}: 操作完成，请用 MCP 看现场`);
}

main().catch(err => {
  console.error('[dev]', err.message);
  process.exit(1);
});
