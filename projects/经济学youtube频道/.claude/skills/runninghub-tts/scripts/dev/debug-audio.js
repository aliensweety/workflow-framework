const { connectBrowser } = require('../lib/browser');
const S = require('./lib/signals');

(async () => {
  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.goto(S.APP_URL);
  await page.waitForLoadState('domcontentloaded');
  await new Promise(r => setTimeout(r, 3000));

  const target = '2050955543434145793';
  const result = await page.evaluate(({ tid }) => {
    const items = document.querySelectorAll('.history-item');
    for (const item of items) {
      const idEl = item.querySelector('.history-id');
      const idText = (idEl?.textContent || '').trim();
      if (idText.includes(tid)) {
        const audio = item.querySelector('audio');
        return {
          found: true,
          audioSrcAttr: audio?.getAttribute('src'),
          audioSrcProp: audio?.src,
          audioSrcLen: audio?.src?.length,
        };
      }
    }
    return { found: false };
  }, { tid: target });

  console.log(JSON.stringify(result));
  await page.close();
})().catch(e => { console.error(e.message); process.exit(1); });