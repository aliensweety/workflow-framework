/**
 * probe.js
 * --------------------------------------------------
 * 通用 DOM 探针。04-incremental-build 阶段的 probe 脚本用、
 * 业务脚本失败时也可以调来 dump 现场。
 *
 * 设计原则：每个函数都封装了 page.evaluate，输入 page + 参数，
 * 输出元素信息并打印到 stdout。可选保存为 JSON 文件。
 */

const fs = require('fs');
const path = require('path');

const SKILL_ROOT = path.resolve(__dirname, '..', '..');
const OUT_DIR = path.join(SKILL_ROOT, 'runtime', 'probe-output');

function makeSnapshot(el) {
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName,
    id: el.id || null,
    class: el.className || null,
    role: el.getAttribute('role'),
    ariaLabel: el.getAttribute('aria-label'),
    ariaHidden: el.getAttribute('aria-hidden'),
    placeholder: el.getAttribute('placeholder'),
    contentEditable: el.getAttribute('contenteditable'),
    text: (el.textContent || '').trim().slice(0, 100),
    visible: rect.width > 0 && rect.height > 0 && el.getAttribute('aria-hidden') !== 'true',
    parentTag: el.parentElement?.tagName,
    parentClass: el.parentElement?.className,
  };
}

/**
 * 用一组候选 selector 查询，每个 selector 最多 dump 5 个匹配。
 * 这是最常用的 probe 函数。
 */
async function dumpBySelectors(page, label, selectors) {
  const result = await page.evaluate(({ sels, makeSnap }) => {
    const fn = eval('(' + makeSnap + ')');
    const out = [];
    for (const s of sels) {
      try {
        const els = Array.from(document.querySelectorAll(s));
        out.push({ selector: s, found: els.length, samples: els.slice(0, 5).map(fn) });
      } catch (err) {
        out.push({ selector: s, error: err.message });
      }
    }
    return out;
  }, { sels: selectors, makeSnap: makeSnapshot.toString() });

  console.log(`\n── [probe] ${label} ──`);
  for (const r of result) {
    if (r.error) {
      console.log(`  ✗ ${r.selector} — error: ${r.error}`);
    } else {
      console.log(`  ${r.found > 0 ? '✓' : '○'} ${r.selector} — found ${r.found}`);
      r.samples.forEach((s, i) => {
        console.log(`     [${i}] tag=${s.tag} aria=${JSON.stringify(s.ariaLabel)} text=${JSON.stringify(s.text)} visible=${s.visible}`);
      });
    }
  }
  return { label, candidates: result };
}

/** 当前页面所有按钮元素 */
async function dumpAllButtons(page) {
  return dumpBySelectors(page, 'all buttons', ['button', '[role="button"]', 'a[role="button"]']);
}

/** 当前页面所有可输入元素（含 contenteditable） */
async function dumpAllInputs(page) {
  return dumpBySelectors(page, 'all inputs', [
    'input', 'textarea', '[contenteditable="true"]', '[role="textbox"]',
  ]);
}

/** 按文字模糊匹配 dump（中英文都支持） */
async function dumpByText(page, keyword) {
  const result = await page.evaluate(({ kw, makeSnap }) => {
    const fn = eval('(' + makeSnap + ')');
    const all = Array.from(document.querySelectorAll('*'));
    const matched = all.filter(el => {
      const t = el.textContent || '';
      return t.includes(kw) && t.length < 200;  // 排除巨型容器
    });
    return matched.slice(0, 10).map(fn);
  }, { kw: keyword, makeSnap: makeSnapshot.toString() });

  console.log(`\n── [probe] text contains "${keyword}" — ${result.length} matches ──`);
  result.forEach((s, i) => {
    console.log(`  [${i}] tag=${s.tag} class=${JSON.stringify((s.class || '').slice(0, 60))} aria=${JSON.stringify(s.ariaLabel)} text=${JSON.stringify(s.text)}`);
  });
  return { label: `text:${keyword}`, matches: result };
}

/** 已知 selector 元素周围（父、祖父、相邻兄弟）的结构 */
async function dumpAround(page, anchorSelector) {
  const result = await page.evaluate(({ sel, makeSnap }) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const fn = eval('(' + makeSnap + ')');
    return {
      found: true,
      self: fn(el),
      parent: el.parentElement ? fn(el.parentElement) : null,
      grandparent: el.parentElement?.parentElement ? fn(el.parentElement.parentElement) : null,
      prevSibling: el.previousElementSibling ? fn(el.previousElementSibling) : null,
      nextSibling: el.nextElementSibling ? fn(el.nextElementSibling) : null,
      children: Array.from(el.children).slice(0, 10).map(fn),
    };
  }, { sel: anchorSelector, makeSnap: makeSnapshot.toString() });

  console.log(`\n── [probe] around "${anchorSelector}" ──`);
  if (!result.found) {
    console.log('  ✗ anchor not found');
    return result;
  }
  console.log('  self:       ', JSON.stringify(result.self));
  console.log('  parent:     ', JSON.stringify(result.parent));
  console.log('  grandparent:', JSON.stringify(result.grandparent));
  console.log('  prevSibling:', JSON.stringify(result.prevSibling));
  console.log('  nextSibling:', JSON.stringify(result.nextSibling));
  console.log(`  children (${result.children.length}):`);
  result.children.forEach((c, i) => console.log(`    [${i}]`, JSON.stringify(c)));
  return result;
}

/** 把 dump 结果保存为 JSON 文件 */
function saveReport(label, data) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(OUT_DIR, `probe-${label}-${ts}.json`);
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
  console.log(`\n[probe] 报告保存到: ${file}`);
  return file;
}

module.exports = {
  dumpBySelectors,
  dumpAllButtons,
  dumpAllInputs,
  dumpByText,
  dumpAround,
  saveReport,
};
