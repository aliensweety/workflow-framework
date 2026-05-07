/**
 * signals.js —— flow3 skill 的所有 selector
 */

module.exports = {
  // 页面级
  PROMPT_INPUT: '[contenteditable="true"]',
  SETTINGS_BTN: 'button:has-text("Nano Banana")',
  SUBMIT_BTN: 'button:has-text("arrow_forward")',
  ADD_REF_BTN: 'button:has-text("add_2")',

  // 参数面板
  MODEL_DROPDOWN: 'button:has-text("Nano Banana"):has-text("arrow_drop_down")',
  ASPECT_TAB: (ratio) => `button[role="tab"]:has-text("${ratio}")`,
  COUNT_TAB: (count) => `button[role="tab"]:has-text("${count}")`,
  MODEL_OPTION: (name) => `[role="menuitem"]:has-text("${name}")`,

  // 生成状态
  GENERATION_FAILED: ':text("失败")',
  PROGRESS_PERCENT: /\d+%/,

  // 图片交互
  IMAGE_LINK: 'a[href*="/edit/"]',
  IMAGE_IN_GRID: '[data-testid="virtuoso-item-list"]',
  MORE_BTN_IN_GRID: '[data-testid="virtuoso-item-list"] button:has-text("更多")',
  DOWNLOAD_MENUITEM: '[role="menuitem"]:has-text("下载"):not(:has-text("添加"))',
  RESOLUTION_OPTION: (res) => `[role="menuitem"]:has-text("${res}")`,

  // 上传参考图
  UPLOAD_IN_DIALOG: ':text("上传图片")',

  // 首页
  NEW_PROJECT_BTN: 'button:has-text("新建项目")',
  PROJECT_LINK: (uuid) => `a[href*="/project/${uuid}"]`,

  // 失败信号
  LOGIN_URL: '/login',
  ANTIBOT_TEXTS: ['unusual activity', '异常活动', 'verify you are human'],
};
