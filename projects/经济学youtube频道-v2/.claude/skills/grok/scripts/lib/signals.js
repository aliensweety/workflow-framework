/**
 * signals.js —— grok skill 所有 selector 集中管理。
 * walkthrough 阶段确认的 selector 写在这里，来源可追溯到对应 dev step。
 */

// 命令行参数 → 菜单实际文本（has-text 大小写敏感，必须用菜单实际文本）
const MODEL_LABELS = {
  'auto':     'Auto',
  'fast':     'Fast',
  'expert':   'Expert',
  'grok-4.3': 'Grok 4.3 (beta)',
  'heavy':    'Heavy',
};

module.exports = {
  // ── 附件上传：隐藏 file input ──
  // 来源: dev/step-upload.js
  ATTACHMENT_INPUT: 'input[type="file"]',
  ATTACHMENTS_LIST: '[role="list"]',

  // ── 段 A：输入框（TipTap/ProseMirror contenteditable）──
  // 来源: dev/step-A.js
  COMPOSER: 'div.ProseMirror[contenteditable="true"]',

  // ── 段 D：提交按钮（enabled 状态，等这个才点）──
  // 来源: dev/step-C.js
  SUBMIT: 'button[aria-label="Submit"]',
  SUBMIT_ENABLED: 'button[aria-label="Submit"]:not([disabled])',

  // ── 段 C：模型选择 ──
  // 来源: dev/step-E.js
  MODEL_SELECT: 'button[aria-label="Model select"]',

  // 模型选项（自动映射命令行参数 → 菜单实际文本）
  // 菜单结构: [role="menuitem"] > span:text-is("模型名") + span:text-is("描述")
  // 用 has(span:text-is(...)) 精确匹配模型名 span，避免 has-text 误匹配描述文本（如 "Fast" 会匹配到 Auto 菜单的描述）
  modelOption: (name) => `[role="menuitem"]:has(span:text-is("${MODEL_LABELS[name] || name}"))`,

  // ── 段 F：回复完成信号（仅 assistant 回复有）──
  // 来源: dev/step-D.js
  REPLY_DONE: 'button[aria-label="赞"]',

  // ── 段 F：失败信号 ──
  // 来源: dev/step-D.js（03 walkthrough 反爬观察）
  ANTIBOT: '[aria-label*="verify you are human"], [aria-label*="captcha"], [aria-label*="unusual"]',
  RATE_LIMIT: '[role="alert"]:has-text("rate limit"), [role="alert"]:has-text("too many requests")',
};
