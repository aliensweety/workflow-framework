/**
 * step-14: 测试 start_chat + get_chat 异步轮询
 * node skills/gemini/scripts/dev/step-14.js
 *
 * 验证：submit → 立即返回 → 轮询 get_chat 直到 completed
 */

const { connectBrowser } = require('../lib/browser');

async function main() {
  const { context } = await connectBrowser();
  const startChat = require('../actions/start_chat');
  const getChat = require('../actions/get_chat');

  console.error('[step-14] 1. start_chat (立即返回)...');
  const startResult = await startChat({
    context,
    prompt: 'Why is the sky blue?',
    model: 'fast',
  });
  console.error('[step-14] startResult:', JSON.stringify(startResult));
  console.log(JSON.stringify(startResult));

  const maxWait = 120000;
  const interval = 3000;
  const startedAt = Date.now();

  console.error('[step-14] 2. 轮询 get_chat...');
  while (true) {
    const elapsed = Date.now() - startedAt;
    if (elapsed > maxWait) {
      console.error('[step-14] 超时');
      break;
    }
    await new Promise(r => setTimeout(r, interval));

    const result = await getChat({ context, conversation_id: startResult.conversation_id });
    console.error(`[step-14] getChat status=${result.status}, elapsed=${Date.now() - startedAt}ms`);

    if (result.status === 'completed') {
      console.error('[step-14] 完成!');
      console.error('[step-14] 最终结果:', JSON.stringify(result));
      console.log(JSON.stringify(result));
      break;
    }
  }
}

main().catch(err => {
  console.error('[step-14] 失败:', err.message);
  process.exit(1);
});
