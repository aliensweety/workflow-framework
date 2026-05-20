/* ============================================================
   FLOW — workflow visualizer
   ============================================================ */
(function () {
  let flow, steps;

  // ============================================================
  // utils
  // ============================================================
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const esc = (s) =>
    (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ============================================================
  // command 归一化:把 string | string[] | multiline-string 统一成 line 数组
  // 返回每行的 {raw, kind} kind 是 'exec'|'comment'|'empty'
  // ============================================================
  function normalizeCommand(cmd) {
    if (cmd == null) return [];
    let lines = [];
    if (Array.isArray(cmd)) {
      lines = cmd.map(l => String(l));
    } else if (typeof cmd === 'string') {
      lines = cmd.split('\n');
    } else {
      lines = [String(cmd)];
    }
    while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    return lines.map(raw => {
      const trimmed = raw.trim();
      if (trimmed === '') return { raw, kind: 'empty' };
      if (trimmed.startsWith('#')) return { raw, kind: 'comment' };
      return { raw, kind: 'exec' };
    });
  }

  function hasExecCommand(s) {
    return normalizeCommand(s.command).some(l => l.kind === 'exec');
  }

  // ============================================================
  // init: fetch data from server, then render
  // ============================================================
  fetch('/api/flow')
    .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); })
    .then(data => { flow = data.flow; steps = data.steps; init(); })
    .catch(err => {
      document.getElementById('flow-root').innerHTML =
        '<div style="color:#e55;padding:24px;font-family:monospace">' +
        'Failed to load flow data: ' + esc(err.message) + '<br><br>' +
        'Make sure viz-server is running:<br>' +
        '<code>node workflows/viz/viz-server.mjs</code></div>';
    });

  function init() {
    // --- header ---
    document.getElementById('flow-name').textContent = flow.name;
    document.title = `${flow.name} — workflow`;
    document.getElementById('flow-desc').textContent = (flow.description || '').trim();

    function countNodes(list) {
      let n = 0, br = 0, par = 0;
      for (const item of list) {
        if (typeof item === 'string') n++;
        else if (item && item.branch) {
          br++; n++;  // judge step itself
          for (const r of Object.values(item.branch.routes)) {
            const c = countNodes(r); n += c.n; br += c.br; par += c.par;
          }
        } else if (item && item.parallel) {
          par++;
          for (const t of item.parallel) {
            const c = countNodes(t); n += c.n; br += c.br; par += c.par;
          }
        }
      }
      return { n, br, par };
    }
    const counts = countNodes(flow.flow);
    document.getElementById('stat-nodes').textContent = String(counts.n).padStart(2, '0');
    document.getElementById('stat-branches').textContent = String(counts.br).padStart(2, '0');
    document.getElementById('stat-parallel').textContent = String(counts.par).padStart(2, '0');

    const varsWrap = document.getElementById('vars-wrap');
    for (const [k, v] of Object.entries(flow.variables || {})) {
      const pill = el('div', 'var-pill');
      pill.innerHTML = `<span class="vk">${esc(k)}</span><span class="vv">${esc(String(v))}</span>`;
      varsWrap.appendChild(pill);
    }

    // --- build flow tree ---
    const root = document.getElementById('flow-root');
    const canvasInner = document.getElementById('canvas-inner');
    const edgeLayer = document.getElementById('edge-layer');
    const SVG_NS = 'http://www.w3.org/2000/svg';

    let stepCounter = 0;

    function createStepCard(sid, opts = {}) {
      const s = steps[sid] || { id: sid };
      stepCounter++;
      const idx = String(stepCounter).padStart(2, '0');

      const card = el('div', 'node');
      card.dataset.step = sid;
      if (opts.isDecision) card.classList.add('node-decision');

      const firstDescLine = (s.description || '').trim().split('\n')[0];

      const tags = [];
      if (opts.isDecision) tags.push(`<span class="tag tag-decision">DECISION</span>`);
      if (s.dispatch === 'subagent') tags.push(`<span class="tag tag-dispatch-subagent">SUBAGENT</span>`);
      if (hasExecCommand(s)) tags.push(`<span class="tag tag-cmd has">CMD</span>`);
      if (!opts.isDecision && tags.length === 0) tags.push(`<span class="tag">INLINE</span>`);

      card.innerHTML = `
        <span class="io-in"></span>
        ${opts.isDecision ? '<span class="decision-mark"></span>' : ''}
        <div class="node-head">
          <div class="node-id">${esc(sid)}</div>
          <div class="node-idx">${idx}</div>
        </div>
        <div class="node-desc">${esc(firstDescLine)}</div>
        <div class="node-tags">${tags.join('')}</div>
        <span class="io-out"></span>
      `;
      card.addEventListener('click', () => openDrawer(sid));
      return card;
    }

    function makeJunction(label) {
      const d = el('div', 'junction');
      d.dataset.label = label;
      return d;
    }

    function buildItem(item, parent) {
      if (typeof item === 'string') {
        const c = createStepCard(item);
        parent.appendChild(c);
        return { topAnchor: c, bottomAnchors: [c], edges: [] };
      }
      if (item.branch)   return buildBranchItem(item.branch, parent);
      if (item.parallel) return buildParallelItem(item.parallel, parent);
    }

    function buildBranchItem(b, parent) {
      const wrapper = el('div', 'branch');
      parent.appendChild(wrapper);

      const decision = createStepCard(b.on, { isDecision: true });
      wrapper.appendChild(decision);

      const cols = el('div', 'branch-cols');
      wrapper.appendChild(cols);

      const edges = [];
      const branchBottoms = [];

      for (const [routeLabel, routeList] of Object.entries(b.routes)) {
        const col = el('div', 'branch-col');
        cols.appendChild(col);

        const result = buildList(routeList, col);

        for (const ta of result.firstTopAnchors) {
          edges.push({ from: decision, to: ta, label: routeLabel, isRoute: true });
        }
        edges.push(...result.edges);
        branchBottoms.push(...result.lastBottomAnchors);
      }

      return { topAnchor: decision, bottomAnchors: branchBottoms, edges };
    }

    function buildParallelItem(tracks, parent) {
      const wrapper = el('div', 'parallel');
      parent.appendChild(wrapper);

      const fork = makeJunction('FORK');
      wrapper.appendChild(fork);

      const rail = el('div', 'par-rail');
      wrapper.appendChild(rail);

      const edges = [];
      const trackBottoms = [];

      tracks.forEach((track, i) => {
        const col = el('div', 'par-track');
        rail.appendChild(col);

        const lbl = el('div', 'par-track-lbl', `track · ${String(i + 1).padStart(2, '0')}`);
        col.appendChild(lbl);

        const result = buildList(track, col);

        for (const ta of result.firstTopAnchors) {
          edges.push({ from: fork, to: ta });
        }
        edges.push(...result.edges);
        trackBottoms.push(...result.lastBottomAnchors);
      });

      const join = makeJunction('JOIN');
      wrapper.appendChild(join);

      for (const ba of trackBottoms) {
        edges.push({ from: ba, to: join });
      }

      return { topAnchor: fork, bottomAnchors: [join], edges };
    }

    function buildList(list, parent) {
      const edges = [];
      let firstTopAnchors = null;
      let prevBottomAnchors = null;

      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const next = list[i + 1];
        // 跳过 "judge step + 紧跟 branch on:judge" 中的 judge step,
        // 因为 branch 块自己会把 judge 渲染成 decision card
        if (typeof item === 'string' && next && next.branch && next.branch.on === item) continue;

        const result = buildItem(item, parent);
        if (firstTopAnchors === null) firstTopAnchors = [result.topAnchor];

        if (prevBottomAnchors) {
          for (const ba of prevBottomAnchors) {
            edges.push({ from: ba, to: result.topAnchor });
          }
        }
        edges.push(...result.edges);
        prevBottomAnchors = result.bottomAnchors;
      }

      return {
        firstTopAnchors: firstTopAnchors || [],
        lastBottomAnchors: prevBottomAnchors || [],
        edges,
      };
    }

    const tree = buildList(flow.flow, root);
    const allEdges = tree.edges;

    // --- draw SVG edges ---
    function getAnchor(elm, side, baseRect) {
      const r = elm.getBoundingClientRect();
      return {
        x: r.left - baseRect.left + r.width / 2,
        y: side === 'top' ? (r.top - baseRect.top) : (r.bottom - baseRect.top),
      };
    }

    function makePath(a, b, mode) {
      if (mode === 'ortho') {
        const mid = (a.y + b.y) / 2;
        return `M ${a.x} ${a.y} L ${a.x} ${mid} L ${b.x} ${mid} L ${b.x} ${b.y}`;
      }
      const dy = Math.max(b.y - a.y, 16);
      const c = Math.max(Math.min(dy * 0.55, 90), 24);
      return `M ${a.x} ${a.y} C ${a.x} ${a.y + c}, ${b.x} ${b.y - c}, ${b.x} ${b.y}`;
    }

    function drawEdges() {
      const baseRect = canvasInner.getBoundingClientRect();
      const w = canvasInner.offsetWidth;
      const h = canvasInner.offsetHeight;
      edgeLayer.setAttribute('width', w);
      edgeLayer.setAttribute('height', h);
      edgeLayer.setAttribute('viewBox', `0 0 ${w} ${h}`);
      edgeLayer.innerHTML = '';
      canvasInner.querySelectorAll('.edge-label').forEach((n) => n.remove());

      const mode = document.body.dataset.curve || 'bezier';

      for (const edge of allEdges) {
        const a = getAnchor(edge.from, 'bottom', baseRect);
        const b = getAnchor(edge.to, 'top', baseRect);
        const d = makePath(a, b, mode);

        const glow = document.createElementNS(SVG_NS, 'path');
        glow.setAttribute('d', d);
        glow.setAttribute('class', 'edge-glow');
        edgeLayer.appendChild(glow);

        const base = document.createElementNS(SVG_NS, 'path');
        base.setAttribute('d', d);
        base.setAttribute('class', 'edge-base');
        edgeLayer.appendChild(base);

        const flowP = document.createElementNS(SVG_NS, 'path');
        flowP.setAttribute('d', d);
        flowP.setAttribute('class', 'edge-flow');
        edgeLayer.appendChild(flowP);

        if (edge.label) {
          const len = flowP.getTotalLength();
          const p = flowP.getPointAtLength(len * 0.5);
          const lab = el('div', 'edge-label is-route', edge.label);
          lab.style.left = p.x + 'px';
          lab.style.top = p.y + 'px';
          canvasInner.appendChild(lab);
        }
      }
    }

    let pending = false;
    function scheduleRedraw() {
      if (pending) return;
      pending = true;
      const fn = () => { pending = false; drawEdges(); };
      if (typeof requestAnimationFrame === 'function' && document.visibilityState === 'visible') {
        requestAnimationFrame(fn);
      } else {
        setTimeout(fn, 0);
      }
    }

    scheduleRedraw();
    drawEdges();
    window.addEventListener('resize', scheduleRedraw);
    document.addEventListener('visibilitychange', scheduleRedraw);
    if (window.ResizeObserver) new ResizeObserver(scheduleRedraw).observe(canvasInner);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(scheduleRedraw);

    // --- drawer ---
    const drawer = document.getElementById('drawer');
    const drawerBody = document.getElementById('drawer-body');

    function openDrawer(sid) {
      const s = steps[sid] || { id: sid };
      document.querySelectorAll('.node.is-active').forEach((n) => n.classList.remove('is-active'));
      document.querySelectorAll(`.node[data-step="${sid}"]`).forEach((n) => n.classList.add('is-active'));
      drawer.classList.add('is-open');
      drawer.setAttribute('aria-hidden', 'false');

      const parts = [];
      parts.push(`<div class="drawer-title">${esc(s.id)}</div>`);
      parts.push(`<div class="drawer-path">steps/${esc(sid)}.yaml</div>`);

      parts.push(`<div class="drawer-section">
        <div class="drawer-lbl">EXECUTION</div>
        <span class="disp-pill ${s.dispatch === 'subagent' ? 'subagent' : ''}">${esc(s.dispatch || 'inline')}</span>
      </div>`);

      if (s.description) {
        parts.push(`<div class="drawer-section">
          <div class="drawer-lbl">DESCRIPTION</div>
          <div class="drawer-val">${esc(s.description.trim())}</div>
        </div>`);
      }

      // command: 支持 string | string[] | multiline-string,识别 # 注释行
      const cmdLines = normalizeCommand(s.command);
      if (cmdLines.length > 0) {
        const cmdHtml = cmdLines.map(({ raw, kind }) => {
          if (kind === 'empty') return '<div class="cmd-line cmd-empty">&nbsp;</div>';
          if (kind === 'comment') return `<div class="cmd-line cmd-comment">${esc(raw)}</div>`;
          return `<div class="cmd-line cmd-exec" data-prefix="$">${esc(raw)}</div>`;
        }).join('');

        parts.push(`<div class="drawer-section">
          <div class="drawer-lbl">COMMAND</div>
          <div class="drawer-val mono cmd-block">${cmdHtml}</div>
        </div>`);
      }

      const io = [];
      if (s.consumes) io.push(`<div><div class="drawer-lbl">CONSUMES</div><div class="drawer-val mono" data-prefix="IN">${esc(s.consumes)}</div></div>`);
      if (s.produces) io.push(`<div><div class="drawer-lbl">PRODUCES</div><div class="drawer-val mono" data-prefix="OUT">${esc(s.produces)}</div></div>`);
      if (io.length) {
        parts.push(`<div class="drawer-section"><div class="io-pair">${io.join('')}</div></div>`);
      }

      if (s.notes) {
        parts.push(`<div class="drawer-section">
          <div class="drawer-lbl">NOTES</div>
          <div class="drawer-val mono">${esc(s.notes)}</div>
        </div>`);
      }

      drawerBody.innerHTML = parts.join('');
    }

    document.getElementById('drawer-close').addEventListener('click', () => {
      drawer.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      document.querySelectorAll('.node.is-active').forEach((n) => n.classList.remove('is-active'));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        drawer.classList.remove('is-open');
        pop.hidden = true;
      }
    });

    // --- settings popover ---
    const settingsBtn = document.getElementById('settings-btn');
    const pop = document.getElementById('settings-pop');

    settingsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      pop.hidden = !pop.hidden;
    });
    document.addEventListener('click', (e) => {
      if (!pop.hidden && !pop.contains(e.target) && !settingsBtn.contains(e.target)) {
        pop.hidden = true;
      }
    });

    const state = JSON.parse(localStorage.getItem('flowviz') || '{}');
    if (state.theme) document.body.dataset.theme = state.theme;
    if (state.anim)  document.body.dataset.anim  = state.anim;
    if (state.curve) document.body.dataset.curve = state.curve;
    if (state.bg)    document.body.dataset.bg    = state.bg;
    if (!document.body.dataset.bg)    document.body.dataset.bg    = 'dot';
    if (!document.body.dataset.curve) document.body.dataset.curve = 'bezier';
    if (!document.body.dataset.anim)  document.body.dataset.anim  = 'on';

    function syncPopUI() {
      pop.querySelectorAll('[data-theme]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.theme === document.body.dataset.theme));
      pop.querySelectorAll('[data-anim]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.anim === document.body.dataset.anim));
      pop.querySelectorAll('[data-curve]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.curve === document.body.dataset.curve));
      pop.querySelectorAll('[data-bg]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.bg === document.body.dataset.bg));
    }
    syncPopUI();

    function saveState() {
      localStorage.setItem('flowviz', JSON.stringify({
        theme: document.body.dataset.theme,
        anim:  document.body.dataset.anim,
        curve: document.body.dataset.curve,
        bg:    document.body.dataset.bg,
      }));
    }

    pop.querySelectorAll('[data-theme]').forEach((b) => b.addEventListener('click', () => { document.body.dataset.theme = b.dataset.theme; syncPopUI(); saveState(); scheduleRedraw(); }));
    pop.querySelectorAll('[data-anim]').forEach((b)  => b.addEventListener('click', () => { document.body.dataset.anim  = b.dataset.anim;  syncPopUI(); saveState(); }));
    pop.querySelectorAll('[data-curve]').forEach((b) => b.addEventListener('click', () => { document.body.dataset.curve = b.dataset.curve; syncPopUI(); saveState(); scheduleRedraw(); }));
    pop.querySelectorAll('[data-bg]').forEach((b)    => b.addEventListener('click', () => { document.body.dataset.bg    = b.dataset.bg;    syncPopUI(); saveState(); }));
  } // end init
})();
