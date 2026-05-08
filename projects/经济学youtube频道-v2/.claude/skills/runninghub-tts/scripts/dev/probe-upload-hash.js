/**
 * probe-upload-hash.js —— 上传 ref-audio 后，找出 audio hash 在 DOM 哪里
 */

const path = require('path');
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const refAudio = process.argv[2];
  if (!refAudio) { console.error('用法: probe-upload-hash.js <ref-audio>'); process.exit(1); }
  const absRefAudio = path.resolve(refAudio);

  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.bringToFront();
  await page.goto(S.APP_URL);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await sleep(3000);

  // 先观察网络请求
  const requests = [];
  page.on('request', (req) => {
    const url = req.url();
    if (url.includes('upload') || url.includes('audio') || url.includes('runninghub')) {
      requests.push({ method: req.method(), url, postData: req.postData()?.slice(0, 200) || null });
    }
  });
  const responses = [];
  page.on('response', async (resp) => {
    const url = resp.url();
    if (url.includes('upload') || url.includes('audio')) {
      try {
        const ct = resp.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await resp.text().catch(() => '');
          responses.push({ status: resp.status(), url, body: body.slice(0, 500) });
        }
      } catch (e) {}
    }
  });

  // 上传
  const fileInputs = await page.locator(S.FILE_INPUT).all();
  await fileInputs[fileInputs.length - 1].setInputFiles(absRefAudio);
  await sleep(8000);

  console.log('=== upload-related requests ===');
  console.log(JSON.stringify(requests, null, 2));
  console.log('=== upload-related responses ===');
  console.log(JSON.stringify(responses, null, 2));

  // 在 DOM 里搜所有 .mp3 出现位置
  const hashLocations = await page.evaluate(() => {
    const results = [];
    // 1) 所有元素的属性
    document.querySelectorAll('*').forEach((el) => {
      for (const attr of el.attributes || []) {
        if (/\.mp3/i.test(attr.value) || /\.flac/i.test(attr.value)) {
          results.push({
            kind: 'attr',
            tag: el.tagName,
            cls: (el.className || '').toString().slice(0, 60),
            attrName: attr.name,
            attrValue: attr.value.slice(0, 200),
          });
        }
      }
    });
    // 2) 文本节点
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const t = node.nodeValue || '';
      if (/[a-f0-9]{20,}\.(mp3|flac|wav)/i.test(t)) {
        results.push({
          kind: 'text',
          parentTag: node.parentElement?.tagName,
          parentCls: (node.parentElement?.className || '').toString().slice(0, 60),
          text: t.slice(0, 200),
        });
      }
    }
    return results;
  });
  console.log('=== hash locations in DOM ===');
  console.log(JSON.stringify(hashLocations, null, 2));

  // body.innerText 里所有 hash
  const bodyMatches = await page.evaluate(() => {
    const text = document.body.innerText;
    const mp3 = [...text.matchAll(/([a-f0-9]{20,}\.mp3)/gi)].map(m => m[1]);
    const flac = [...text.matchAll(/([a-f0-9]{20,}\.flac)/gi)].map(m => m[1]);
    return { mp3, flac };
  });
  console.log('=== body matches ===');
  console.log(JSON.stringify(bodyMatches, null, 2));

  process.exit(0);
})().catch(e => { console.error('[probe]', e.message); process.exit(1); });
