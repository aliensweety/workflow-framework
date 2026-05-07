/**
 * signals.js
 * --------------------------------------------------
 * skill 的所有 selector 集中放这里。
 * 04-incremental-build 阶段每 probe 出一个可用 selector 就加进来。
 *
 * 命名约定：大写 SNAKE_CASE，名字描述"信号"语义而不是元素细节。
 *
 * 例:
 *   COMPOSER          = 输入框就绪信号
 *   GENERATING        = 提交后正在生成的信号
 *   REPLY_DONE        = 回复完成信号
 *   FAILURE_RATE_LIMIT = 失败信号：rate limit
 */

module.exports = {
  // 输入框（div.ql-editor，aria-label="为 Gemini 输入提示"）
  COMPOSER: 'div.ql-editor[aria-label="为 Gemini 输入提示"]',
  // 发送按钮
  SUBMIT: 'button[aria-label="发送"]',
  // 模型选择器（点击展开菜单）
  MODEL_SELECTOR: 'button[aria-label="打开模式选择器"]',
  // 模型选项（动态，role=menuitem）
  MODEL_OPTION: (name) => `[role="menuitem"]:has-text("${name}")`,

  // 模型参数 → 菜单显示名 映射
  MODEL_MAP: {
    fast: '快速',
    think: '思考',
    pro: 'Pro',
  },
  // 工具菜单（aria-label DOM 属性不存在，用 text 找）
  TOOLS_MENU: 'button:has-text("工具")',
  // 工具选项（动态，role=menuitemcheckbox 用 getByRole）
  TOOL_OPTION: (name) => `[role="menuitemcheckbox"]:has-text("${name}")`,
  // 临时对话按钮
  TEMPORARY_CHAT: 'button[aria-label="临时对话"]',
  // 新建对话链接
  NEW_CHAT: 'a[href="/app"]',
  // Gemini 回复容器（heading "Gemini 说"）
  GEMINI_REPLY: 'heading[aria-level="2"]:has-text("Gemini 说")',
  // 输入框（a11y textbox）
  TEXTBOX: 'textbox[aria-label="为 Gemini 输入提示"]',
};
