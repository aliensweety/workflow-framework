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
 * 用 body.innerText 检测（CDP 实时 DOM）。
 */
async function findTaskInHistory(page, taskId) {
  return page.evaluate((tid) => {
    const bodyText = document.body.innerText;
    // 找所有 taskid:数字
    const allMatches = [...bodyText.matchAll(/taskid[:：\s]*(\d+)/g)];
    for (const match of allMatches) {
      if (match[1] === String(tid)) {
        // 找到了 taskid → 在 DOM 中找对应 item 的 audio
        const taskidEls = document.querySelectorAll('*');
        for (const el of taskidEls) {
          const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (text.includes(`taskid: ${tid}`) || text.includes(`taskid：${tid}`)) {
            // 向上找历史记录 item
            let parent = el.closest('[class*="history-panel"] > div, [class*="history-detail"] > div, [class*="history-item"]');
            if (!parent) {
              // 尝试找包含该 taskid 的父级 div（history item wrapper）
              parent = el.parentElement?.parentElement;
            }
            if (parent) {
              const audio = parent.querySelector('audio');
              const src = audio?.src || null;
              // 检查 audio 是否可播放（has src 且不是空字符串）
              const hasAudio = src && src.length > 0 && !src.includes('undefined');
              return { found: true, hasAudio, audioSrc: hasAudio ? src : null };
            }
          }
        }
        // taskid 在 body 中找到但 DOM 结构定位失败，仍算 found
        return { found: true, hasAudio: false, audioSrc: null };
      }
    }
    // taskid 不在 body 中
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

    const deadline = waitSec > 0 ? Date.now() + waitSec * 1000 : 0;

    while (true) {
      // 检查 task 是否在历史记录中
      const result = await findTaskInHistory(page, task_id);

      if (!result.found) {
        // taskid 不在历史面板中
        const running = await hasRunningTask(page);
        if (running) {
          // 可能在排队/生成中
          if (deadline && Date.now() >= deadline) {
            return { task_id, status: 'running', note: `wait ${waitSec}s exceeded` };
          }
          await human.sleep(3000);
          continue;
        }
        return { task_id, status: 'not_found' };
      }

      if (!result.hasAudio) {
        // task 存在但还没生成完
        if (deadline && Date.now() >= deadline) {
          return { task_id, status: 'running', note: `wait ${waitSec}s exceeded` };
        }
        await human.sleep(3000);
        continue;
      }

      // 有 audio.src → 完成，下载
      if (outputPath) {
        const resolved = path.resolve(outputPath);
        fs.mkdirSync(path.dirname(resolved), { recursive: true });
        await downloadFile(result.audioSrc, resolved);
        const stats = fs.statSync(resolved);
        return { task_id, status: 'completed', result: { file_path: resolved, file_size: stats.size } };
      }
      return { task_id, status: 'completed', result: { audio_url: result.audioSrc } };
    }
  } finally {
    if (opened && page) await page.close();
  }
}

module.exports = get_tts;