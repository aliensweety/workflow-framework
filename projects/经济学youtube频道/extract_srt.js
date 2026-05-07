const fs = require('fs');

function extractSRT(jsonPath, outputPath) {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  let reply = json.reply;

  // Remove all markdown: code blocks, "srt", "复制" prefix lines, thinking lines
  reply = reply.replace(/```[\s\S]*?```/g, '');  // strip code blocks
  reply = reply.replace(/^[一-龥\w]*复制\s*$/gm, '');  // "复制" suffix lines
  reply = reply.replace(/^思考了 \d+s\s*$/gm, '');  // "思考了 Xs" prefix lines
  reply = reply.replace(/^srt\s*$/gim, '');  // "srt" markers
  reply = reply.replace(/^[一-龥]+$/gm, '');  // lone Chinese chars
  reply = reply.trim();

  const lines = reply.split('\n');
  const entries = [];
  let cur = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      if (cur.length > 0) entries.push(cur.join('\n'));
      cur = [trimmed];
    } else if (trimmed.includes('-->')) {
      cur.push(line);
    } else if (trimmed !== '') {
      cur.push(line);
    }
  }
  if (cur.length > 0) entries.push(cur.join('\n'));

  const result = entries.join('\n\n') + '\n';
  fs.writeFileSync(outputPath, result, 'utf8');
  console.log(`Extracted ${entries.length} entries from ${jsonPath}`);
  return entries.length;
}

extractSRT('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p1_grok.json',
           'D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p1.srt');
extractSRT('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p2_grok.json',
           'D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p2.srt');
