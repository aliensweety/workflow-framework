/**
 * dev/_template.js —— dev step 脚本范本
 *
 * dev step 是 04 阶段唯一的脚本形态。复制这份改，不要从零写。
 *
 * 运行方式：Bash run_in_background=true（前台跑会阻塞 Claude）。
 *
 * 起了之后：
 *   1. 脚本跑到末尾 dev.hold() 挂住
 *   2. Chrome 里保留这个 tab
 *   3. Claude 用 MCP browser_tabs / browser_select_tab / browser_snapshot 看现场
 *   4. 决定下一步 → KillShell 终止 → 复制本文件为 step-B.js 推进
 */

const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const probe = require('../lib/probe');
const dev = require('../lib/dev');
const S = require('../lib/signals');

// ★ 项目独有标识，用于 closeOldTabs 识别本 skill 残留的 tab
const URL_TAG = 'skill=runninghub-tts-dev';

(async () => {
  const { context } = await connectBrowser();

  // 清理之前跑本脚本累积的 tab（避免反复跑后多个同名 tab）
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  // ── 推进到目标状态 ──
  // URL 后面加 hash 标记，让 closeOldTabs 能识别出这是本脚本开的
  await page.goto('TODO_起点URL' + '#' + URL_TAG);

  // 如果这一段需要某个 selector 就绪才能继续，在这里等
  // await page.waitForSelector(S.COMPOSER, { timeout: 10000 });

  // 模拟用户操作（如果这一段要推进多并序）
  // await human.type(page, S.COMPOSER, 'test prompt');
  // await human.thinkPause();
  // await human.click(page, S.SUBMIT);

  // 可选：在 hold 之前 dump 一下现场 DOM 结构（输出会存在后台 Bash log 里、也可以走 saveReport）
  // await probe.dumpAllButtons(page);
  // await probe.dumpByText(page, '关键词');

  // ★ 末尾必须 hold。不能 close page、不能 process.exit。
  await dev.hold('step-X: <描述这一段做了什么>');
})().catch(e => { console.error(e); process.exit(1); });
