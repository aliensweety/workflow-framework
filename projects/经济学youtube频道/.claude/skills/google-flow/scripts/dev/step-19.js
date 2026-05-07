/**
 * step-19.js —— 验证 start_generate 流程：导航 → 输入 prompt → 提交 → 等新 UUID
 * 用 raceSuccess 双路等待替代旧的 while 循环。
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const { raceSuccess } = require('../lib/wait');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const URL_TAG = 'step-19';

async function collectUuids(page) {
  return page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/edit/"]');
    const uuids = new Set();
    links.forEach(a => {
      const m = a.href.match(/\/edit\/([0-9a-f-]+)$/);
      if (m) uuids.add(m[1]);
    });
    return [...uuids];
  });
}

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // ── 段 1：导航到项目 ──
  console.log('[1] 导航到项目...');
  await page.goto(`${BASE}/project/${PROJECT_ID}#${URL_TAG}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[1] 项目加载完成');

  // ── 段 2：记录旧 UUID ──
  const oldUuids = await collectUuids(page);
  console.log(`[2] 旧 UUID 数量: ${oldUuids.length}`);

  // ── 段 3：输入 prompt ──
  console.log('[3] 输入 prompt...');
  await page.evaluate(() => document.querySelector('[contenteditable="true"]')?.focus());
  await human.sleep(200);
  await page.evaluate((text) => navigator.clipboard.writeText(text), 'a watercolor painting of a mountain lake at sunset');
  await page.keyboard.press('Control+v');
  await human.sleep(500);
  console.log('[3] prompt 已输入');

  // ── 段 4：提交生成 ──
  console.log('[4] 提交生成...');
  await human.physicalClick(page, 'button:has-text("arrow_forward")');
  console.log('[4] 已点击提交');

  // ── 段 5：注入旧 UUID + 双路等待新 UUID ──
  console.log('[5] 双路等待新 UUID...');
  await page.evaluate((uuids) => { window.__flow3_oldUuids = new Set(uuids); }, oldUuids);

  await raceSuccess(page, () => {
    const links = document.querySelectorAll('a[href*="/edit/"]');
    for (const a of links) {
      const m = a.href.match(/\/edit\/([0-9a-f-]+)$/);
      if (m && !window.__flow3_oldUuids.has(m[1])) return true;
    }
    return false;
  }, 120000);

  // ── 段 6：取新 UUID ──
  const currentUuids = await collectUuids(page);
  const newUuids = currentUuids.filter(u => !oldUuids.includes(u));
  console.log(`[6] 新 UUID: ${newUuids.join(', ') || '无'}`);

  if (newUuids.length > 0) {
    console.log('\n✅ start_generate 验证成功！');
    console.log(`imageUuid: ${newUuids[0]}`);
  } else {
    console.log('\n❌ 未检测到新 UUID');
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
