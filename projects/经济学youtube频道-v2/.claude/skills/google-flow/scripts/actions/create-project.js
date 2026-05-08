/**
 * action: create-project
 * 在 Flow 首页创建新项目，可选重命名。
 * 输入: { context, name? }
 * 输出: { projectId, url, name }
 */

const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';

async function createProject({ context, name }) {
  let page;
  let success = false;

  try {
    page = await context.newPage();
    await page.bringToFront();
    await page.setViewportSize({ width: 1280, height: 1024 });

    // 导航到首页
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await human.sleep(2000);

    // 点击"新建项目"
    await page.locator('button:has-text("新建项目")').first().click({ force: true });
    await human.sleep(3000);

    // 从 URL 提取 projectId
    const url = page.url();
    const m = url.match(/\/project\/([0-9a-f-]+)/);
    if (!m) throw new Error(`CreateProjectFailed: URL does not contain project ID: ${url}`);
    const projectId = m[1];

    // 等项目页面加载
    await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 }).catch(() => {});

    // 可选：重命名
    let finalName;
    if (name) {
      const nameInput = page.getByLabel('可编辑文本');
      await nameInput.first().click({ force: true });
      await human.sleep(300);
      await page.keyboard.press('Control+a');
      await human.sleep(100);
      await page.evaluate((text) => navigator.clipboard.writeText(text), name);
      await page.keyboard.press('Control+v');
      await human.sleep(500);
      await page.keyboard.press('Enter');
      await human.sleep(500);
      finalName = name;
    } else {
      finalName = await page.getByLabel('可编辑文本').first().inputValue().catch(() => '');
    }

    success = true;
    return { projectId, url, name: finalName };
  } finally {
    if (success && page) await page.close();
  }
}

module.exports = createProject;
