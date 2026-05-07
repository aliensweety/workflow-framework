/**
 * step-3.js —— 探索参考图上传流程
 * 段 1: 导航到项目
 * 段 2: 点击 add_2 → 看弹窗结构
 * 段 3: 上传毛毡浣熊
 * 段 4: 观察上传后状态
 * 段 5: 再次打开弹窗 → 搜索已有图片
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const PROJECT_ID = '2b57ce62-e0a3-41d2-bcbc-340b58be3d5e';
const REF_IMAGE = 'E:\\Downloads\\Gemini_Generated_Image_sh7jbsh7jbsh7jbs.png';
const URL_TAG = 'step-3';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // ── 段 1: 导航到项目 ──
  console.log('[段1] 导航到项目...');
  await page.goto(`${BASE}/project/${PROJECT_ID}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  console.log('[段1] 页面加载完成');

  // ── 段 2: 点击 add_2 → 看弹窗 ──
  console.log('[段2] 点击 add_2 按钮...');
  await human.sleep(1000);

  await page.locator('button:has-text("add_2")').first().click({ force: true });
  await human.sleep(1500);

  // 弹窗 a11y
  const dialogA11y = await page.locator('[role="dialog"]').first().ariaSnapshot();
  console.log('[段2] 弹窗 a11y:\n', dialogA11y);

  // 弹窗内所有按钮文本
  const allButtons = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const btns = dialog.querySelectorAll('button');
    return [...btns].map(b => ({
      text: b.textContent?.trim().substring(0, 60),
      ariaLabel: b.getAttribute('aria-label'),
      testId: b.getAttribute('data-testid'),
    }));
  });
  console.log('[段2] 弹窗按钮:', JSON.stringify(allButtons, null, 2));

  // 弹窗内所有 input
  const allInputs = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    if (!dialog) return [];
    const inputs = dialog.querySelectorAll('input');
    return [...inputs].map(inp => ({
      type: inp.type,
      placeholder: inp.placeholder,
      name: inp.name,
    }));
  });
  console.log('[段2] 弹窗 input:', JSON.stringify(allInputs, null, 2));

  // 弹窗完整文本
  const dialogText = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]');
    return dialog ? dialog.innerText.substring(0, 800) : 'no dialog';
  });
  console.log('[段2] 弹窗文本:\n', dialogText);

  // ── 段 3: 上传图片 ──
  console.log('[段3] 点击"上传图片"...');
  const uploadBtn = page.locator(':text("上传图片")');
  const uploadCount = await uploadBtn.count();
  console.log(`[段3] "上传图片" 按钮数量: ${uploadCount}`);

  if (uploadCount > 0) {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser', { timeout: 5000 }),
      uploadBtn.first().click(),
    ]);
    await fileChooser.setFiles(REF_IMAGE);
    console.log('[段3] 文件已选择，等待上传...');
    await human.sleep(4000);

    // ── 段 4: 观察上传后状态 ──
    console.log('[段4] 观察上传后状态...');

    // 看看弹窗是否还开着
    const dialogAfterUpload = await page.locator('[role="dialog"]').count();
    console.log(`[段4] 上传后弹窗还开着: ${dialogAfterUpload > 0}`);

    // 看看 prompt 输入框周围有没有图片预览
    const imgInfo = await page.evaluate(() => {
      const editable = document.querySelector('[contenteditable="true"]');
      if (!editable) return 'no editable';
      let el = editable;
      for (let i = 0; i < 10; i++) {
        el = el.parentElement;
        if (!el) return `no parent at level ${i}`;
        const imgs = el.querySelectorAll('img');
        if (imgs.length > 0) {
          return {
            level: i + 1,
            tag: el.tagName,
            className: el.className?.substring(0, 100),
            imgCount: imgs.length,
            imgSrcs: [...imgs].map(img => img.src.substring(0, 100)),
            imgAlts: [...imgs].map(img => img.alt?.substring(0, 50)),
          };
        }
      }
      return 'no img in 10 levels';
    });
    console.log('[段4] 图片预览:', JSON.stringify(imgInfo, null, 2));

    // 也看看 blob: URL 图片
    const blobImgs = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img[src^="blob:"]');
      return [...imgs].map(img => ({
        src: img.src.substring(0, 80),
        alt: img.alt,
        width: img.width,
        height: img.height,
        parentTag: img.parentElement?.tagName,
        parentClass: img.parentElement?.className?.substring(0, 80),
      }));
    });
    console.log(`[段4] blob: 图片 (${blobImgs.length}):`, JSON.stringify(blobImgs, null, 2));

    // ── 段 5: 再次打开弹窗搜索 ──
    console.log('[段5] 再次点击 add_2...');
    await page.locator('button:has-text("add_2")').first().click({ force: true });
    await human.sleep(1500);

    const dialogA11y2 = await page.locator('[role="dialog"]').first().ariaSnapshot();
    console.log('[段5] 第二次弹窗 a11y:\n', dialogA11y2);

    // 弹窗内的搜索框
    const searchInfo = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return 'no dialog';
      const inputs = dialog.querySelectorAll('input');
      return [...inputs].map(inp => ({
        type: inp.type,
        placeholder: inp.placeholder,
        ariaLabel: inp.getAttribute('aria-label'),
        value: inp.value.substring(0, 50),
      }));
    });
    console.log('[段5] 第二次弹窗 input:', JSON.stringify(searchInfo, null, 2));

    // 弹窗内有没有缩略图
    const dialogImgs = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      if (!dialog) return [];
      const imgs = dialog.querySelectorAll('img');
      return [...imgs].map(img => ({
        src: img.src.substring(0, 100),
        alt: img.alt,
        width: img.width,
        height: img.height,
      }));
    });
    console.log(`[段5] 弹窗内图片 (${dialogImgs.length}):`, JSON.stringify(dialogImgs, null, 2));

    // 弹窗文本
    const dialogText2 = await page.evaluate(() => {
      const dialog = document.querySelector('[role="dialog"]');
      return dialog ? dialog.innerText.substring(0, 800) : 'no dialog';
    });
    console.log('[段5] 弹窗文本:\n', dialogText2);
  } else {
    console.log('[段3] 没找到"上传图片"按钮');
  }

  // 挂住
  await dev.hold();
}

main().catch(err => {
  console.error('[step-3 ERROR]', err.message);
  process.exit(1);
});
