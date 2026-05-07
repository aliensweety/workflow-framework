/**
 * probe-reply: 看真实 DOM 里 "Gemini 说" heading 和回复内容的关系
 */
const { connectBrowser } = require('../lib/browser');
const human = require('../lib/human');
const S = require('../lib/signals');

(async () => {
  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.goto('https://gemini.google.com/app');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector(S.COMPOSER, { timeout: 10000 });
  await human.type(page, S.COMPOSER, '测试回复');
  await page.waitForTimeout(1000);

  const btnInfo = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const send = btns.find(b => b.getAttribute('aria-label') === '发送');
    return {
      sendBtnFound: !!send,
      sendBtnHTML: send ? send.outerHTML.slice(0, 200) : null,
      allAriaLabels: btns.map(b => b.getAttribute('aria-label')).filter(Boolean),
    };
  });
  console.log('[btn info]', JSON.stringify(btnInfo, null, 2));

  await human.click(page, S.SUBMIT);
  console.log('[submitted]');

  await page.waitForTimeout(8000);

  const info = await page.evaluate(() => {
    // 找所有有 role=heading aria-level=2 的元素
    const all = Array.from(document.querySelectorAll('[role="heading"][aria-level="2"]'));
    console.log('[debug] heading count:', all.length);
    const geminiHeadings = all.filter(el => el.textContent.trim() === 'Gemini 说');
    console.log('[debug] gemini headings:', geminiHeadings.length);

    if (geminiHeadings.length === 0) {
      // 尝试用 textContent 搜索
      const allH2 = Array.from(document.querySelectorAll('h2, [role="heading"]'));
      return {
        h2count: allH2.length,
        h2texts: allH2.map(el => el.textContent.trim().slice(0, 50)),
      };
    }

    const last = geminiHeadings[geminiHeadings.length - 1];
    const parent = last.parentElement;
    const container = parent ? parent.nextElementSibling : null;

    function getPath(el) {
      const parts = [];
      while (el && el.tagName) {
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.className && typeof el.className === 'string') s += '.' + el.className.split(' ')[0];
        parts.unshift(s);
        el = el.parentElement;
      }
      return parts.join(' > ');
    }

    return {
      headingPath: getPath(last),
      headingText: last.textContent,
      parentPath: parent ? getPath(parent) : null,
      containerPath: container ? getPath(container) : null,
      containerText: container ? container.innerText?.slice(0, 300) : null,
    };
  });

  console.log('[reply info]', JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
