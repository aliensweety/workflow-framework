/**
 * action: get_tts
 * 输入: { context, task_id, outputPath }
 * 输出: { task_id, status, result?, error? }
 *
 * 状态判断逻辑（CDP 模式）：
 * - 读 body.innerText 找历史记录中的 taskid
 * - taskid 存在 + audio 标签有 src → completed
 * - taskid 存在 + 无 audio/src → running
 * - taskid 不存在 → running（有运行面板中的任务）或 not_found
 */

const S = require('../lib/signals');
const human = require('../lib/human');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      return reject(new Error(`Invalid download URL: ${url}`));
    }
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadFile(res.headers.location, dest).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`下载失败 HTTP ${res.statusCode}`));
      }
      const stream = fs.createWriteStream(dest);
      res.pipe(stream);
      stream.on('finish', () => resolve(dest));
      stream.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * 在历史面板中查找指定 taskid 的记录，返回 audio src。
 *
 * 重要：必须用精确容器 `.history-item` 来圈定 item 边界。早期版本走 `el.closest()` +
 * `parentElement?.parentElement` 兜底，会跨越 item 边界把别的 task 的 audio.src 误匹配过来——
 * 现象是 task A 的 task_id 拿到 task B 的输出 url，文件大小/时长完全不符。
 */
async function findTaskInHistory(page, taskId) {
  return page.evaluate((tid) => {
    const items = document.querySelectorAll('.history-item');
    if (items.length === 0) {
      // 历史面板没渲染（可能折叠或没加载完）
      return { found: false, reason: 'no-history-items' };
    }
    for (const item of items) {
      const text = item.textContent || '';
      // 用精确字面量匹配，避免 taskid 子串误命中（如 12345 命中 123456）
      if (!(text.includes(`taskid: ${tid}`) || text.includes(`taskid：${tid}`))) continue;
      const audio = item.querySelector('audio');
      const src = audio?.src || audio?.getAttribute('src') || null;
      const hasAudio = !!(src && src.length > 0 && !src.includes('undefined'));
      return { found: true, hasAudio, audioSrc: hasAudio ? src : null };
    }
    return { found: false };
  }, taskId);
}

/**
 * 检查是否有运行中的任务（队列中的任务）
 */
async function hasRunningTask(page) {
  const bodyText = await page.evaluate(() => document.body.innerText);
  // "生成中 XX:XX" 或 "排队中" 或 "等待中"
  return bodyText.includes('生成中') || bodyText.includes('排队') || bodyText.includes('等待');
}

async function get_tts({ context, task_id, outputPath, waitSec = 0 }) {
  let page;
  let opened = false;

  try {
    // 先找已有 tab
    const existing = context.pages().find(p => p.url().includes(S.APP_URL));
    if (existing) {
      page = existing;
    } else {
      page = await context.newPage();
      opened = true;
      await page.bringToFront();
      await page.goto(S.APP_URL);
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 });
      await human.sleep(2000);
    }

    // 等历史面板渲染出至少一个 .history-item（新 tab 默认折叠的情况）
    for (let i = 0; i < 10; i++) {
      const count = await page.evaluate(() => document.querySelectorAll('.history-item').length);
      if (count > 0) break;
      await human.sleep(1000);
    }

    const deadline = waitSec > 0 ? Date.now() + waitSec * 1000 : 0;

    while (true) {
      // 检查 task 是否在历史记录中
      const result = await findTaskInHistory(page, task_id);

      if (!result.found) {
        // taskid 不在历史面板中。两种可能：
        //  a) 任务真的不存在（没提交成功，或 task_id 写错）
        //  b) 任务还在排队/刚提交，history 列表还没刷新出来
        // 调用方传了 --wait 时优先按 (b) 处理：保持轮询而非立刻 return not_found。
        // 等到 deadline 才放弃，避免"刚提交完立即查"误报 not_found。
        if (waitSec > 0) {
          if (Date.now() >= deadline) {
            return { task_id, status: 'not_found', note: `wait ${waitSec}s exceeded, taskid never appeared in history` };
          }
          await human.sleep(3000);
          continue;
        }
        // 不带 --wait 时区分一下：有运行中任务返回 running，没有才返回 not_found
        const running = await hasRunningTask(page);
        return running
          ? { task_id, status: 'running', note: 'taskid not yet in history but a task is running' }
          : { task_id, status: 'not_found' };
      }

      if (!result.hasAudio) {
        // task 存在但还没生成完
        if (deadline && Date.now() >= deadline) {
          return { task_id, status: 'running', note: `wait ${waitSec}s exceeded` };
        }
        await human.sleep(3000);
        continue;
      }

      // 有 audio.src → 完成，下载。
      // RunningHub 的输出始终是 FLAC 容器（即使 audio.src 不是 .flac 后缀）。
      // 按 audio.src 的实际后缀（兜底 .flac）写盘，忽略调用方传入的后缀，避免
      // ".mp3 实际是 FLAC" 那种假象坑下游严格按后缀判断格式的工具。
      if (outputPath) {
        const resolved = path.resolve(outputPath);
        const urlExtMatch = result.audioSrc.match(/\.(flac|mp3|wav|ogg|m4a)(?:\?|$)/i);
        const realExt = '.' + (urlExtMatch ? urlExtMatch[1].toLowerCase() : 'flac');
        const basename = path.basename(resolved, path.extname(resolved));
        const finalPath = path.join(path.dirname(resolved), basename + realExt);
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        await downloadFile(result.audioSrc, finalPath);
        const stats = fs.statSync(finalPath);
        return { task_id, status: 'completed', result: { file_path: finalPath, file_size: stats.size } };
      }
      return { task_id, status: 'completed', result: { audio_url: result.audioSrc } };
    }
  } finally {
    if (opened && page) await page.close();
  }
}

module.exports = get_tts;