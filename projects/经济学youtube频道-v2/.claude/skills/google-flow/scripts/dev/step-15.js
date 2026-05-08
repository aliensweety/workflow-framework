/**
 * step-15.js —— 实测：创建新项目 + 重命名
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const URL_TAG = 'step-15';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // 1. 首页
  console.log('[1] 导航到首页...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await human.sleep(2000);

  // 先看首页完整 a11y
  const homeA11y = await page.locator('body').first().ariaSnapshot();
  console.log('[1] 首页 a11y:\n', homeA11y.substring(0, 1500));

  // 记录首页 URL
  console.log(`[1] 首页 URL: ${page.url()}`);

  // 2. 点击"新建项目"
  console.log('\n[2] 点击新建项目...');
  const createBtn = page.locator('button:has-text("新建项目")');
  const count = await createBtn.count();
  console.log(`[2] "新建项目" 按钮数量: ${count}`);

  if (count > 0) {
    await createBtn.first().click({ force: true });
    // 等跳转
    await human.sleep(3000);

    const newUrl = page.url();
    console.log(`[2] 跳转后 URL: ${newUrl}`);

    // 提取 projectId
    const m = newUrl.match(/\/project\/([0-9a-f-]+)/);
    const newProjectId = m ? m[1] : null;
    console.log(`[2] 新项目 ID: ${newProjectId}`);

    // 看新项目页面 a11y
    const newProjectA11y = await page.locator('body').first().ariaSnapshot();
    console.log(`\n[3] 新项目 a11y:\n${newProjectA11y.substring(0, 800)}`);

    // 3. 找项目名称输入框
    console.log('\n[3] 找项目名称...');
    const nameTextbox = page.locator('[role="navigation"] textbox');
    const nameCount = await nameTextbox.count();
    console.log(`[3] 导航栏 textbox 数量: ${nameCount}`);

    if (nameCount > 0) {
      const currentName = await nameTextbox.first().inputValue().catch(() =>
        nameTextbox.first().textContent()
      );
      console.log(`[3] 当前项目名: "${currentName}"`);

      // 尝试重命名
      const newName = '测试项目-小浣熊';
      console.log(`\n[4] 重命名为 "${newName}"...`);
      await nameTextbox.first().click({ force: true });
      await human.sleep(300);

      // 全选 + 删除 + 粘贴新名称
      await page.keyboard.press('Control+a');
      await human.sleep(100);
      await page.evaluate((text) => navigator.clipboard.writeText(text), newName);
      await page.keyboard.press('Control+v');
      await human.sleep(500);

      // 按回车确认（或点其他地方）
      await page.keyboard.press('Enter');
      await human.sleep(1000);

      // 验证
      const afterRename = await nameTextbox.first().inputValue().catch(() =>
        nameTextbox.first().textContent()
      );
      console.log(`[4] 重命名后: "${afterRename}"`);

      // 看 title 标签
      const title = await page.title();
      console.log(`[4] 页面 title: "${title}"`);
    }

    // 4. 回首页看项目列表，确认新项目出现
    console.log('\n[5] 回首页确认...');
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await human.sleep(2000);

    const projects = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/project/"]');
      return [...links].map(a => ({
        href: a.href,
        projectId: a.href.match(/\/project\/([0-9a-f-]+)/)?.[1],
      })).slice(0, 5);
    });
    console.log('[5] 首页前 5 个项目:', JSON.stringify(projects, null, 2));

    // 检查新建的项目是否在第一个
    if (projects.length > 0) {
      console.log(`[5] 第一个项目 ID: ${projects[0].projectId}`);
      console.log(`[5] 是否为新建项目: ${projects[0].projectId === newProjectId}`);
    }

    // 5. 看首页有没有显示项目名称
    const homeA11y2 = await page.locator('body').first().ariaSnapshot();
    console.log('\n[5] 首页 a11y (前500字):\n', homeA11y2.substring(0, 500));
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
