/**
 * step-A: 上传音频 + 输入文本 + 点击运行
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const probe = require('../lib/probe');
const dev = require('../lib/dev');
const S = require('../lib/signals');

const URL_TAG = 'skill=runninghub-tts-dev';

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(S.APP_URL + '#' + URL_TAG);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await human.sleep(3000);

  // 等待 textarea 可见（页面上有 2 个 textarea，用 last 选可见的那个）
  const textarea = page.locator(S.TEXTAREA).last();
  await textarea.waitFor({ state: 'visible', timeout: 10000 });
  console.log('[step-A] textarea ready');

  // 上传音频：直接用隐藏的 file input
  const fileInputs = await page.locator('input[type="file"][accept="audio/*"]').all();
  console.log(`[step-A] found ${fileInputs.length} file inputs`);
  // 用最后一个 file input（第一个可能是封面图上传）
  const audioPath = 'D:\\cc-project\\web-skill-creator-cdp-3\\素材\\播音音频.mp3';
  await fileInputs[fileInputs.length - 1].setInputFiles(audioPath);
  console.log('[step-A] audio file set');
  await human.sleep(2000);

  // 清空并输入文本
  await textarea.click();
  await page.keyboard.press('Control+A');
  await human.sleep(100);
  await page.keyboard.press('Delete');
  await human.sleep(200);
  const testText = '这是自动化测试文本，用于验证配音生成流程。';
  for (const ch of testText) {
    await page.keyboard.type(ch, { delay: human.randInt(30, 80) });
  }
  console.log('[step-A] text input done');

  // 点击运行
  await human.click(page, S.RUN_BUTTON);
  console.log('[step-A] run button clicked');
  await human.sleep(3000);

  // dump 当前状态
  await probe.dumpAllButtons(page);
  await probe.dumpByText(page, 'taskid');
  await probe.dumpByText(page, '排队');
  await probe.dumpByText(page, '生成');
  await probe.dumpByText(page, '运行中');

  await dev.hold('step-A: uploaded audio + typed text + clicked run');
})().catch(e => { console.error(e); process.exit(1); });
