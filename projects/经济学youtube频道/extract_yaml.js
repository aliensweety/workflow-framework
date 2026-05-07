const fs = require('fs');
const json = JSON.parse(fs.readFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/segments_grok.json', 'utf8'));
let yaml = json.reply;
yaml = yaml.replace(/^YAML\n?/i, '').replace(/```\n?$/, '').replace(/思考了 \d+s\n?/g, '').replace(/^[一-龥]*复制\s*$/gm, '').trim();
fs.writeFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/manifest.yaml', yaml, 'utf8');
console.log('done, chars:', yaml.length);
