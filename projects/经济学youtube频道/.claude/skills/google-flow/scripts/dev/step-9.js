/**
 * step-9.js —— 查看失败页面的错误状态
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const URL_TAG = 'step-9';

async function main() {
  const { context } = await connectBrowser();

  const pages = context.pages();
  console.log(`共 ${pages.length} 个 tab`);

  // 找最后一个 Flow 页面（失败保留的）
  const flowPages = pages.filter(p => p.url().includes('labs.google/fx'));
  console.log(`Flow 页面: ${flowPages.length}`);

  // 看最后一个（最新打开的，应该是失败保留的）
  const page = flowPages[flowPages.length - 1];
  await page.bringToFront();
  console.log(`页面标题: ${await page.title()}`);
  console.log(`页面URL: ${page.url()}`);

  // 1. 看 a11y tree
  const a11y = await page.locator('body').first().ariaSnapshot();
  console.log('\n=== 页面 a11y ===');
  console.log(a11y.substring(0, 3000));

  // 2. 搜索包含"失败"、"error"、"fail"文字的元素
  const errorTexts = await page.evaluate(() => {
    const results = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.trim();
      if (text && (text.includes('失败') || text.includes('error') || text.includes('fail') || text.includes('Error') || text.includes('Fail'))) {
        const parent = walker.currentNode.parentElement;
        results.push({
          text: text.substring(0, 100),
          tag: parent?.tagName,
          className: parent?.className?.substring(0, 80),
          ariaLabel: parent?.getAttribute('aria-label'),
          role: parent?.getAttribute('role'),
        });
      }
    }
    return results;
  });
  console.log('\n=== 错误文字 ===');
  console.log(JSON.stringify(errorTexts, null, 2));

  // 3. 看正在生成/失败的图片容器
  const genContainers = await page.evaluate(() => {
    // 找所有不含 /edit/ 链接的图片容器（正在生成或失败的）
    const allContainers = document.querySelectorAll('[data-testid="virtuoso-item-list"] > div > div > div');
    const results = [];
    for (const container of allContainers) {
      const hasLink = container.querySelector('a[href*="/edit/"]');
      const hasImg = container.querySelector('img');
      const text = container.textContent?.trim().substring(0, 100);
      if (!hasLink && text) {
        // 没有 edit 链接但有内容的 = 正在生成或失败
        results.push({
          text,
          hasImg: !!hasImg,
          className: container.className?.substring(0, 80),
          childCount: container.children.length,
          innerHTML: container.innerHTML?.substring(0, 200),
        });
      }
    }
    return results;
  });
  console.log('\n=== 无链接的容器（生成中/失败）===');
  console.log(JSON.stringify(genContainers, null, 2));

  // 4. 看所有包含百分比的元素
  const percentageEls = await page.evaluate(() => {
    const results = [];
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text && /^\d+%$/.test(text)) {
        results.push({
          text,
          tag: el.tagName,
          className: el.className?.substring(0, 80),
          parentText: el.parentElement?.textContent?.trim().substring(0, 100),
        });
      }
    }
    return results;
  });
  console.log('\n=== 百分比元素 ===');
  console.log(JSON.stringify(percentageEls, null, 2));

  // 5. 看 Virtuoso grid 里所有项的摘要
  const gridItems = await page.evaluate(() => {
    const list = document.querySelector('[data-testid="virtuoso-item-list"]');
    if (!list) return 'no virtuoso list';
    const children = list.querySelectorAll(':scope > div > div > div');
    const items = [];
    for (const child of children) {
      const link = child.querySelector('a[href*="/edit/"]');
      const img = child.querySelector('img');
      const text = child.textContent?.trim().substring(0, 80);
      items.push({
        hasLink: !!link,
        linkHref: link?.href?.substring(0, 80),
        hasImg: !!img,
        text,
      });
    }
    return items;
  });
  console.log('\n=== Grid 项摘要 ===');
  console.log(JSON.stringify(gridItems.slice(0, 10), null, 2));

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
