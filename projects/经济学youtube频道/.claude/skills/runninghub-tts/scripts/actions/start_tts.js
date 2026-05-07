/**
 * action: start_tts
 * 输入: { context, audioPath, text }
 * 输出: { task_id, status: 'pending', started_at }
 * 失败: 抛 Error。失败时 page 保留现场。
 */

const S = require('../lib/signals');
const human = require('../lib/human');
const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * 等待运行按钮文本变成数字+Standard（表示表单就绪）。
 */
async function waitForRunBtnReady(page, timeout = 30000) {
  const deadline = Date.now() + timeout;
  const runBtn = page.locator(S.RUN_BUTTON);
  while (Date.now() < deadline) {
    const text = (await runBtn.textContent().catch(() => '')).trim();
    if (/^\d+Standard$/.test(text)) return;
    await sleep(500);
  }
  throw new Error('等待运行按钮就绪超时（30s）');
}

/**
 * 关闭可能存在的模态框。
 */
async function closeModals(page, maxAttempts = 3) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const modalVisible = await page.locator('.ant-modal').first().isVisible().catch(() => false);
      if (!modalVisible) break;
      const closeBtnVisible = await page.locator('.ant-modal-close, .ant-modal .ant-btn').first().isVisible().catch(() => false);
      if (closeBtnVisible) {
        await page.locator('.ant-modal-close, .ant-modal .ant-btn').first().click({ force: true });
        await sleep(500);
      }
    } catch (e) { /* ignore single attempt failures */ }
    await sleep(300);
  }
}

/**
 * 展开右侧历史面板（如果处于折叠状态）。
 */
async function ensureHistoryPanelOpen(page) {
  const wrapper = page.locator('.workflow-result-wrap');
  const wrapperClass = await wrapper.getAttribute('class').catch(() => '');
  if (wrapperClass && wrapperClass.includes('hide')) {
    const hideBtn = wrapper.locator('.hide-btn');
    if (await hideBtn.isVisible().catch(() => false)) {
      await hideBtn.click();
      await sleep(500);
    }
  }
}

async function start_tts({ context, audioPath, text }) {
  const startedAt = Date.now();

  if (text.length > 5000) {
    throw new Error(`文本过长（${text.length} 字），RunningHub textarea 上限 5000 字，请缩短后重试`);
  }

  let handed = false;
  let page;

  try {
    page = await context.newPage();
    await page.bringToFront();
    await page.goto(S.APP_URL);
    await page.waitForLoadState('domcontentloaded', { timeout: 15000 });

    // 从 cookie 提取 Authorization（Rh-Accesstoken）
    const authHeader = await page.evaluate(() => {
      const match = document.cookie.match(/Rh-Accesstoken=([^;]+)/);
      return match ? 'Bearer ' + match[1] : null;
    });
    if (!authHeader) {
      throw new Error('无法获取 RunningHub 认证信息，请确认已登录');
    }

    // 等待表单初始化（第二个 textarea 是可见的）
    await page.locator(S.TEXTAREA).nth(1).waitFor({ state: 'visible', timeout: 30000 });
    await sleep(2000); // 等待表单组件渲染完成

    // 关闭可能存在的模态框
    await closeModals(page, 3);

    // 上传音频
    const fileInputs = await page.locator(S.FILE_INPUT).all();
    if (fileInputs.length === 0) throw new Error('未找到音频上传 input');
    await fileInputs[fileInputs.length - 1].setInputFiles(audioPath);

    // 等音频处理完成（按钮变为 NStandard）
    for (let attempt = 0; attempt < 60; attempt++) {
      const btnText = (await page.locator(S.RUN_BUTTON).textContent().catch(() => '')).trim();
      if (/^\d+Standard$/.test(btnText)) break;
      await sleep(1000);
    }
    await sleep(2000); // 表单稳定

    // 用 JS 直接写入 textarea（clipboard paste 对大文本不可靠）
    await page.evaluate((t) => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const visibleTa = textareas.find(ta => ta.offsetParent !== null);
      if (!visibleTa) throw new Error('未找到可见 textarea');
      visibleTa.value = t;
      const tracker = visibleTa._valueTracker;
      if (tracker) tracker.setValue('');
      visibleTa.dispatchEvent(new Event('input', { bubbles: true }));
      visibleTa.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);

    // 再次关闭可能出现的模态框
    await closeModals(page, 2);

    // 确认 textarea 有内容
    const taValue = await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const visibleTa = textareas.find(ta => ta.offsetParent !== null);
      return visibleTa ? visibleTa.value : '';
    });
    if (!taValue || taValue.length < 1) {
      throw new Error('文本未成功填入 textarea');
    }

    // 获取 webappId（从 URL）
    const webappId = S.APP_URL.match(/(\d+)$/)?.[1] || '';

    // 获取音频 hash：从 history panel 的 audio src 中提取
    const audioHash = await page.evaluate(() => {
      const audios = Array.from(document.querySelectorAll('audio'));
      for (const audio of audios) {
        const src = audio.src || '';
        const match = src.match(/\/([a-f0-9]+\.mp3)/i);
        if (match) return match[1];
      }
      // 备选：从 body 中找 mp3 文件名
      const bodyText = document.body.innerText;
      const m = bodyText.match(/([a-f0-9]{32,}\.mp3)/i);
      return m ? m[1] : '';
    });

    // 记录提交前的 taskid 快照（用于 API 直接返回 taskId 时做兜底）
    await ensureHistoryPanelOpen(page);
    const prevBodyText = await page.evaluate(() => document.body.innerText);
    const prevTaskIds = [...prevBodyText.matchAll(/taskid[:：\s]*(\d+)/g)].map(m => m[1]);

    // 直接调 API 提交（绕过按钮点击事件）
    const taskResult = await page.evaluate(async ({ auth, webappId, audioHash, text }) => {
      const resp = await fetch('https://www.runninghub.cn/task/webapp/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': auth
        },
        body: JSON.stringify({
          webappId,
          inputs: [
            { nodeId: '29', nodeName: 'LoadAudio', fieldName: 'audio', fieldValue: audioHash, description: '参考音频' },
            { nodeId: '78', nodeName: 'Text', fieldName: 'text', fieldValue: text, description: '文本' }
          ],
          clientId: Math.random().toString(36).substring(2) + Date.now(),
          usePersonalQueue: false
        })
      });
      const data = await resp.json();
      return data;
    }, { auth: authHeader, webappId, audioHash, text });

    if (taskResult.code === 0 && taskResult.data?.taskId) {
      handed = true;
      return {
        task_id: taskResult.data.taskId,
        status: 'pending',
        started_at: startedAt,
        hint_eta_ms: 90000
      };
    }

    // API 返回非 0，检查错误
    if (taskResult.msg?.includes('积分') || taskResult.msg?.includes('余额')) {
      throw new Error('任务提交失败: 积分不足');
    }
    if (taskResult.msg?.includes('登录')) {
      throw new Error('任务提交失败: 未登录');
    }
    if (taskResult.code !== 0) {
      throw new Error(`任务提交失败: ${taskResult.msg || '未知错误'}`);
    }

    // API 返回 0 但无 taskId，尝试从 body 找
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const bodyText = await page.evaluate(() => document.body.innerText);
      const matches = [...bodyText.matchAll(/taskid[:：\s]*(\d+)/g)];
      for (const match of matches) {
        if (!prevTaskIds.includes(match[1])) {
          handed = true;
          return { task_id: match[1], status: 'pending', started_at: startedAt, hint_eta_ms: 90000 };
        }
      }
    }
    throw new Error('历史记录中未找到新 task，请检查网络和页面状态');
  } finally {
    if (handed && page) await page.close();
  }
}

module.exports = start_tts;