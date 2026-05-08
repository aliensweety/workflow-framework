/**
 * probe-dom: 深度探索 Gemini 回复的 DOM 结构
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
  await human.type(page, S.COMPOSER, '今天心情很好');
  await page.waitForTimeout(1000);
  await human.click(page, S.SUBMIT);
  await page.waitForTimeout(12000);

  const info = await page.evaluate(() => {
    const h2s = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = h2s.filter(el => el.textContent.trim() === 'Gemini 说');

    if (geminiH2s.length === 0) {
      return { error: 'no gemini h2 found', allH2Texts: h2s.map(h => h.textContent.trim()) };
    }

    const last = geminiH2s[geminiH2s.length - 1];
    const parent = last.parentElement;

    function path(el) {
      const parts = [];
      while (el && el.tagName) {
        let s = el.tagName.toLowerCase();
        if (el.id) s += '#' + el.id;
        if (el.className && typeof el.className === 'string') {
          const cls = el.className.split(' ')[0];
          if (cls) s += '.' + cls;
        }
        parts.unshift(s);
        el = el.parentElement;
      }
      return parts.join(' > ');
    }

    function getText(el) {
      if (!el) return null;
      // 直接子节点的文字，忽略隐藏元素
      let text = '';
      for (const node of el.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
        else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
          const style = window.getComputedStyle(node);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            text += getText(node);
          }
        }
      }
      return text.trim();
    }

    const siblings = [];
    if (parent) {
      let sib = parent.nextElementSibling;
      let i = 0;
      while (sib && i < 5) {
        siblings.push({
          tag: sib.tagName,
          class: sib.className,
          text: sib.innerText?.slice(0, 200),
          path: path(sib),
        });
        sib = sib.nextElementSibling;
        i++;
      }
    }

    return {
      geminiH2Count: geminiH2s.length,
      headingPath: path(last),
      headingText: getText(last),
      parentPath: parent ? path(parent) : null,
      parentHTML: parent ? parent.outerHTML.slice(0, 300) : null,
      siblings,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.close();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
