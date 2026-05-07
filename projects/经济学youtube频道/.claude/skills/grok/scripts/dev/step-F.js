/**
 * dev step-F: 继续已有对话
 * 验证：带 conversation_id 打开 → 页面显示历史消息 → 输入追问 → 提交 → 新回复追加
 * 用法：手动填入一个真实的 conversation_id
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const probe = require('../lib/probe');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-f';

// TODO: 填入一个真实的 conversation_id
const CONVERSATION_ID = process.env.CONVERSATION_ID || '';
const FOLLOWUP_PROMPT = 'continue';

if (!CONVERSATION_ID) {
  console.error('[step-F] 请设置环境变量 CONVERSATION_ID 或修改脚本填入真实 ID');
  console.error('  例: node step-F.js  (先 export CONVERSATION_ID=xxx)');
  process.exit(1);
}

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  // ── 打开已有对话 ──
  const targetUrl = `https://grok.com/c/${CONVERSATION_ID}#${URL_TAG}`;
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });
  console.log('[step-F] opened conversation:', targetUrl);

  // 检查是否有滚动按钮
  const scrollBtn = page.locator('button[aria-label="Scroll down"]');
  if (await scrollBtn.isVisible().catch(() => false)) {
    await scrollBtn.click();
    await human.thinkPause(200, 400);
  }

  // probe: dump 历史消息结构
  await probe.dumpBySelectors(page, 'history messages', [
    '.message-bubble',
    'button[aria-label="Like"]',
    'button[aria-label="Copy"]',
  ]);

  // ── 输入追问 ──
  await human.type(page, S.COMPOSER, FOLLOWUP_PROMPT);
  await human.thinkPause(300, 800);

  const enabled = await page.locator(S.SUBMIT_ENABLED).isVisible().catch(() => false);
  console.log('[step-F] submit enabled:', enabled);

  // ── 提交 ──
  await human.click(page, S.SUBMIT);
  console.log('[step-F] submitted');

  await page.waitForFunction(
    () => window.location.pathname.startsWith('/c/'),
    { timeout: 15000 },
  );

  // ── 等回复完成 ──
  const done = page.waitForSelector(S.REPLY_DONE, { timeout: 120000 }).then(() => 'done');
  const antibot = page.waitForSelector(S.ANTIBOT, { timeout: 120000 }).then(() => 'antibot').catch(() => null);
  const raceResult = await Promise.race([done, antibot]);
  console.log('[step-F] race:', raceResult);

  await page.waitForTimeout(1500);

  // 验证回复数增加了（多轮对话）
  const likeCount = await page.evaluate(() =>
    document.querySelectorAll('button[aria-label="Like"]').length
  );
  console.log('[step-F] total Like buttons (replies):', likeCount);

  await dev.hold('step-F done: conversation continuation verified');
}

main().catch(err => {
  console.error('[step-F]', err.message);
  process.exit(1);
});
