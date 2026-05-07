/**
 * signals.js —— runninghub-tts 的所有 selector
 */

const APP_URL = 'https://www.runninghub.cn/ai-detail/2021845015110094849';

module.exports = {
  APP_URL,

  // 输入参数区域
  TEXTAREA: 'textarea',                                  // 文本输入框（页面上有 2 个，用 .last()）
  FILE_INPUT: 'input[type="file"][accept="audio/*"]',    // 隐藏的音频上传 input（有 2 个，用 .last()）
  RUN_BUTTON: 'div.ai-btn-run',                          // 运行按钮

  // 运行中任务浮动面板
  RUNNING_TASK: 'div[class*="rh-task-item"], [class*="running-task"]',  // 运行中任务容器（完成后消失）
  RUNNING_STATUS: 'div.task-status-running',             // "生成中 XX:XX"
  TASK_ID_IN_PANEL: 'div.rh-task-id',                    // 面板里的 taskid
  // 历史记录（根据实际 DOM 结构）
  HISTORY_ITEM: '[class*="history-panel"] > div, [class*="history-detail"] > div',  // 每条历史记录
  HISTORY_TASK_ID: '[class*="history-panel"] > div [class*="item"]:first-child',     // 历史记录中的 taskid（第1个item就是最新的）
  HISTORY_AUDIO: '[class*="history-panel"] audio, [class*="history-detail"] audio', // 历史记录中的 audio 元素
  // 运行后新任务标识（history 面板顶部正在生成的任务）
  NEW_TASK_PANEL: '[class*="history-panel"] [class*="item"]:first-child, [class*="history-detail"] [class*="item"]:first-child, [class*="rh-task-item"]',

  // 积分
  COIN_AMOUNT: 'div.coin-amount',
};
