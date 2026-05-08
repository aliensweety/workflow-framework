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

    // 上传音频。RunningHub 不在 DOM 里渲染参考音频的 hash，必须从 /upload/image
    // 响应里直接抓——历史里的 <audio> 元素是上一次任务的输出 FLAC，绝对不能用作 audioHash。
    const fileInputs = await page.locator(S.FILE_INPUT).all();
    if (fileInputs.length === 0) throw new Error('未找到音频上传 input');

    const uploadResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/upload/image') && resp.request().method() === 'POST',
      { timeout: 60000 }
    );
    await fileInputs[fileInputs.length - 1].setInputFiles(audioPath);

    let uploadedAudioName = null;
    try {
      const uploadResp = await uploadResponsePromise;
      const uploadJson = await uploadResp.json();
      uploadedAudioName = uploadJson?.name || null;
    } catch (err) {
      throw new Error(`参考音频上传失败：未捕获到 /upload/image 响应（${err.message}）`);
    }
    if (!uploadedAudioName) {
      throw new Error('参考音频上传响应中没有 name 字段');
    }

    // 等音频处理完成（按钮变为 NStandard）
    for (let attempt = 0; attempt < 60; attempt++) {
      const btnText = (await page.locator(S.RUN_BUTTON).textContent().catch(() => '')).trim();
      if (/^\d+Standard$/.test(btnText)) break;
      await sleep(1000);
    }
    await sleep(2000); // 表单稳定

    // 先清空 textarea 旧内容，再写入新文本。
    // 不能直接覆盖 .value——RunningHub 在某些情况下 React 会把字段值合并/恢复，
    // 必须先 select-all + delete 走完整的 input 事件链，让 React state 真清掉。
    await page.evaluate((t) => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const visibleTa = textareas.find(ta => ta.offsetParent !== null);
      if (!visibleTa) throw new Error('未找到可见 textarea');
      // 先用 React 兼容方式清空
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(visibleTa, '');
      else visibleTa.value = '';
      visibleTa.dispatchEvent(new Event('input', { bubbles: true }));
      visibleTa.dispatchEvent(new Event('change', { bubbles: true }));
      // 再写入新文本
      if (setter) setter.call(visibleTa, t);
      else visibleTa.value = t;
      visibleTa.dispatchEvent(new Event('input', { bubbles: true }));
      visibleTa.dispatchEvent(new Event('change', { bubbles: true }));
    }, text);

    // 再次关闭可能出现的模态框
    await closeModals(page, 2);

    // 确认 textarea 内容确实是本次传入的 text（防御 React state 把字段恢复成旧值）
    const taValue = await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll('textarea'));
      const visibleTa = textareas.find(ta => ta.offsetParent !== null);
      return visibleTa ? visibleTa.value : '';
    });
    if (!taValue || taValue.length < 1) {
      throw new Error('文本未成功填入 textarea');
    }
    if (taValue !== text) {
      throw new Error(
        `textarea 内容与 --text 不一致：期望 ${text.length} 字 / 实际 ${taValue.length} 字。` +
        `前 80 字对照：期望"${text.slice(0, 80)}" 实际"${taValue.slice(0, 80)}"`
      );
    }

    // 获取 webappId（从 URL）
    const webappId = S.APP_URL.match(/(\d+)$/)?.[1] || '';

    // 记录提交前的 taskid 快照（用于 API 直接返回 taskId 时做兜底）
    await ensureHistoryPanelOpen(page);
    const prevBodyText = await page.evaluate(() => document.body.innerText);
    const prevTaskIds = [...prevBodyText.matchAll(/taskid[:：\s]*(\d+)/g)].map(m => m[1]);

    // 直接调 API 提交（绕过按钮点击事件）。
    // audioHash 必须用本次 /upload/image 响应里的 name——任何"从 DOM 取"的尝试都会
    // 拿到上一次任务的结果 FLAC，导致后端用其它 ref-audio 的默认值生成。
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
    }, { auth: authHeader, webappId, audioHash: uploadedAudioName, text });

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