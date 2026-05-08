/**
 * probe-audio-elements.js —— dump 上传 ref-audio 前后页面所有 audio 元素的状态。
 * 目的：验证 audioHash 在上传组件 / history 里到底分别长什么样，以及 querySelectorAll('audio')
 * 遍历顺序拿到的是谁的 hash。
 *
 * 用法：node .claude/skills/runninghub-tts/scripts/dev/probe-audio-elements.js <ref-audio-path>
 */

const path = require('path');
const { connectBrowser } = require('../lib/browser');
const S = require('../lib/signals');

const sleep = ms => new Promise(r => setTimeout(r, ms));

function dumpAudios(page, label) {
  return page.evaluate((label) => {
    const audios = Array.from(document.querySelectorAll('audio'));
    const dump = audios.map((a, idx) => {
      const src = a.src || '';
      const srcAttr = a.getAttribute('src') || '';
      // 找最近的有 data-* 或 id 的祖先做位置标记
      let ancestorTag = '';
      let cur = a.parentElement;
      let hops = 0;
      while (cur && hops < 6) {
        const cls = cur.className || '';
        const id = cur.id || '';
        if (cls || id) { ancestorTag = `${cur.tagName}.${cls || id}`; break; }
        cur = cur.parentElement;
        hops++;
      }
      // 用更高的祖先（看是上传区还是 history）
      let inUpload = false, inHistory = false;
      let p = a.parentElement;
      let h = 0;
      while (p && h < 12) {
        const txt = (p.textContent || '').slice(0, 50);
        const cls = (p.className || '').toString();
        if (cls.includes('history') || txt.includes('历史记录')) inHistory = true;
        if (cls.includes('upload') || txt.includes('参考音频')) inUpload = true;
        p = p.parentElement;
        h++;
      }
      return { idx, src, srcAttr, ancestorTag, inUpload, inHistory, srcLen: src.length };
    });
    return { label, count: audios.length, dump };
  }, label);
}

(async () => {
  const refAudio = process.argv[2];
  if (!refAudio) {
    console.error('用法: node probe-audio-elements.js <ref-audio.mp3>');
    process.exit(1);
  }
  const absRefAudio = path.resolve(refAudio);

  const { context } = await connectBrowser();
  const page = await context.newPage();
  await page.bringToFront();
  await page.goto(S.APP_URL);
  await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
  await sleep(3000);

  console.log('=== BEFORE upload ===');
  console.log(JSON.stringify(await dumpAudios(page, 'before'), null, 2));

  // 上传 ref-audio
  const fileInputs = await page.locator(S.FILE_INPUT).all();
  console.log(`fileInputs count: ${fileInputs.length}`);
  await fileInputs[fileInputs.length - 1].setInputFiles(absRefAudio);
  await sleep(5000);

  console.log('=== AFTER upload (5s) ===');
  console.log(JSON.stringify(await dumpAudios(page, 'after-5s'), null, 2));

  await sleep(8000);
  console.log('=== AFTER upload (13s) ===');
  console.log(JSON.stringify(await dumpAudios(page, 'after-13s'), null, 2));

  // 顺便 dump 一下 input/textarea 元素状态
  const inputs = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('input[type="file"]')).map((el, i) => ({
      idx: i,
      accept: el.accept,
      visible: el.offsetParent !== null,
      ancestorClass: (el.parentElement?.className || '').toString().slice(0, 80),
    }));
  });
  console.log('=== file inputs ===');
  console.log(JSON.stringify(inputs, null, 2));

  // 留 tab 让你能在 Chrome 看现场，不 close
  console.log('页面保留，自行检查后手动关 tab');
  process.exit(0);
})().catch(e => { console.error('[probe]', e.message); process.exit(1); });
