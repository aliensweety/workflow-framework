/**
 * probe: 直接 evaluate Gemini 页面的 DOM，验证 completion 信号
 */
const { chromium } = require('playwright');

const CDP_ENDPOINT = 'http://localhost:9222';

async function main() {
  const browser = await chromium.connectOverCDP(CDP_ENDPOINT);
  const context = browser.contexts()[0];
  const pages = context.pages();

  const targetPage = pages.find(p => p.url().includes('a15f9828f4457e45'));
  const page = targetPage || await context.newPage();

  if (!targetPage) {
    await page.goto('https://gemini.google.com/app/a15f9828f4457e45');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);
  }

  const result = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll('h2'));
    const geminiH2s = all.filter(el => el.textContent.trim() === 'Gemini 说');
    if (geminiH2s.length === 0) return { h2count: 0, text: '', done: false };

    const lastH2 = geminiH2s[geminiH2s.length - 1];
    const container = lastH2.parentElement;
    if (!container) return { h2count: geminiH2s.length, text: '', done: false, containerNull: true };

    const paragraphs = container.querySelectorAll('p');
    const text = paragraphs.length > 0
      ? Array.from(paragraphs).map(p => p.innerText).join(' ')
      : container.innerText?.trim() || '';

    return {
      h2count: geminiH2s.length,
      text,
      textLen: text.length,
      done: text.length > 5,
      containerTag: container.tagName,
      containerChildren: container.children.length,
    };
  });

  console.error('DOM result:', JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));

  await browser.disconnect();
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
