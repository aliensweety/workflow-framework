/**
 * step-15: 测试 start_chat + get_chat 带文件上传
 * node skills/gemini/scripts/dev/step-15.js
 */

const { connectBrowser } = require('../lib/browser');
const path = require('path');

async function main() {
  const { context } = await connectBrowser();
  const startChat = require('../actions/start_chat');
  const getChat = require('../actions/get_chat');

  // 用测试文档
  const testFile = path.resolve(__dirname, '../dev/test-doc.md');
  console.error('[step-15] 文件:', testFile);

  console.error('[step-15] 1. start_chat with file...');
  const startResult = await startChat({
    context,
    prompt: '描述这张图片',
    model: 'fast',
    files: [testFile],
  });
  console.error('[step-15] startResult:', JSON.stringify(startResult));

  // 轮询
  const maxWait = 120000;
  const startedAt = Date.now();
  while (true) {
    if (Date.now() - startedAt > maxWait) break;
    await new Promise(r => setTimeout(r, 5000));
    const result = await getChat({ context, conversation_id: startResult.conversation_id });
    console.error(`[step-15] status=${result.status}`);
    if (result.status === 'completed') {
      console.error('[step-15] 完成:', result.text?.slice(0, 200));
      console.log(JSON.stringify(result));
      break;
    }
  }
}

main().catch(err => {
  console.error('[step-15] 失败:', err.message);
  process.exit(1);
});
