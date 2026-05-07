/**
 * step-8: 测试文件上传
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const dev = require('../lib/dev');
const S = require('../lib/signals');
const path = require('path');
const fs = require('fs');

const URL_TAG = 'gemini-dev-step8';
// 小测试图片（1x1 PNG）
const TEST_FILE = path.join(__dirname, 'test-upload.png');

(async () => {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);
  const page = await context.newPage();
  await page.bringToFront();

  await page.goto(`https://gemini.google.com/app#${URL_TAG}`);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  console.log('[step-8] page loaded');

  // 先点一下 composer 激活
  await page.click(S.COMPOSER);
  await page.waitForTimeout(300);

  // 点击文件上传按钮
  const uploadBtn = await page.waitForSelector('button[aria-label="打开文件上传菜单"]', { timeout: 5000 });
  await uploadBtn.click();
  console.log('[step-8] file upload button clicked');

  // 等菜单出现（menuitem text = "上传文件. 文档、数据、代码文件"）
  await page.waitForSelector('text=上传文件', { timeout: 5000 });
  console.log('[step-8] menu appeared');

  // 设置 filechooser 监听器（必须在点击 menuitem 之前注册）
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 5000 }),
    page.click('text=上传文件')
  ]);
  console.log('[step-8] filechooser intercepted:', fileChooser);
  console.log('[step-8] filechooser isMultiple:', fileChooser.isMultiple());

  // 如果测试文件不存在就创建一个
  if (!fs.existsSync(TEST_FILE)) {
    // 1x1 透明 PNG
    const buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(TEST_FILE, buf);
    console.log('[step-8] created test file:', TEST_FILE);
  }

  // 把文件传给 filechooser
  await fileChooser.setFiles(TEST_FILE);
  console.log('[step-8] file set to chooser');

  // 等文件上传区出现（预览图）
  await page.waitForTimeout(1000);

  // 看看 composer 区域现在的状态
  const composerState = await page.evaluate(() => {
    const composer = document.querySelector('div.ql-editor[aria-label="为 Gemini 输入提示"]');
    if (!composer) return 'composer not found';
    const parent = composer.parentElement;
    // 找图片/文件相关的子元素
    const files = Array.from(parent.querySelectorAll('img[src], [data-file-name]'));
    return {
      composerHTML: composer.innerHTML?.slice(0, 200),
      parentHTML: parent.innerHTML?.slice(0, 300),
      childCount: parent.children.length
    };
  });
  console.log('[step-8] composer state after upload:', JSON.stringify(composerState, null, 2));

  // 看看是否有已上传的文件显示
  const uploadedFiles = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button[aria-label], img[src]'));
    return btns.filter(b => {
      const t = b.innerText || '';
      return t.includes('png') || t.includes('jpg') || t.includes('文件') || t.includes('upload') || b.getAttribute('aria-label')?.includes('文件');
    }).map(b => ({ label: b.getAttribute('aria-label'), text: b.innerText?.slice(0, 50), tag: b.tagName }));
  });
  console.log('[step-8] uploaded file UI elements:', JSON.stringify(uploadedFiles, null, 2));

  await dev.hold('step-8: file upload flow done');
})().catch(e => { console.error(e); process.exit(1); });
