/**
 * action: upload-media
 * 上传本地图片到项目媒体库。
 * 输入: { context, projectId?, imagePath }
 * 输出: { success, name, projectId }
 */

const human = require('../lib/human');
const path = require('path');

const BASE = 'https://labs.google/fx/zh/tools/flow';

/**
 * 检测 prompt 上方是否出现了参考图缩略图
 */
async function hasReferenceThumbnail(page) {
  return page.evaluate(() => {
    const editable = document.querySelector('[contenteditable="true"]');
    if (!editable) return false;
    let el = editable;
    for (let i = 0; i < 10; i++) {
      el = el.parentElement;
      if (!el) return false;
      const imgs = el.querySelectorAll('img');
      for (const img of imgs) {
        if (img.alt === '由您生成或上传的媒体内容都收录在集合中。') {
          return true;
        }
      }
    }
    return false;
  });
}

async function uploadMedia({ context, projectId, imagePath }) {
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
    await human.sleep(500);

    // 点击上传
    await page.waitForSelector(':text("上传图片")', { timeout: 5000 });
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      page.locator(':text("上传图片")').click(),
    ]);
    await fileChooser.setFiles(imagePath);

    // 等上传完成：prompt 上方出现缩略图
    console.log('[upload-media] 等待上传完成...');
    const uploadStart = Date.now();
    let uploaded = false;
    while (Date.now() - uploadStart < 60000) {
      await human.sleep(2000);
      if (await hasReferenceThumbnail(page)) {
        uploaded = true;
        console.log('[upload-media] 缩略图出现，上传完成');
        break;
      }
    }

    if (!uploaded) {
      throw new Error('UploadTimeout: 参考图缩略图未在 60s 内出现');
    }

    // 关闭弹窗
    await page.keyboard.press('Escape');
    await human.sleep(300);

    // 原始文件名（不含扩展名），供后续 reference-search 使用
    const basename = path.basename(imagePath, path.extname(imagePath));

    success = true;
    return {
      success: true,
      name: basename,
      projectId: pid,
    };
  } finally {
    if (success && page) await page.close();
  }
}

module.exports = uploadMedia;
