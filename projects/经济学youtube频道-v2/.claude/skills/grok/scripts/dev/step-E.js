/**
 * dev step-E: 模型选择——逐个验证 model 取值
 * 验证：auto/fast/expert/grok-4.3/heavy 各取值能否正常选择
 * 已知问题：has-text 大小写敏感，必须用菜单里的实际文本大小写
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-e';
const TEST_PROMPT = '1+1=? reply in one word';

// Playwright has-text 大小写敏感，模型文本从 signals.js 的 MODEL_LABELS 映射表取
const MODELS = Object.entries(S._MODEL_LABELS || {
  'auto':     'Auto',
  'fast':     'Fast',
  'expert':   'Expert',
  'grok-4.3': 'Grok 4.3 (beta)',
  'heavy':    'Heavy',
}).map(([key, label]) => ({ key, label }));

async function openAndSelect(page, modelLabel) {
  await human.click(page, S.MODEL_SELECT, { timeout: 5000 });
  await human.thinkPause(200, 500);

  // 检查订阅墙（出现在菜单之前或之后）
  const wall = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible().catch(() => false);

  const optSelector = S.modelOption(modelLabel);
  const visible = await page.locator(optSelector).isVisible().catch(() => false);

  return { wall, visible, optSelector };
}

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/#' + URL_TAG, { waitUntil: 'domcontentloaded' });

  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });
  await human.type(page, S.COMPOSER, TEST_PROMPT);
  await human.thinkPause(200, 500);

  // 逐个验证模型
  for (const { key, label } of MODELS) {
    const { wall, visible, optSelector } = await openAndSelect(page, label);

    if (wall) {
      console.log(`[step-E] ${key} (${label}): 订阅墙出现`);
      await page.keyboard.press('Escape');
      await human.thinkPause(200, 400);
      continue;
    }

    if (!visible) {
      console.log(`[step-E] ${key} (${label}): 选项不可见，selector=${optSelector}`);
      // 关菜单重来
      await page.keyboard.press('Escape');
      await human.thinkPause(200, 300);
      continue;
    }

    await human.click(page, optSelector);
    await human.thinkPause(200, 500);

    // 选中后检查订阅墙（Heavy 模型）
    const wallAfter = await page.locator('[role="dialog"], [role="alertdialog"]').isVisible().catch(() => false);
    if (wallAfter) {
      console.log(`[step-E] ${key} (${label}): ✓ 选择成功，但触发订阅墙`);
      await page.keyboard.press('Escape');
      await human.thinkPause(200, 400);
    } else {
      console.log(`[step-E] ${key} (${label}): ✓ 选择成功`);
    }
  }

  await dev.hold('step-E done: model variations verified');
}

main().catch(err => {
  console.error('[step-E]', err.message);
  process.exit(1);
});
