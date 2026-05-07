/**
 * action: list-media
 * 查询项目媒体库中的图片列表，支持关键词搜索。
 * 输入: { context, projectId?, search? }
 * 输出: { images: [{ name, mediaId }], total, projectId }
 */

const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';

async function listMedia({ context, projectId, search }) {
  if (!projectId) throw new Error('--project-id 必填');
  const pid = projectId;
  let page;
  let success = false;

  try {
    page = await context.newPage();
    await page.bringToFront();
    await page.setViewportSize({ width: 1280, height: 1024 });

    await page.goto(`${BASE}/project/${pid}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
    await human.sleep(1000);

    // 打开弹窗
    await page.locator('button:has-text("add_2")').first().click({ force: true });
    await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
    await human.sleep(1000);

    // 如果有搜索词，输入并等结果
    if (search) {
      const searchInput = page.locator('[role="dialog"] input[placeholder="搜索资源"]');
      await searchInput.first().click({ force: true });
      await human.sleep(200);
      await page.evaluate((text) => navigator.clipboard.writeText(text), search);
      await page.keyboard.press('Control+v');
      await human.sleep(2000);
    }

    // 收集所有图片（名称 + mediaId）
    const images = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const imgs = dialog.querySelectorAll('img');
      const results = [];
      for (const img of imgs) {
        if (img.alt === '搜索结果预览') continue;
        const rect = img.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        // 从 src 提取 mediaId: ...?name=<uuid>
        const m = img.src.match(/name=([0-9a-f-]+)/);
        results.push({
          name: img.alt || '',
          mediaId: m ? m[1] : null,
        });
      }
      return results;
    });

    success = true;
    return {
      images,
      total: images.length,
      projectId: pid,
    };
  } finally {
    if (success && page) await page.close();
  }
}

module.exports = listMedia;
