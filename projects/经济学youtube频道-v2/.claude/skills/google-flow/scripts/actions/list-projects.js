/**
 * action: list-projects
 * 列出 Flow 首页的所有项目。
 * 输入: { context }
 * 输出: { projects: [{ id, url }], total }
 */

const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';

async function listProjects({ context }) {
  let page;
  let success = false;

  try {
    page = await context.newPage();
    await page.bringToFront();
    await page.setViewportSize({ width: 1280, height: 1024 });

    await page.goto(BASE, { waitUntil: 'networkidle' });
    await human.sleep(2000);

    const projects = await page.evaluate(() => {
      const links = document.querySelectorAll('a[href*="/project/"]');
      return [...links].map(a => {
        const m = a.href.match(/\/project\/([0-9a-f-]+)/);
        return m ? { id: m[1], url: a.href } : null;
      }).filter(Boolean);
    });

    success = true;
    return { projects, total: projects.length };
  } finally {
    if (success && page) await page.close();
  }
}

module.exports = listProjects;
