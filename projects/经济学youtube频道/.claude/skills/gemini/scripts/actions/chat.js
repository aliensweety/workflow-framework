/**
 * action: chat
 * 输入: { context, prompt, model?, files?, tool?, conversation_id?, temporary? }
 * 输出: { text, images, model, took_ms, conversation_id }
 *
 * 内部实现：start_chat 提交 → get_chat 轮询直到完成。
 * page 由 start_chat/get_chat 管理生命周期（保持 open）；失败时 page 留作现场。
 */

const startChat = require('./start_chat');
const getChat = require('./get_chat');

async function chat({ context, prompt, model, files, tool, conversation_id, temporary }) {
  const startedAt = Date.now();

  // ── 工具切换（仅影响 model 描述）──
  let effectiveModel = model || 'fast';
  if (tool === 'deep_research') effectiveModel = 'pro';

  // ── 步骤一：提交 prompt，立即返回 ──
  const startResult = await startChat({
    context, prompt, model: effectiveModel, files, conversation_id, temporary,
  });

  // ── 步骤二：轮询直到回复完成 ──
  const maxWaitMs = 120000;
  const pollInterval = 3000;
  let finalResult;

  while (true) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > maxWaitMs) {
      throw new Error(`Reply timeout after ${maxWaitMs}ms`);
    }

    const chatResult = await getChat({ context, conversation_id: startResult.conversation_id });

    if (chatResult.status === 'completed') {
      finalResult = chatResult;
      break;
    }

    // 还在生成中，短暂等待后再查
    await new Promise(r => setTimeout(r, pollInterval));
  }

  return {
    text: finalResult.text,
    images: finalResult.images || [],
    model: finalResult.model_used || effectiveModel,
    took_ms: Date.now() - startedAt,
    conversation_id: startResult.conversation_id,
  };
}

module.exports = chat;
