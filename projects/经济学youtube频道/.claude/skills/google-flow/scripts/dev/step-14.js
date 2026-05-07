/**
 * step-14.js —— 探索项目创建 + 重命名流程
 * 1. 看首页/项目列表的结构
 * 2. 找"新建项目"按钮
 * 3. 创建一个测试项目
 * 4. 找项目名称编辑位置
 * 5. 尝试重命名
 */

const { connectBrowser } = require('../lib/browser');
const dev = require('../lib/dev');
const human = require('../lib/human');

const BASE = 'https://labs.google/fx/zh/tools/flow';
const URL_TAG = 'step-14';

async function main() {
  const { context } = await connectBrowser();
  await dev.closeOldTabs(context, URL_TAG);

  const page = await context.newPage();
  await page.bringToFront();
  await page.setViewportSize({ width: 1280, height: 1024 });

  // 1. 导航到 Flow 首页（不带 project ID）
  console.log('[1] 导航到 Flow 首页...');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await human.sleep(2000);

  const a11y1 = await page.locator('body').first().ariaSnapshot();
  console.log('[1] 首页 a11y:\n', a11y1.substring(0, 2000));

  // 看有没有"创建项目"或类似按钮
  const createBtns = await page.evaluate(() => {
    const btns = document.querySelectorAll('button, a');
    return [...btns].filter(b => {
      const text = b.textContent?.trim() || '';
      return text.includes('创建') || text.includes('新建') || text.includes('新项目') || text.includes('create');
    }).map(b => ({
      tag: b.tagName,
      text: b.textContent?.trim().substring(0, 60),
      href: b.href?.substring(0, 80),
      ariaLabel: b.getAttribute('aria-label'),
    }));
  });
  console.log('\n[1] 创建相关按钮:', JSON.stringify(createBtns, null, 2));

  // 看首页有没有项目列表
  const projectLinks = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href*="/project/"]');
    return [...links].map(a => ({
      href: a.href,
      text: a.textContent?.trim().substring(0, 60),
    })).slice(0, 10);
  });
  console.log('\n[1] 项目链接:', JSON.stringify(projectLinks, null, 2));

  // 2. 导航到现有项目，看左上角名称
  console.log('\n[2] 导航到现有项目...');
  await page.goto(`${BASE}/project/2b57ce62-e0a3-41d2-bcbc-340b58be3d5e`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[contenteditable="true"]', { timeout: 15000 });
  await human.sleep(1000);

  // 找左上角的名称区域
  const titleArea = await page.evaluate(() => {
    // 找包含"读书频道"文字的元素
    const allElements = document.querySelectorAll('*');
    const results = [];
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === '读书频道' || (text && text.includes('读书频道') && text.length < 20)) {
        results.push({
          tag: el.tagName,
          text: text.substring(0, 60),
          className: el.className?.substring(0, 80),
          contentEditable: el.contentEditable,
          role: el.getAttribute('role'),
          parentTag: el.parentElement?.tagName,
          parentClass: el.parentElement?.className?.substring(0, 80),
          grandParentTag: el.parentElement?.parentElement?.tagName,
        });
      }
    }
    return results;
  });
  console.log('\n[2] 标题区域元素:', JSON.stringify(titleArea, null, 2));

  // 看 navigation 区域的 a11y
  const navA11y = await page.locator('nav, [role="navigation"]').first().ariaSnapshot().catch(() => 'no nav');
  console.log('\n[2] 导航 a11y:\n', navA11y?.substring(0, 500));

  // 看页面顶部区域的完整 DOM（前几个元素）
  const topDom = await page.evaluate(() => {
    const body = document.body;
    // 只看前 3 层
    function dump(node, depth) {
      if (depth > 3 || !node || node.nodeType !== 1) return '';
      const tag = node.tagName?.toLowerCase();
      if (['script', 'style', 'svg', 'path', 'iframe'].includes(tag)) return '';
      const cls = typeof node.className === 'string' ? node.className.substring(0, 40) : '';
      const text = node.childNodes.length === 1 && node.childNodes[0].nodeType === 3
        ? `"${node.textContent?.trim().substring(0, 40)}"`
        : '';
      let result = '  '.repeat(depth) + `<${tag}${cls ? ' class="' + cls + '"' : ''}>${text}\n`;
      const children = [...node.children].slice(0, 5);
      for (const child of children) {
        result += dump(child, depth + 1);
      }
      return result;
    }
    return dump(body, 0).substring(0, 1500);
  });
  console.log('\n[2] 顶部 DOM:\n', topDom);

  // 3. 尝试点击项目名称看能否编辑
  const titleSelector = await page.evaluate(() => {
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent?.trim() === '读书频道' && el.children.length === 0) {
        return {
          found: true,
          tag: el.tagName,
          className: el.className?.substring(0, 80),
          parentTag: el.parentElement?.tagName,
          parentClass: el.parentElement?.className?.substring(0, 80),
        };
      }
    }
    return { found: false };
  });
  console.log('\n[3] 标题元素:', JSON.stringify(titleSelector));

  if (titleSelector.found) {
    // 点击标题看看
    const titleEl = page.locator(`:text("读书频道")`).first();
    await titleEl.click({ force: true });
    await human.sleep(1000);

    // 看有没有变成输入框
    const afterClick = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input[type="text"], input:not([type]), [contenteditable="true"], textarea');
      const results = [...inputs].map(inp => ({
        tag: inp.tagName,
        type: inp.type,
        value: inp.value?.substring(0, 50),
        text: inp.textContent?.trim().substring(0, 50),
        placeholder: inp.placeholder,
      }));
      return results;
    });
    console.log('\n[3] 点击后输入元素:', JSON.stringify(afterClick, null, 2));

    const a11yAfterClick = await page.locator('body').first().ariaSnapshot();
    // 只看包含 dialog 或编辑相关的部分
    const lines = a11yAfterClick.split('\n').filter(l => l.includes('dialog') || l.includes('textbox') || l.includes('读书') || l.includes('编辑'));
    console.log('\n[3] 点击后相关 a11y:', lines.join('\n'));
  }

  await dev.hold();
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
