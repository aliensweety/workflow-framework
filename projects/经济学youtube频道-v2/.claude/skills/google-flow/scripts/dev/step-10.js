/**
 * step-10.js —— 逐个检查所有 Flow 页面，找生成失败的那张
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');

async function main() {
  const { context } = await connectBrowser();
  const pages = context.pages();
  const flowPages = pages.filter(p => p.url().includes('labs.google/fx'));
  console.log(`Flow 页面: ${flowPages.length}`);

  for (let i = 0; i < flowPages.length; i++) {
    const page = flowPages[i];
    console.log(`\n========== 页面 ${i + 1} ==========`);
    console.log(`URL: ${page.url()}`);

    // 看 a11y
    const a11y = await page.locator('body').first().ariaSnapshot();

    // 找"失败"相关
    if (a11y.includes('失败') || a11y.includes('error') || a11y.includes('Error')) {
      console.log('*** 发现错误标记 ***');
    }

    // 看所有 link "生成的图片" 附近有没有非 link 的项（生成中/失败的）
    const nonLinkItems = await page.evaluate(() => {
      const list = document.querySelector('[data-testid="virtuoso-item-list"]');
      if (!list) return [];
      // 找所有直接子容器
      const items = list.querySelectorAll(':scope > div > div > div');
      const results = [];
      for (const item of items) {
        const editLink = item.querySelector('a[href*="/edit/"]');
        const mediaLink = item.querySelector('a[href*="/media/"]');
        const allLinks = item.querySelectorAll('a');
        const imgs = item.querySelectorAll('img');
        const text = item.textContent?.trim().substring(0, 120);

        // 没有 /edit/ 链接的项 = 可能是失败/上传的
        if (!editLink && text && text.length > 0) {
          results.push({
            hasEditLink: false,
            hasMediaLink: !!mediaLink,
            linkCount: allLinks.length,
            linkHrefs: [...allLinks].map(a => a.href.substring(0, 80)),
            imgCount: imgs.length,
            text,
            outerHTML: item.outerHTML?.substring(0, 300),
          });
        }
      }
      return results;
    });

    if (nonLinkItems.length > 0) {
      console.log(`\n*** 非 edit 链接的项 (${nonLinkItems.length}): ***`);
      console.log(JSON.stringify(nonLinkItems, null, 2));
    }

    // 看所有 edit 链接的 UUID
    const editUuids = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/edit/"]');
      return [...links].map(a => {
        const m = a.href.match(/\/edit\/([0-9a-f-]+)$/);
        return m ? m[1] : null;
      }).filter(Boolean);
    });
    console.log(`edit 链接 UUIDs (${editUuids.length}): ${editUuids.map(u => u.slice(0, 8)).join(', ')}`);

    // 看页面上的通知
    const notifications = await page.evaluate(() => {
      const notifs = document.querySelectorAll('[role="status"], [role="alert"], [role="log"]');
      return [...notifs].map(n => n.textContent?.trim().substring(0, 100));
    });
    if (notifications.length > 0) {
      console.log(`通知: ${JSON.stringify(notifications)}`);
    }
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
