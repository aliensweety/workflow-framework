/**
 * dev step-private: 验证 --private 开启隐私对话
 * 验证：带 --private 参数 → 打开 /c#private → 对话无历史记录
 */
const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');
const S = require('../lib/signals');

const URL_TAG = 'grok.dev.step-private';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.goto('https://grok.com/c#private', { waitUntil: 'domcontentloaded' });
  await page.waitForSelector(S.COMPOSER, { timeout: 15000 });

  const PRIVATE_BANNER = "This chat won't appear in your history and will not be used to train models.";
  const info = await page.evaluate((banner) => {
    const url = window.location.href;
    // 精确匹配只含隐私提示的元素
    let bannerText = '';
    const allEls = document.querySelectorAll('*');
    for (const el of allEls) {
      if ((el.innerText || '').trim() === banner) {
        bannerText = banner;
        break;
      }
    }
    const composer = !!document.querySelector('div.ProseMirror[contenteditable="true"]');
    return { url, bannerText, composer };
  }, PRIVATE_BANNER);
  console.log('[step-private] page info:', JSON.stringify(info));

  if (info.bannerText === PRIVATE_BANNER) {
    console.log('[step-private] PASS: 隐私对话模式已激活');
  } else {
    console.log('[step-private] FAIL: 未检测到隐私对话特征');
  }

  await dev.hold(`step-private done: banner=${info.bannerText.slice(0, 50)}`);
}

main().catch(err => {
  console.error('[step-private]', err.message);
  process.exit(1);
});
