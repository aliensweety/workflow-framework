const fs = require('fs');

function parseTimestamp(ts) {
  const parts = ts.split(':');
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  const secParts = parts[2].split(',');
  const s = parseInt(secParts[0]);
  const ms = parseInt(secParts[1]);
  return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function formatTimestamp(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msec = ms % 1000;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')},${String(msec).padStart(3,'0')}`;
}

function addTimestampOffset(tsLine, offsetMs) {
  const m = tsLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
  if (!m) return tsLine;
  return `${formatTimestamp(parseTimestamp(m[1]) + offsetMs)} --> ${formatTimestamp(parseTimestamp(m[2]) + offsetMs)}`;
}

function parseSRT(content) {
  const lines = content.trim().split('\n');
  const entries = [];
  let cur = [];
  for (const line of lines) {
    if (/^\d+$/.test(line.trim())) {
      if (cur.length > 0) entries.push(cur.join('\n'));
      cur = [line];
    } else {
      cur.push(line);
    }
  }
  if (cur.length > 0) entries.push(cur.join('\n'));
  return entries;
}

function getLastTimestamp(entries) {
  for (let i = entries.length - 1; i >= 0; i--) {
    const timeMatch = entries[i].match(/\d{2}:\d{2}:\d{2},\d{3}\s*-->\s*\d{2}:\d{2}:\d{2},\d{3}/);
    if (timeMatch) return parseTimestamp(timeMatch[0].split('-->')[1].trim());
  }
  return 0;
}

// p1 end time from raw
const rawP1 = fs.readFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/raw_p1.srt', 'utf8');
const rawP2 = fs.readFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/raw_p2.srt', 'utf8');
const raw1Entries = parseSRT(rawP1);
const raw2Entries = parseSRT(rawP2);

// p1 ends when p2 starts - use raw_p1's last end timestamp + 1s gap
const p1EndMs = getLastTimestamp(raw1Entries) + 1000;
console.log('p1 end ms:', p1EndMs, '= roughly', Math.floor(p1EndMs / 60000), 'min', Math.floor((p1EndMs % 60000)/1000), 'sec');

// p2 corrected, renumber 52-102, offset timestamps
const p2Corr = fs.readFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p2.srt', 'utf8');
const p2Entries = parseSRT(p2Corr);

const offsetP2 = p2Entries.map((entry, i) => {
  const lines = entry.split('\n');
  const newNum = 52 + i;
  const newTime = addTimestampOffset(lines[1], p1EndMs);
  const text = lines.slice(2).join('\n');
  return `${newNum}\n${newTime}\n${text}`;
});

const p1Corr = fs.readFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles_p1.srt', 'utf8');
const final = p1Corr.trim() + '\n\n' + offsetP2.join('\n\n');
fs.writeFileSync('D:/cc内容项目/workflow-framework/projects/经济学youtube频道/runs/2026-05-06_新流程测试/subtitles.srt', final, 'utf8');

const allEntries = parseSRT(final);
console.log('Total entries:', allEntries.length, '| First:', allEntries[0].split('\n').slice(0,2).join(' | '), '| Last:', allEntries[allEntries.length-1].split('\n').slice(0,2).join(' | '));
