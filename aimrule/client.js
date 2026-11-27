/*! AimRule | Copyright (c) 2025-2026 AimRule contributors | AGPL-3.0-or-later */
(() => {
  // src/react.js
  var R = null;
  var RD = null;
  function setReact(instance) {
    R = instance;
  }
  function setReactDOM(instance) {
    RD = instance;
  }
  function createPortal(children, container) {
    return RD === null ? null : RD.createPortal(children, container);
  }
  function getReact() {
    if (R === null) throw new Error("AimRule: React was not injected");
    return R;
  }
  function h(type, props, ...children) {
    return getReact().createElement(type, props, ...children);
  }
  function useState(initial) {
    return getReact().useState(initial);
  }
  function useEffect(effect, deps) {
    return getReact().useEffect(effect, deps);
  }
  function useRef(initial) {
    return getReact().useRef(initial);
  }
  function useMemo(factory, deps) {
    return getReact().useMemo(factory, deps);
  }
  function useCallback(fn, deps) {
    return getReact().useCallback(fn, deps);
  }

  // src/flow-model.js
  var NODE_W = 240;
  var NODE_H = 88;
  var MIN_K = 0.25;
  var MAX_K = 2.4;
  var TYPE_META = {
    start: { label: "\u5F00\u59CB", glyph: "\u25B6", color: "var(--aimrule-start)", hint: "\u8F93\u5165\u4E0E\u5165\u53E3" },
    judge: { label: "\u5224\u65AD", glyph: "\u25C6", color: "var(--aimrule-judge)", hint: "IF \u6761\u4EF6\u5206\u652F" },
    calc: { label: "\u8BA1\u7B97", glyph: "\u2211", color: "var(--aimrule-calc)", hint: "\u516C\u5F0F\u4E0E\u67E5\u8868" },
    action: { label: "\u52A8\u4F5C", glyph: "\u26A1", color: "var(--aimrule-action)", hint: "\u6267\u884C\u4E0E\u526F\u4F5C\u7528" },
    end: { label: "\u7ED3\u675F", glyph: "\u25A0", color: "var(--aimrule-end)", hint: "\u8F93\u51FA\u4E0E\u7ED3\u679C" },
    module: { label: "\u6A21\u5757", glyph: "\u25A3", color: "var(--aimrule-module)", hint: "\u53EF\u5D4C\u5957\u9ED1\u76D2" }
  };
  var TYPE_ORDER = ["start", "judge", "calc", "action", "end", "module"];
  function uid(prefix) {
    return prefix + Math.random().toString(36).slice(2, 8);
  }
  function posOf(node) {
    return node && node.pos ? node.pos : { x: 0, y: 0 };
  }
  function scopeOf(node) {
    return node.parentId || null;
  }
  function scopeNodes(doc, scope) {
    return doc.nodes.filter((node) => scopeOf(node) === (scope || null));
  }
  function computeLayout(nodes, edges) {
    const indeg = new Map(nodes.map((node) => [node.id, 0]));
    for (const edge of edges) {
      if (indeg.has(edge.target)) indeg.set(edge.target, indeg.get(edge.target) + 1);
    }
    let roots = nodes.filter((node) => indeg.get(node.id) === 0);
    if (roots.length === 0) roots = nodes.slice(0, 1);
    const layer = /* @__PURE__ */ new Map();
    const queue = roots.map((node) => ({ id: node.id, level: 0 }));
    let guard = 0;
    while (queue.length > 0 && guard < 4e3) {
      guard += 1;
      const { id, level } = queue.shift();
      const known = layer.get(id);
      if (known !== void 0) continue;
      layer.set(id, level);
      for (const edge of edges) if (edge.source === id) queue.push({ id: edge.target, level: level + 1 });
    }
    for (const node of nodes) if (!layer.has(node.id)) layer.set(node.id, 0);
    const columns = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      const level = layer.get(node.id);
      if (!columns.has(level)) columns.set(level, []);
      columns.get(level).push(node);
    }
    const result = /* @__PURE__ */ new Map();
    for (const [level, list] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
      list.forEach((node, index) => result.set(node.id, { x: 80 + level * 320, y: 70 + index * 132 }));
    }
    return result;
  }
  function layoutState(doc) {
    const nodes = doc.nodes.map((node) => ({ ...node }));
    const scopes = [null, ...nodes.filter((node) => node.type === "module").map((node) => node.id)];
    for (const scope of scopes) {
      const inScope = nodes.filter((node) => scopeOf(node) === scope);
      if (inScope.length === 0) continue;
      const ids = new Set(inScope.map((node) => node.id));
      const edges = doc.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target));
      const positions = computeLayout(inScope, edges);
      for (const node of inScope) {
        const position = positions.get(node.id);
        if (position) node.pos = position;
      }
    }
    return { ...doc, nodes };
  }
  function hasMissingPositions(doc) {
    if (doc.nodes.length === 0) return false;
    return doc.nodes.some((node) => !node.pos || !Number.isFinite(node.pos.x) || !Number.isFinite(node.pos.y));
  }
  function pathOf(doc, id) {
    const map = new Map(doc.nodes.map((node) => [node.id, node]));
    const result = [];
    let cursor = id;
    let guard = 0;
    while (cursor && guard < 32) {
      guard += 1;
      const node = map.get(cursor);
      if (!node) break;
      result.unshift(node);
      cursor = node.parentId || null;
    }
    return result;
  }
  function edgePath(a, b) {
    const ax = a.x + NODE_W;
    const ay = a.y + NODE_H / 2;
    const bx = b.x;
    const by = b.y + NODE_H / 2;
    const distance = Math.abs(bx - ax);
    const curve = Math.max(48, Math.min(180, distance * 0.5));
    if (bx >= ax) return `M${ax},${ay} C${ax + curve},${ay} ${bx - curve},${by} ${bx},${by}`;
    const lift = 60 + Math.min(120, Math.abs(by - ay) * 0.2);
    return `M${ax},${ay} C${ax + lift},${ay - lift} ${bx - lift},${by - lift} ${bx},${by}`;
  }
  function defaultData(type) {
    return {
      label: TYPE_META[type] ? TYPE_META[type].label : "\u8282\u70B9",
      condition: type === "judge" ? "\u6761\u4EF6\u5F85\u8865\u5145" : "",
      action: "",
      expr: "",
      sourceRef: "",
      notes: ""
    };
  }
  function demoDoc() {
    const nodes = [
      { id: "n_start", type: "start", data: { label: "\u6D41\u7A0B\u5165\u53E3", sourceRef: "\u89C4\u5219 1" } },
      { id: "n_calc", type: "calc", data: { label: "\u8BA1\u7B97\u6307\u6807", expr: "\u6307\u6807 = \u57FA\u6570 * \u7CFB\u6570", sourceRef: "\u89C4\u5219 2" } },
      { id: "n_judge", type: "judge", data: { label: "\u662F\u5426\u547D\u4E2D\u4F8B\u5916", condition: '\u72B6\u6001 == "\u4F8B\u5916"', sourceRef: "\u89C4\u5219 3" } },
      { id: "n_action", type: "action", data: { label: "\u8F6C\u4EBA\u5DE5\u590D\u6838", action: "ESCALATE", sourceRef: "\u89C4\u5219 3" } },
      { id: "n_module", type: "module", data: { label: "\u81EA\u52A8\u5904\u7406", sourceRef: "\u89C4\u5219 4" }, pos: { x: 80, y: 470 } },
      { id: "n_mod_start", type: "start", parentId: "n_module", data: { label: "\u8FDB\u5165\u81EA\u52A8\u5904\u7406" }, pos: { x: 80, y: 80 } },
      { id: "n_mod_calc", type: "calc", parentId: "n_module", data: { label: "\u7ED9\u51FA\u7ED3\u8BBA", expr: '\u7ED3\u8BBA = "\u901A\u8FC7"', sourceRef: "\u89C4\u5219 4" }, pos: { x: 400, y: 80 } },
      { id: "n_mod_end", type: "end", parentId: "n_module", data: { label: "\u81EA\u52A8\u5904\u7406\u7ED3\u675F" }, pos: { x: 720, y: 80 } },
      { id: "n_end", type: "end", data: { label: "\u6D41\u7A0B\u7ED3\u675F" } }
    ];
    const edges = [
      { id: "e1", source: "n_start", target: "n_calc", label: "" },
      { id: "e2", source: "n_calc", target: "n_judge", label: "" },
      { id: "e3", source: "n_judge", target: "n_action", label: "\u662F" },
      { id: "e4", source: "n_judge", target: "n_module", label: "\u5426" },
      { id: "e5", source: "n_action", target: "n_end", label: "" },
      { id: "e6", source: "n_module", target: "n_end", label: "" },
      { id: "e7", source: "n_mod_start", target: "n_mod_calc", label: "" },
      { id: "e8", source: "n_mod_calc", target: "n_mod_end", label: "" }
    ];
    return layoutState({
      version: 1,
      project: { name: "\u793A\u4F8B\uFF1A\u901A\u7528\u5BA1\u6279\u89C4\u5219", description: "\u793A\u4F8B\uFF1A\u6761\u4EF6\u5206\u652F\u3001\u8BA1\u7B97\u4E0E\u53EF\u5D4C\u5957\u5B50\u6D41\u7A0B" },
      nodes,
      edges,
      templates: [],
      sources: [{ id: "src_demo", title: "\u793A\u4F8B\uFF1A\u89C4\u5219\u8282\u9009", kind: "text", text: "\u5F53\u72B6\u6001\u4E3A\u201C\u4F8B\u5916\u201D\u65F6\u8F6C\u4EBA\u5DE5\u590D\u6838\uFF1B\u5426\u5219\u8FDB\u5165\u81EA\u52A8\u5904\u7406\u3002" }],
      updatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  function formatBytes(bytes) {
    const value = Number(bytes) || 0;
    if (value < 1024) return `${value} B`;
    if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }
  function buildWorkspaceTree(entries) {
    const root = { children: /* @__PURE__ */ new Map() };
    for (const entry of Array.isArray(entries) ? entries : []) {
      const parts = String(entry.path || "").split("/").filter(Boolean);
      if (parts.length === 0) continue;
      let cursor = root;
      for (let index = 0; index < parts.length; index += 1) {
        const name = parts[index];
        const path = parts.slice(0, index + 1).join("/");
        if (!cursor.children.has(name)) cursor.children.set(name, { name, path, type: "dir", children: /* @__PURE__ */ new Map() });
        cursor = cursor.children.get(name);
        if (index === parts.length - 1) {
          cursor.type = entry.type === "dir" ? "dir" : "file";
          cursor.size = entry.size;
        }
      }
    }
    const convert = (node) => {
      const children = [...node.children.values()].map(convert).sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1) || a.name.localeCompare(b.name));
      return { name: node.name, path: node.path, type: node.type, size: node.size, children };
    };
    return [...root.children.values()].map(convert).sort((a, b) => (a.type === b.type ? 0 : a.type === "dir" ? -1 : 1) || a.name.localeCompare(b.name));
  }
  function filterWorkspaceTree(nodes, query) {
    const needle = String(query || "").trim().toLowerCase();
    if (!needle) return nodes;
    const walk = (node) => {
      const children = node.children.map(walk).filter(Boolean);
      if (node.path.toLowerCase().includes(needle)) return { ...node, children: node.type === "dir" ? node.children : [] };
      if (children.length > 0) return { ...node, children };
      return null;
    };
    return nodes.map(walk).filter(Boolean);
  }
  function countTreeFiles(node) {
    if (!node) return 0;
    if (node.type !== "dir") return 1;
    return node.children.reduce((sum, child) => sum + countTreeFiles(child), 0);
  }
  function nodeContextText(doc, ids) {
    if (!doc) return "";
    const map = new Map(doc.nodes.map((node) => [node.id, node]));
    const lines = [];
    for (const id of ids) {
      const node = map.get(id);
      if (!node) continue;
      const data = node.data || {};
      const parts = [`[${node.type}] ${data.label || id}`];
      if (data.condition) parts.push(`\u6761\u4EF6\uFF1A${data.condition}`);
      if (data.action) parts.push(`\u52A8\u4F5C\uFF1A${data.action}`);
      if (data.expr) parts.push(`\u516C\u5F0F\uFF1A${data.expr}`);
      if (node.type === "module") {
        const children = doc.nodes.filter((item) => item.parentId === node.id);
        if (children.length > 0) parts.push(`\u5305\u542B ${children.length} \u4E2A\u5B50\u8282\u70B9\uFF1A${children.map((item) => item.data && item.data.label || item.id).join("\u3001")}`);
      }
      lines.push(`- ${parts.join("\uFF1B")}`);
    }
    return lines.join("\n");
  }
  function baseName(path) {
    return String(path || "").split("/").filter(Boolean).pop() || "\u9879\u76EE";
  }

  // src/styles.js
  var CSS = `
.aimrule-root{position:relative;width:100%;height:100%;min-width:0;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:13px;line-height:1.5;display:flex;flex-direction:column;overflow:hidden;
  --aim-action:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary,#0f1115));
  --aim-action-ink:var(--dsw-alias-label-primary-foreground,#fff);
  --aim-action-hover:var(--dsw-alias-button-primary-hover,var(--dsw-alias-brand-primary,#3c3c3d));
  --aim-accent:var(--dsw-alias-state-business-primary,#4176e6);
  --aim-accent-soft:color-mix(in srgb, var(--aim-accent) 12%, transparent);
  --aim-line:var(--dsw-alias-border-l3);--aim-line-strong:var(--dsw-alias-border-l4);
  --aim-muted:var(--dsw-alias-label-tertiary);--aim-text:var(--dsw-alias-label-primary);
  --aim-base:var(--dsw-alias-bg-base);--aim-layer:var(--dsw-alias-bg-layer-1);--aim-raised:var(--dsw-alias-bg-layer-2);
  --aim-hover:var(--dsw-alias-interactive-bg-hover);--aim-danger:var(--dsw-alias-state-error-primary);
  --aimrule-start:var(--dsw-static-green-500,#22c55e);--aimrule-judge:var(--dsw-static-amber-500,#f59e0b);
  --aimrule-calc:var(--dsw-static-blue-500,#3b82f6);--aimrule-action:var(--dsw-static-violet-600,#7c3aed);
  --aimrule-end:var(--dsw-static-red-500,#ef4444);--aimrule-module:var(--dsw-static-neutral-bluish-500,#979da6);
  --aimrule-edge:color-mix(in srgb, var(--aim-text) 30%, transparent);
  --aimrule-grid:color-mix(in srgb, var(--aim-text) 9%, transparent);}
body[data-ds-dark-theme] .aimrule-root{
  --aimrule-start:var(--dsw-static-green-400,#4ed17e);--aimrule-judge:var(--dsw-static-amber-400,#f7ad31);
  --aimrule-calc:var(--dsw-static-blue-400,#60a5fa);--aimrule-action:var(--dsw-static-violet-400,#a78bfa);
  --aimrule-end:var(--dsw-static-red-400,#f25a5a);--aimrule-module:var(--dsw-static-neutral-bluish-400,#adb2b8);}
.aimrule-root *{box-sizing:border-box}
body:not([data-ds-dark-theme]) .aimrule-root{--aim-muted:#6b7075}
.aimrule-root ::selection{background:var(--aim-accent-soft)}
.aimrule-top{display:flex;align-items:center;gap:8px;container-type:inline-size;padding:calc(8px + var(--dsh-frame-top-clearance,0px)) 14px 8px;min-height:calc(52px + var(--dsh-frame-top-clearance,0px));flex:none;flex-wrap:wrap;border-bottom:.5px solid var(--aim-line);background:var(--aim-base);position:relative;z-index:8}
.aimrule-brand{display:flex;align-items:center;gap:9px;min-width:0;flex:none}
.aimrule-logo{width:28px;height:28px;border-radius:9px;display:grid;place-items:center;flex:none;background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-title-wrap{position:relative;display:flex;align-items:center;gap:1px;flex:none}
.aimrule-title-more{width:auto;height:26px;padding:0 8px;border:.5px solid var(--aim-line);border-radius:7px;background:var(--aim-layer);color:var(--aim-muted);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;flex:none}
.aimrule-title-more:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-title-more:disabled{opacity:.4;cursor:default}
.aimrule-title-more-chevron{font-size:9px;opacity:.75}
.aimrule-title{font:inherit;font-size:14px;font-weight:600;color:var(--aim-text);background:transparent;border:1px solid transparent;border-radius:7px;padding:4px 7px;max-width:280px;outline:none;flex:none}
.aimrule-title:hover{border-color:var(--aim-line)}
.aimrule-title:focus{border-color:var(--aim-accent);background:var(--aim-layer)}
.aimrule-crumbs{display:flex;align-items:center;gap:1px;min-width:0;overflow:hidden;padding-left:2px}
.aimrule-crumb{font:inherit;font-size:12px;border:0;background:transparent;color:var(--aim-muted);padding:3px 6px;border-radius:6px;cursor:pointer;white-space:nowrap;max-width:170px;overflow:hidden;text-overflow:ellipsis}
.aimrule-crumb:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-crumb[data-current=true]{color:var(--aim-text);font-weight:600}
.aimrule-canvas-crumbs{position:absolute;left:14px;top:12px;z-index:6;display:flex;align-items:center;gap:1px;padding:2px;border:.5px solid var(--aim-line);border-radius:999px;background:color-mix(in srgb, var(--aim-layer) 90%, transparent);backdrop-filter:blur(12px);box-shadow:0 6px 18px rgba(0,0,0,.10);max-width:calc(100% - 28px);overflow:auto}
.aimrule-crumb-home{height:24px;padding:0 9px;border:0;border-radius:999px;background:var(--aim-accent-soft);color:var(--aim-accent);font:inherit;font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap;flex:none}
.aimrule-crumb-home:hover{background:color-mix(in srgb, var(--aim-accent) 20%, transparent)}
.aimrule-canvas-crumbs .aimrule-crumb{height:24px;padding:0 7px;font-size:11px;border-radius:999px;max-width:180px;overflow:hidden;text-overflow:ellipsis}
.aimrule-canvas-crumbs .aimrule-crumb[data-current=true]{cursor:default}
.aimrule-crumb-wrap{display:inline-flex;align-items:center;gap:1px;min-width:0}
.aimrule-crumb-sep{color:var(--aim-muted);font-size:11px;opacity:.7}
.aimrule-sync{display:inline-flex;align-items:center;gap:5px;flex:none;font-size:11px;color:var(--aim-muted);white-space:nowrap}
.aimrule-sync::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-success-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent)}
.aimrule-sync[data-state=local]{color:var(--dsw-alias-state-warn-primary)}
.aimrule-sync[data-state=local]::before{background:var(--dsw-alias-state-warn-primary);box-shadow:none}
.aimrule-sync[data-state=loading]::before{background:var(--aim-muted);box-shadow:none}
.aimrule-actions{display:flex;align-items:center;gap:6px;margin-left:auto}
.aimrule-top-tools{display:flex;align-items:center;gap:1px;padding:1px;border:.5px solid var(--aim-line);border-radius:9px;background:var(--aim-layer);position:relative;flex:none}
.aimrule-top-tools .aimrule-btn{width:26px;height:26px;padding:0;border-color:transparent;background:transparent;color:var(--aim-muted);font-size:13px;border-radius:7px}
.aimrule-top-tools .aimrule-btn:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-top-tools .aimrule-btn:disabled{opacity:.35}
.aimrule-top-tools .aimrule-btn.aimrule-tool-pan{display:grid;place-items:center}
.aimrule-top-tools .aimrule-btn.aimrule-tool-add{background:var(--aim-action);color:var(--aim-action-ink);font-size:17px;font-weight:600}
.aimrule-top-tools .aimrule-btn.aimrule-tool-add:hover{background:var(--aim-action-hover);color:var(--aim-action-ink)}
.aimrule-top-tools .aimrule-btn[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:auto;padding:0 8px;font-size:11px;gap:4px}
.aimrule-module-wrap{position:relative;display:flex;align-items:center}
.aimrule-module-popover{position:absolute;right:0;top:calc(100% + 8px);width:min(540px, calc(100vw - 32px));max-height:440px;z-index:40;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:14px;box-shadow:0 20px 48px rgba(0,0,0,.32);display:flex;flex-direction:column;overflow:hidden}
.aimrule-module-popover-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--aim-line);font-size:12px}
.aimrule-module-popover-head b{font-weight:600;flex:none}
.aimrule-module-popover-hint{font-size:10.5px;color:var(--aim-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-popover-body{flex:1;min-height:0;display:flex;gap:6px;overflow:hidden;padding:6px}
.aimrule-module-list{flex:1;min-width:0;overflow:auto;padding-right:2px}
.aimrule-module-detail{width:214px;flex:none;min-height:0;overflow:auto;border-left:.5px solid var(--aim-line);padding:6px 8px 8px;background:color-mix(in srgb, var(--aim-base) 55%, transparent);border-radius:0 8px 8px 0}
.aimrule-module-group{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--aim-muted);padding:6px 8px 3px;font-weight:600}
.aimrule-module-group-meta{font-size:9px;color:var(--aim-muted);border:.5px solid var(--aim-line);border-radius:999px;padding:0 5px;line-height:14px}
.aimrule-module-current{font-size:9px;font-weight:600;color:var(--aim-accent);background:var(--aim-accent-soft);border-radius:4px;padding:0 4px;line-height:14px}
.aimrule-module-pick{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;min-width:0}
.aimrule-module-pick:hover,.aimrule-module-pick[data-active=true]{background:var(--aim-hover)}
.aimrule-module-pick[data-active=true]{box-shadow:inset 2px 0 0 var(--aim-accent)}
.aimrule-module-pick:focus-visible{outline:2px solid var(--aim-accent);outline-offset:-1px}
.aimrule-module-pick .aimrule-module-info b{font-size:12px}
.aimrule-module-pick .aimrule-module-info span{font-size:10.5px}
.aimrule-module-summary{display:block;font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px}
.aimrule-module-add{flex:none;color:var(--aim-muted);font-size:14px;width:20px;text-align:center}
.aimrule-module-pick:hover .aimrule-module-add{color:var(--aim-text)}
.aimrule-module-popover-foot{display:flex;align-items:center;gap:6px;padding:8px 10px;border-top:.5px solid var(--aim-line)}
.aimrule-module-popover-foot .aimrule-btn{height:26px;font-size:11px}
.aimrule-module-detail-head{display:flex;flex-direction:column;gap:2px;padding:2px 2px 8px;border-bottom:.5px solid var(--aim-line);margin-bottom:6px}
.aimrule-module-detail-head b{font-size:12px;font-weight:600;color:var(--aim-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-head span{font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-list{display:flex;flex-direction:column;gap:2px}
.aimrule-module-detail-node{display:flex;align-items:flex-start;gap:6px;padding:4px 2px;min-width:0}
.aimrule-module-detail-glyph{flex:none;width:16px;height:16px;border-radius:5px;display:grid;place-items:center;font-size:8.5px;background:color-mix(in srgb, currentColor 12%, transparent);margin-top:1px}
.aimrule-module-detail-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-module-detail-text b{font-size:11px;font-weight:500;color:var(--aim-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-text span{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:9.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-detail-hint{margin:8px 2px 0;font-size:10px;line-height:1.5;color:var(--aim-muted)}
@media (max-width:720px){.aimrule-module-detail{display:none}.aimrule-module-popover{width:94vw}}
.aimrule-tool-more-wrap{display:none;position:relative;align-items:center}
.aimrule-tools-menu{position:absolute;right:0;top:calc(100% + 8px);width:190px;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-tools-menu-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--aim-muted);padding:5px 8px 7px;font-weight:600}
.aimrule-tools-menu .aimrule-flow-option{min-height:30px}
.aimrule-tools-menu .aimrule-flow-option-meta{margin-left:auto;font-size:10px;color:var(--aim-muted)}
@container (max-width: 1060px){
  .aimrule-tool-secondary,.aimrule-tool-secondary-sep{display:none !important}
  .aimrule-tool-more-wrap{display:flex}
}
@media (max-width: 1060px){
  .aimrule-tool-secondary,.aimrule-tool-secondary-sep{display:none !important}
  .aimrule-tool-more-wrap{display:flex}
}
@container (max-width: 760px){
  .aimrule-tool-modules-label{display:none}
  .aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:26px;padding:0;justify-content:center}
  .aimrule-sync-label{display:none}
  .aimrule-workspace-name{max-width:100px}
  .aimrule-title{max-width:120px}
}
@media (max-width: 760px){
  .aimrule-tool-modules-label{display:none}
  .aimrule-top-tools .aimrule-btn.aimrule-tool-modules{width:26px;padding:0;justify-content:center}
  .aimrule-sync-label{display:none}
  .aimrule-workspace-name{max-width:100px}
  .aimrule-title{max-width:120px}
}
.aimrule-more-wrap{position:relative;display:flex}
.aimrule-spacer{flex:1;min-width:8px}
.aimrule-btn{font:inherit;font-size:12px;height:28px;padding:0 10px;border-radius:8px;border:.5px solid var(--aim-line);background:var(--aim-layer);color:var(--aim-text);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;transition:background .12s,border-color .12s,color .12s}
.aimrule-btn:hover{background:var(--aim-raised);border-color:var(--aim-line-strong)}
.aimrule-btn:disabled{opacity:.45;cursor:default}
.aimrule-btn[data-active=true]{border-color:var(--aim-accent);color:var(--aim-accent);background:var(--aim-accent-soft)}
.aimrule-btn[data-kind=primary]{background:var(--aim-action);border-color:var(--aim-action);color:var(--aim-action-ink);font-weight:600}
.aimrule-btn[data-kind=primary]:hover{background:var(--aim-action-hover);border-color:var(--aim-action-hover)}
.aimrule-btn[data-kind=primary]:disabled{opacity:.5}
.aimrule-btn[data-kind=ghost]{background:transparent;border-color:transparent;color:var(--aim-muted)}
.aimrule-btn[data-kind=ghost]:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-btn[data-kind=danger]{color:var(--aim-danger)}
.aimrule-btn[data-kind=danger]:hover{background:color-mix(in srgb, var(--aim-danger) 10%, transparent)}
.aimrule-group{display:flex;align-items:center;gap:4px}
.aimrule-select{font:inherit;font-size:12px;color:var(--aim-text);background:var(--aim-layer);border:.5px solid var(--aim-line);border-radius:8px;padding:5px 8px;outline:none}
.aimrule-select:focus{border-color:var(--aim-accent)}
.aimrule-workspace{position:relative;display:flex;flex:none}
.aimrule-workspace-trigger{gap:6px;color:var(--aim-muted);max-width:230px}
.aimrule-workspace-trigger:hover{color:var(--aim-text)}
.aimrule-workspace-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:190px}
.aimrule-workspace-menu{left:0;top:calc(100% + 8px);width:260px}
.aimrule-flow-menu{position:absolute;left:0;top:calc(100% + 8px);width:252px;max-height:min(420px,70vh);overflow:auto;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-flow-menu.aimrule-more-menu{left:auto;right:0;width:200px;max-height:none}
.aimrule-flow-mask{position:fixed;inset:0;z-index:30}
.aimrule-flow-option{font:inherit;font-size:12px;text-align:left;border:0;background:transparent;color:var(--aim-text);border-radius:8px;padding:7px 9px;display:flex;align-items:center;gap:8px;cursor:pointer;width:100%}
.aimrule-flow-option:hover{background:var(--aim-hover)}
.aimrule-flow-option[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-flow-option[data-danger=true]{color:var(--aim-danger)}
.aimrule-flow-option:disabled{opacity:.45;cursor:default}
.aimrule-flow-option-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-flow-option-meta{flex:none;font-size:10px;color:var(--aim-muted)}
.aimrule-flow-menu-sep{height:1px;background:var(--aim-line);margin:4px 2px}
.aimrule-module-row{display:flex;align-items:center;gap:12px;border:.5px solid var(--aim-line);border-radius:10px;padding:10px 12px;background:var(--aim-base)}
.aimrule-module-row[draggable=true]{cursor:grab}
.aimrule-module-row[draggable=true]:active{cursor:grabbing}
.aimrule-module-grip{flex:none;color:var(--aim-muted);font-size:11px;letter-spacing:-2px;cursor:grab;user-select:none}
.aimrule-overlay[data-dragging=true]{pointer-events:none;background:transparent;backdrop-filter:none}
.aimrule-overlay[data-dragging=true] .aimrule-modal{opacity:0;transform:scale(.985);pointer-events:none;transition:opacity .1s,transform .1s}
.aimrule-module-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.aimrule-module-info b{font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-module-info span{font-size:11px;color:var(--aim-muted)}
.aimrule-detect{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 12px;border:.5px solid var(--aim-line);border-radius:12px;background:var(--aim-base)}
.aimrule-candidates{display:flex;flex-direction:column;gap:8px}
.aimrule-candidate{border:.5px solid var(--aim-line-strong);border-radius:12px;padding:10px 12px;background:var(--aim-base);display:flex;flex-direction:column;gap:6px}
.aimrule-candidate-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.aimrule-candidate-head b{font-size:12.5px}
.aimrule-candidate-head span{font-size:11px;color:var(--aim-muted)}
.aimrule-candidate-occ{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--aim-muted);flex-wrap:wrap}
.aimrule-candidate-occ .aimrule-btn{height:26px;font-size:11px;margin-left:auto}
.aimrule-modal-sep{display:flex;align-items:center;gap:10px;font-size:11px;color:var(--aim-muted);margin-top:2px}
.aimrule-modal-sep::before,.aimrule-modal-sep::after{content:"";height:1px;background:var(--aim-line);flex:1}
.aimrule-source{border:.5px solid var(--aim-line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--aim-base)}
.aimrule-source-head{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--aim-muted);flex-wrap:wrap}
.aimrule-source-head b{font-size:12px;color:var(--aim-text);font-weight:600}
.aimrule-source-head .aimrule-btn{height:24px;padding:0 7px;font-size:11px;border-color:transparent;background:transparent;color:var(--aim-muted)}
.aimrule-source-head .aimrule-btn:hover{color:var(--aim-text);background:var(--aim-hover)}
.aimrule-convo-list{max-height:200px;overflow:auto;display:flex;flex-direction:column;gap:2px;border-top:.5px solid var(--aim-line);padding-top:6px}
.aimrule-convo-item{display:flex;align-items:flex-start;gap:8px;padding:5px 6px;border-radius:8px;cursor:pointer;min-width:0}
.aimrule-convo-item:hover{background:var(--aim-hover)}
.aimrule-convo-item input{margin:2px 0 0;flex:none}
.aimrule-role{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--aim-accent-soft);color:var(--aim-accent);font-weight:600}
.aimrule-role[data-role=assistant]{background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 12%, transparent);color:var(--dsw-alias-state-success-primary)}
.aimrule-convo-text{flex:1;min-width:0;font-size:11.5px;line-height:1.5;color:var(--aim-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aimrule-convo-time{flex:none;font-size:10px;color:var(--aim-muted);opacity:.7;padding-top:1px}
.aimrule-file-list{display:flex;flex-wrap:wrap;gap:6px}
.aimrule-file-chip{display:inline-flex;align-items:center;gap:6px;font-size:11px;border:.5px solid var(--aim-line);border-radius:999px;padding:3px 6px 3px 10px;max-width:100%;color:var(--aim-muted);background:var(--aim-layer)}
.aimrule-file-chip span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}
.aimrule-file-chip button{border:0;background:transparent;color:var(--aim-muted);cursor:pointer;padding:0 2px;font-size:12px;line-height:1}
.aimrule-file-chip button:hover{color:var(--aim-danger)}
.aimrule-notes{flex:none;display:flex;align-items:center;gap:10px;padding:7px 14px;background:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 10%, transparent);border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary) 22%, transparent);font-size:11px;color:var(--aim-text);overflow:hidden}
.aimrule-notes b{flex:none;color:var(--dsw-alias-state-warn-primary);font-weight:600}
.aimrule-note{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--aim-muted)}
.aimrule-body{flex:1;min-height:0;display:flex;position:relative;background:var(--aim-base)}
.aimrule-stage{position:relative;flex:1;min-width:0;overflow:hidden;cursor:default;background-color:var(--aim-base);background-image:radial-gradient(var(--aimrule-grid) 1px, transparent 1px);background-size:24px 24px}
.aimrule-stage::before{content:"";position:absolute;inset:0;pointer-events:none;background:radial-gradient(620px 320px at 50% 0%, color-mix(in srgb, var(--aim-accent) 7%, transparent), transparent 72%)}
.aimrule-stage[data-tool=hand]{cursor:grab}
.aimrule-stage[data-tool=hand] .aimrule-world,.aimrule-stage[data-tool=hand] .aimrule-world [data-node-id],.aimrule-stage[data-tool=hand] .aimrule-edge-hit{cursor:grab}
.aimrule-stage[data-panning=true]{cursor:grabbing}
.aimrule-stage[data-panning=true] .aimrule-world,.aimrule-stage[data-panning=true] .aimrule-world [data-node-id],.aimrule-stage[data-panning=true] .aimrule-edge-hit{cursor:grabbing}
.aimrule-stage[data-marquee=true]{cursor:crosshair}
.aimrule-canvas-bar .aimrule-btn[data-active=true]{background:var(--aim-accent-soft);color:var(--aim-accent)}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-select{width:auto;padding:0 9px;font-size:11px;gap:4px}
.aimrule-composer,.aimrule-dock,.aimrule-toast,.aimrule-notes,.aimrule-canvas-bar,.aimrule-zoom,.aimrule-canvas-menu{cursor:default}
.aimrule-composer-input,.aimrule-dock-input,.aimrule-input{cursor:text}
.aimrule-world{position:absolute;left:0;top:0;transform-origin:0 0}
.aimrule-edges{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.aimrule-edge-hit{pointer-events:stroke;stroke:transparent;stroke-width:14;fill:none;cursor:pointer}
.aimrule-edge{fill:none;stroke:var(--aimrule-edge);stroke-width:1.6}
.aimrule-edge[data-selected=true]{stroke:var(--aim-accent);stroke-width:2.4}
.aimrule-edge-label{font-size:11px;fill:var(--aim-muted);paint-order:stroke;stroke:var(--aim-base);stroke-width:4px;stroke-linejoin:round;pointer-events:none}
.aimrule-node{position:absolute;width:${NODE_W}px;height:${NODE_H}px;border-radius:12px;border:.5px solid var(--aim-line);background:var(--aim-layer);
  box-shadow:0 1px 2px rgba(0,0,0,.12);padding:11px 12px;display:flex;flex-direction:column;gap:3px;cursor:grab;user-select:none;overflow:hidden;transition:box-shadow .12s,border-color .12s}
.aimrule-node::before{content:"";position:absolute;left:0;top:12px;bottom:12px;width:2px;border-radius:0 2px 2px 0;background:var(--node-accent,var(--aim-accent));opacity:.72;pointer-events:none}
.aimrule-node[data-type=start]{--node-accent:var(--aimrule-start)}
.aimrule-node[data-type=judge]{--node-accent:var(--aimrule-judge)}
.aimrule-node[data-type=calc]{--node-accent:var(--aimrule-calc)}
.aimrule-node[data-type=action]{--node-accent:var(--aimrule-action)}
.aimrule-node[data-type=end]{--node-accent:var(--aimrule-end)}
.aimrule-node[data-type=module]{--node-accent:var(--aimrule-module)}
.aimrule-node:hover{border-color:var(--aim-line-strong);box-shadow:0 8px 22px rgba(0,0,0,.16)}
.aimrule-node[data-selected=true]{border-color:color-mix(in srgb, var(--aim-accent) 70%, var(--aim-line-strong));box-shadow:0 0 0 2px color-mix(in srgb, var(--aim-accent) 22%, transparent),0 8px 22px rgba(0,0,0,.16)}
.aimrule-node[data-connect-target=true]{border-color:var(--aim-accent);box-shadow:0 0 0 2px var(--aim-accent-soft),0 10px 26px rgba(0,0,0,.20)}
.aimrule-node[data-module=true]{background:color-mix(in srgb, var(--aim-module) 4%, var(--aim-layer));border-style:dashed}
.aimrule-node-head{display:flex;align-items:center;gap:8px;min-width:0}
.aimrule-node-glyph{flex:none;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;font-size:10px;line-height:1;color:var(--node-color,var(--aim-accent));background:color-mix(in srgb, var(--node-color,var(--aim-accent)) 12%, transparent)}
.aimrule-node-title{font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.aimrule-node-badge{flex:none;font-size:10px;color:var(--aim-muted);background:var(--aim-base);border:.5px solid var(--aim-line);border-radius:6px;padding:0 5px}
.aimrule-node-line{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-node-line b{color:var(--aim-text);font-weight:500}
.aimrule-node-src{font-size:10px;color:color-mix(in srgb, var(--aim-muted) 82%, transparent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:auto}
.aimrule-handle{position:absolute;top:50%;width:10px;height:10px;margin-top:-5px;border-radius:50%;background:var(--aim-base);border:1.5px solid var(--aim-line-strong);cursor:crosshair;opacity:0;transition:opacity .12s}
.aimrule-handle::before{content:"";position:absolute;inset:-6px;border-radius:50%}
.aimrule-node:hover .aimrule-handle,.aimrule-node[data-selected=true] .aimrule-handle{opacity:1}
.aimrule-node[data-connect-target=true] .aimrule-handle[data-side=in]{opacity:1;border-color:var(--aim-accent);background:var(--aim-accent)}
.aimrule-handle[data-side=in]{left:-6px}
.aimrule-handle[data-side=out]{right:-6px}
.aimrule-handle:hover{border-color:var(--aim-accent);background:var(--aim-accent)}
.aimrule-marquee{position:absolute;border:1px solid var(--aim-accent);background:color-mix(in srgb, var(--aim-accent) 12%, transparent);pointer-events:none;border-radius:2px}
.aimrule-canvas-bar{position:absolute;left:14px;top:14px;z-index:6;display:flex;align-items:center;gap:2px;padding:4px;border:.5px solid var(--aim-line);border-radius:12px;background:color-mix(in srgb, var(--aim-layer) 80%, transparent);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.12);opacity:.75;transition:opacity .16s}
.aimrule-canvas-bar:hover,.aimrule-canvas-bar:focus-within{opacity:1}
.aimrule-canvas-bar .aimrule-btn{width:30px;height:30px;padding:0;justify-content:center;border-color:transparent;background:transparent;color:var(--aim-muted);font-size:13px}
.aimrule-canvas-bar .aimrule-btn:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-canvas-bar .aimrule-btn:disabled{opacity:.35}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-add{background:var(--aim-action);color:var(--aim-action-ink);font-size:18px;font-weight:600}
.aimrule-canvas-bar .aimrule-btn.aimrule-tool-add:hover{background:var(--aim-action-hover);color:var(--aim-action-ink)}
.aimrule-bar-sep{width:1px;height:16px;background:var(--aim-line);margin:0 3px}
.aimrule-add-menu{position:absolute;left:0;top:calc(100% + 8px);width:236px;z-index:31;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-add-menu-title{font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--aim-muted);padding:5px 8px 7px;font-weight:600}
.aimrule-add-item{display:flex;align-items:center;gap:9px;width:100%;padding:8px;border:0;border-radius:8px;background:transparent;color:var(--aim-text);text-align:left;cursor:pointer;font:inherit}
.aimrule-add-item:hover{background:var(--aim-hover)}
.aimrule-add-item-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-add-item-text b{font-size:12px;font-weight:600}
.aimrule-add-item-text span{font-size:10.5px;color:var(--aim-muted)}
.aimrule-canvas-menu{position:absolute;z-index:33;width:214px;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-canvas-menu-title{padding:5px 8px 3px;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--aim-muted)}
.aimrule-canvas-menu .aimrule-add-item{padding:6px 8px;gap:8px;font-size:12px}
.aimrule-canvas-menu .aimrule-add-item:disabled{opacity:.4;cursor:default}
.aimrule-add-item[data-danger=true]{color:var(--aim-danger)}
.aimrule-canvas-menu-meta{margin-left:auto;font-size:10px;color:var(--aim-muted)}
.aimrule-new-flow-menu{width:100%;height:32px;margin-top:2px;font-weight:600}

.aimrule-dot{width:7px;height:7px;border-radius:2px;flex:none;background:var(--aim-muted)}
.aimrule-zoom{position:absolute;right:14px;bottom:14px;display:flex;align-items:center;gap:2px;z-index:6;padding:4px;border-radius:12px;border:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-layer) 80%, transparent);backdrop-filter:blur(12px);box-shadow:0 8px 24px rgba(0,0,0,.10)}
.aimrule-zoom .aimrule-btn{width:28px;height:28px;padding:0;border-color:transparent;background:transparent;color:var(--aim-muted)}
.aimrule-zoom .aimrule-btn:hover{color:var(--aim-text);background:var(--aim-hover)}
.aimrule-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:24px;pointer-events:none}
.aimrule-onboard{pointer-events:auto;width:min(620px,100%);display:flex;flex-direction:column;gap:14px;padding:24px 26px 22px;border-radius:16px;border:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-layer) 90%, transparent);backdrop-filter:blur(14px);box-shadow:0 24px 60px rgba(0,0,0,.20)}
.aimrule-onboard[data-size=sm]{width:min(480px,100%);padding:20px 22px;gap:10px}
.aimrule-onboard[data-size=sm] h2{font-size:16px}
.aimrule-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--aim-accent)}
.aimrule-onboard h2{margin:0;font-size:22px;line-height:1.32;font-weight:650;letter-spacing:-.01em}
.aimrule-onboard p{margin:0;font-size:12.5px;line-height:1.7;color:var(--aim-muted)}
.aimrule-onboard .aimrule-textarea{min-height:112px;font-size:13px;line-height:1.6;background:var(--aim-base);border-radius:10px;padding:10px 12px}
.aimrule-onboard-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.aimrule-onboard-hint{font-size:11px;color:var(--aim-muted)}
.aimrule-steps{display:flex;gap:16px;flex-wrap:wrap}
.aimrule-step{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--aim-muted)}
.aimrule-step-num{width:16px;height:16px;border-radius:50%;display:grid;place-items:center;background:var(--aim-accent-soft);color:var(--aim-accent);font-size:10px;font-weight:700}
.aimrule-kinds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.aimrule-kind{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--aim-muted);border:.5px solid var(--aim-line);border-radius:999px;padding:3px 9px}
.aimrule-hero{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;padding:0 24px 180px;text-align:center;pointer-events:none}
.aimrule-hero .aimrule-eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--aim-accent)}
.aimrule-hero h2{margin:0;font-size:24px;line-height:1.3;font-weight:600;letter-spacing:-.01em;color:var(--aim-text)}
.aimrule-hero p{margin:0;max-width:540px;font-size:12.5px;line-height:1.7;color:var(--aim-muted)}
.aimrule-hero-link{pointer-events:auto;border:0;background:transparent;color:var(--aim-accent);font:inherit;font-size:12px;cursor:pointer;padding:4px 8px;border-radius:8px}
.aimrule-hero-link:hover{background:var(--aim-hover)}
.aimrule-composer{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);z-index:16;width:min(760px, calc(100% - 80px));display:flex;flex-direction:column;gap:6px}
.aimrule-composer-chips{display:flex;flex-wrap:wrap;gap:4px;max-height:76px;overflow:auto;padding:0 4px}
.aimrule-composer-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--aim-muted);background:color-mix(in srgb, var(--aim-layer) 88%, transparent);border:.5px solid var(--aim-line);border-radius:999px;padding:3px 6px 3px 9px;max-width:280px;white-space:nowrap}
.aimrule-composer-chip button{border:0;background:transparent;color:var(--aim-muted);cursor:pointer;font-size:10px;padding:0 2px;line-height:1}
.aimrule-composer-chip button:hover{color:var(--aim-danger)}
.aimrule-composer-box{display:flex;align-items:flex-end;gap:6px;padding:7px;background:color-mix(in srgb, var(--aim-layer) 94%, transparent);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 14px 40px rgba(0,0,0,.28);backdrop-filter:blur(16px)}
.aimrule-composer-add{width:30px;height:30px;flex:none;border:0;border-radius:50%;background:transparent;color:var(--aim-muted);font-size:18px;cursor:pointer;display:grid;place-items:center}
.aimrule-composer-add:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-composer-input{flex:1;min-width:0;border:0;background:transparent;color:var(--aim-text);font:inherit;font-size:13px;line-height:1.6;padding:9px 2px;outline:none;resize:none;field-sizing:content;min-height:54px;max-height:180px;overflow-y:auto}
.aimrule-composer-input::placeholder{color:var(--aim-muted)}
.aimrule-composer-send{width:30px;height:30px;flex:none;border:0;border-radius:50%;background:var(--aim-action);color:var(--aim-action-ink);font-size:15px;font-weight:600;cursor:pointer;display:grid;place-items:center}
.aimrule-composer-send:hover{background:var(--aim-action-hover)}
.aimrule-composer-send:disabled{opacity:.35;cursor:default}
.aimrule-composer-foot{display:flex;align-items:center;gap:8px;padding:0 6px;font-size:11px;color:var(--aim-muted)}
.aimrule-composer-hint{font-size:11px;color:var(--aim-muted)}
.aimrule-composer-menu{position:absolute;left:0;bottom:calc(100% + 8px);width:230px;z-index:18;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:12px;box-shadow:0 18px 44px rgba(0,0,0,.30);padding:6px;display:flex;flex-direction:column;gap:2px}
.aimrule-composer-menu-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 8px;border:0;border-radius:8px;background:transparent;color:var(--aim-text);text-align:left;cursor:pointer;font:inherit;font-size:12px}
.aimrule-composer-menu-item:hover{background:var(--aim-hover)}
.aimrule-menu-glyph{width:14px;text-align:center;color:var(--aim-muted);font-size:12px;flex:none}
.aimrule-composer-picker{position:absolute;left:50%;bottom:calc(100% + 10px);transform:translateX(-50%);width:min(560px,100%);max-height:420px;z-index:18;background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 18px 44px rgba(0,0,0,.30);display:flex;flex-direction:column;overflow:hidden}
.aimrule-picker-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:.5px solid var(--aim-line);font-size:12px}
.aimrule-picker-head b{flex:1;font-weight:600}
.aimrule-picker-body{padding:8px 12px;display:flex;flex-direction:column;gap:6px;min-height:0;overflow:auto}
.aimrule-picker-list{display:flex;flex-direction:column;gap:2px;max-height:260px;overflow:auto}
.aimrule-picker-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:8px;font-size:11.5px;color:var(--aim-muted);cursor:pointer;min-width:0}
.aimrule-picker-row:hover{background:var(--aim-hover)}
.aimrule-picker-row input{flex:none}
.aimrule-picker-label{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--aim-text)}
.aimrule-picker-meta{flex:none;font-size:10px;color:var(--aim-muted)}
.aimrule-picker-row-chat{align-items:flex-start}
.aimrule-file-tree{display:flex;flex-direction:column;gap:1px}
.aimrule-tree-group{display:flex;flex-direction:column;gap:1px}
.aimrule-tree-row{display:flex;align-items:center;gap:7px;padding:4px 6px;border-radius:7px;font-size:11.5px;color:var(--aim-muted);cursor:pointer;min-width:0}
.aimrule-tree-row:hover{background:var(--aim-hover)}
.aimrule-tree-row input{flex:none}
.aimrule-tree-toggle{width:16px;height:16px;flex:none;border:0;background:transparent;color:var(--aim-muted);font-size:9px;cursor:pointer;display:grid;place-items:center;padding:0;border-radius:4px}
.aimrule-tree-toggle:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-tree-children{display:flex;flex-direction:column;gap:1px}
.aimrule-picker-foot{display:flex;align-items:center;gap:6px;padding:8px 12px;border-top:.5px solid var(--aim-line)}
.aimrule-picker-foot .aimrule-btn{height:26px;font-size:11px}
.aimrule-composer-mask{position:fixed;inset:0;z-index:15}
.aimrule-panel-section{padding:14px 16px;border-bottom:.5px solid var(--aim-line);display:flex;flex-direction:column;gap:11px}
.aimrule-panel-section:last-child{border-bottom:none}
.aimrule-panel-section h3{font-size:11px;letter-spacing:.02em;color:var(--aim-muted);margin:0;font-weight:600}
.aimrule-inspector{width:336px;flex:none;border-left:.5px solid var(--aim-line);background:var(--aim-base);display:flex;flex-direction:column;min-height:0;overflow:hidden}
.aimrule-inspector-head{flex:none;display:flex;align-items:center;gap:8px;height:50px;padding:0 14px;border-bottom:.5px solid var(--aim-line);background:color-mix(in srgb, var(--aim-base) 94%, transparent);backdrop-filter:blur(12px)}
.aimrule-inspector-head h3{font-size:13px;font-weight:600;margin:0;flex:1}
.aimrule-inspector-glyph{flex:none;width:24px;height:24px;border-radius:7px;display:grid;place-items:center;font-size:11px;font-weight:600}
.aimrule-inspector-title{display:flex;flex-direction:column;gap:1px;flex:1;min-width:0}
.aimrule-inspector-title h3{flex:none;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}
.aimrule-inspector-sub{font-family:var(--ds-font-family-code,ui-monospace,SFMono-Regular,Menlo,monospace);font-size:10px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-inspector-body{flex:1;min-height:0;overflow:auto}
.aimrule-inspector-foot{flex:none;display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:10px 14px;border-top:.5px solid var(--aim-line);background:var(--aim-base)}
.aimrule-inspector-foot .aimrule-btn{height:30px}
.aimrule-field{display:flex;flex-direction:column;gap:6px}
.aimrule-field-label{font-size:11.5px;color:var(--aim-muted)}
.aimrule-input,.aimrule-textarea,.aimrule-select{font:inherit;font-size:12.5px;width:100%;height:32px;color:var(--aim-text);background:var(--aim-layer);border:.5px solid var(--aim-line);border-radius:8px;padding:0 10px;outline:none;transition:border-color .12s,box-shadow .12s}
.aimrule-input:focus,.aimrule-textarea:focus,.aimrule-select:focus{border-color:var(--aim-accent);box-shadow:0 0 0 2px color-mix(in srgb, var(--aim-accent) 14%, transparent)}
.aimrule-textarea{height:auto;min-height:68px;padding:8px 10px;line-height:1.5}
.aimrule-select{appearance:none;padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,var(--aim-muted) 50%),linear-gradient(135deg,var(--aim-muted) 50%,transparent 50%);background-position:calc(100% - 14px) calc(50% - 1px),calc(100% - 9px) calc(50% - 1px);background-size:5px 5px,5px 5px;background-repeat:no-repeat}
.aimrule-edge-path{margin-top:2px;font-size:11px;color:var(--aim-muted);line-height:1.6;word-break:break-word}
.aimrule-selection-list{display:flex;flex-direction:column;gap:1px;max-height:220px;overflow:auto}
.aimrule-selection-row{display:flex;align-items:center;gap:8px;padding:5px 6px;border-radius:7px;font-size:11.5px;color:var(--aim-text)}
.aimrule-selection-row:hover{background:var(--aim-hover)}
.aimrule-selection-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-input:focus,.aimrule-textarea:focus,.aimrule-select:focus{border-color:var(--aim-accent)}
.aimrule-textarea{resize:vertical;min-height:52px;line-height:1.45}
.aimrule-muted{color:var(--aim-muted);font-size:11px;line-height:1.6}
.aimrule-hint{font-size:11px;color:var(--aim-muted);line-height:1.65}
.aimrule-divider{height:1px;background:var(--aim-line);margin:2px 0}
.aimrule-source{border:.5px solid var(--aim-line);border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:2px;background:var(--aim-layer)}
.aimrule-source b{font-size:11px;font-weight:600}
.aimrule-source span{font-size:10px;color:var(--aim-muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aimrule-dock{position:absolute;left:50%;bottom:62px;transform:translateX(-50%);z-index:14;display:flex;align-items:center;gap:6px;padding:6px;border:.5px solid var(--aim-line-strong);border-radius:16px;background:color-mix(in srgb, var(--aim-layer) 92%, transparent);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.28);width:min(660px, calc(100% - 40px));flex-wrap:wrap}
.aimrule-dock-count{font-size:11px;font-weight:600;color:var(--aim-muted);white-space:nowrap;padding-left:6px}
.aimrule-dock-input{flex:1;min-width:180px;font:inherit;font-size:12px;height:32px;border-radius:8px;border:.5px solid var(--aim-line);background:var(--aim-base);color:var(--aim-text);padding:0 11px;outline:none}
.aimrule-dock-input:focus{border-color:var(--aim-accent)}
.aimrule-overlay{position:absolute;inset:0;background:color-mix(in srgb, #000 42%, transparent);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center;z-index:20;padding:24px}
.aimrule-modal{width:min(780px,100%);max-height:min(680px,92%);background:var(--aim-layer);border:.5px solid var(--aim-line-strong);border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.35);display:flex;flex-direction:column;overflow:hidden}
.aimrule-modal-head{display:flex;align-items:center;gap:10px;padding:14px 18px;border-bottom:.5px solid var(--aim-line);flex:none}
.aimrule-modal-head h2{font-size:14px;margin:0;font-weight:600;flex:1}
.aimrule-modal-body{padding:16px 18px;overflow:auto;display:flex;flex-direction:column;gap:12px;min-height:0}
.aimrule-history-btn{width:26px;height:26px;flex:none;display:inline-flex;align-items:center;justify-content:center;padding:0;border:.5px solid var(--aim-line);border-radius:7px;background:var(--aim-layer);color:var(--aim-muted);cursor:pointer;margin-left:2px}
.aimrule-history-btn:hover{background:var(--aim-hover);color:var(--aim-text)}
.aimrule-history-btn:disabled{opacity:.4;cursor:default}
.aimrule-history-count{font-size:11px;color:var(--aim-muted);flex:none}
.aimrule-history-body{gap:12px}
.aimrule-history-toolbar{display:flex;align-items:center;gap:12px;flex:none}
.aimrule-history-summary{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
.aimrule-history-summary b{font-size:12px;font-weight:600;color:var(--aim-text)}
.aimrule-history-summary span{font-size:10.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-history-list{display:flex;flex-direction:column;gap:8px}
.aimrule-history-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border:.5px solid var(--aim-line);border-radius:12px;background:var(--aim-layer);min-width:0}
.aimrule-history-row[data-current=true]{border-color:var(--aim-line-strong);box-shadow:inset 3px 0 0 var(--aim-accent)}
.aimrule-history-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.aimrule-history-name{display:flex;align-items:center;gap:8px;min-width:0}
.aimrule-history-title{min-width:0;display:flex;align-items:center}
.aimrule-history-title b{font-size:12.5px;font-weight:600;color:var(--aim-text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-history-current{flex:none;font-size:9.5px;font-weight:600;color:var(--aim-accent);background:var(--aim-accent-soft);border-radius:999px;padding:0 6px;line-height:16px}
.aimrule-history-meta{font-size:10.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-history-desc{font-size:10.5px;color:var(--aim-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.aimrule-history-actions{display:flex;align-items:center;gap:4px;flex:none}
.aimrule-history-actions .aimrule-btn{height:26px;padding:0 8px;font-size:11px}
.aimrule-history-edit{display:flex;align-items:center;gap:6px;min-width:0;flex:1}
.aimrule-history-edit .aimrule-input{height:28px;font-size:12px;min-width:120px}
.aimrule-history-edit .aimrule-btn{height:26px;padding:0 8px;font-size:11px}
@media (max-width: 720px){.aimrule-history-row{flex-direction:column;align-items:stretch}.aimrule-history-actions{justify-content:flex-end}}
.aimrule-modal-foot{padding:12px 18px;border-top:.5px solid var(--aim-line);display:flex;align-items:center;gap:8px;justify-content:flex-end;flex:none}
.aimrule-tabs{display:flex;gap:2px;border-bottom:.5px solid var(--aim-line);padding:0 12px;flex:none}
.aimrule-tab{font:inherit;font-size:12px;border:0;background:transparent;color:var(--aim-muted);padding:9px 10px;cursor:pointer;border-bottom:2px solid transparent}
.aimrule-tab[data-active=true]{color:var(--aim-text);border-bottom-color:var(--aim-accent);font-weight:600}
.aimrule-pre{margin:0;padding:12px 14px;border-radius:10px;background:var(--aim-base);border:.5px solid var(--aim-line);font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:11.5px;line-height:1.6;white-space:pre-wrap;word-break:break-word;overflow:auto;flex:1;min-height:0}
.aimrule-error{font-size:12px;color:var(--aim-danger);background:color-mix(in srgb, var(--aim-danger) 10%, transparent);border:.5px solid color-mix(in srgb, var(--aim-danger) 30%, transparent);border-radius:8px;padding:8px 10px;white-space:pre-wrap;max-height:180px;overflow:auto}
.aimrule-toast{position:absolute;left:50%;top:14px;transform:translateX(-50%);z-index:30;background:var(--aim-raised);border:.5px solid var(--aim-line-strong);box-shadow:0 12px 32px rgba(0,0,0,.24);border-radius:10px;padding:8px 14px;font-size:12px;color:var(--aim-text);max-width:80%}
.aimrule-toast[data-tone=error]{color:var(--aim-danger)}
.aimrule-badge{flex:none;font-size:10px;line-height:16px;padding:0 6px;border-radius:6px;border:.5px solid var(--aim-line-strong);color:var(--aim-muted)}
.aimrule-badge[data-status=pass]{color:var(--dsw-alias-state-success-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-success-primary) 45%, transparent);background:color-mix(in srgb, var(--dsw-alias-state-success-primary) 10%, transparent)}
.aimrule-badge[data-status=fail],.aimrule-badge[data-status=error]{color:var(--aim-danger);border-color:color-mix(in srgb, var(--aim-danger) 45%, transparent);background:color-mix(in srgb, var(--aim-danger) 10%, transparent)}
.aimrule-badge[data-status=inconclusive]{color:var(--dsw-alias-state-warn-primary);border-color:color-mix(in srgb, var(--dsw-alias-state-warn-primary) 45%, transparent)}
.aimrule-case{border:.5px solid var(--aim-line);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px;background:var(--aim-base)}
.aimrule-case-head{display:flex;align-items:center;gap:8px}
.aimrule-ai-append{display:inline-flex;align-items:center;gap:5px;font-size:11px;color:var(--aim-muted);cursor:pointer;padding:0 4px;white-space:nowrap}
.aimrule-ai-append input{accent-color:var(--aim-accent)}
.aimrule-case-delete{width:28px;padding:0;flex:none;color:var(--aim-muted)}
.aimrule-case-delete:hover{color:var(--aim-danger)}
.aimrule-case-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.aimrule-case-result{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--aim-muted)}
.aimrule-mismatch{color:var(--aim-danger);font-family:ui-monospace,Menlo,monospace}
.aimrule-overview-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.aimrule-stat{border:.5px solid var(--aim-line);border-radius:12px;padding:12px 14px;background:var(--aim-base)}
.aimrule-stat b{display:block;font-size:22px;font-weight:650;line-height:1.2}
.aimrule-stat span{font-size:11px;color:var(--aim-muted)}
.aimrule-legend{display:grid;grid-template-columns:1fr 1fr;gap:6px 14px}
.aimrule-legend-row{display:flex;align-items:center;gap:8px;font-size:11.5px;color:var(--aim-muted)}
.aimrule-legend-dot{width:8px;height:8px;border-radius:2px;flex:none}
.aimrule-shortcuts{display:flex;flex-direction:column;gap:7px;font-size:11.5px;color:var(--aim-muted)}
.aimrule-kbd{font-family:ui-monospace,Menlo,monospace;font-size:10px;padding:1px 5px;border:.5px solid var(--aim-line);border-bottom-width:2px;border-radius:4px;background:var(--aim-base);color:var(--aim-text)}
.aimrule-loading{width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--aim-muted);font-size:13px}
@media (width<=760px){.aimrule-title{width:120px}.aimrule-project{max-width:120px}}

/* ------------------------------------------------------ composer launcher */

.aimrule-launcher-root{display:contents}
.aimrule-launch-button{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:999px;background:transparent !important;color:var(--dsw-alias-label-secondary);cursor:pointer !important;padding:0;flex:none;box-shadow:none !important}
.aimrule-launch-button svg{pointer-events:none}
.aimrule-launch-button:hover,.aimrule-launch-button:active,.aimrule-launch-button:focus{background:transparent !important;border-color:transparent !important;box-shadow:none !important}
.aimrule-launch-button:hover{color:var(--dsw-alias-label-primary)}
.aimrule-launch-button:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:2px}
.aimrule-launcher-mask{position:fixed;inset:0;z-index:1000;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(0,0,0,.46);backdrop-filter:blur(3px)}
.aimrule-launcher{width:min(1240px,94vw);height:min(900px,88vh);display:flex;flex-direction:column;overflow:hidden;background:var(--dsw-alias-bg-base);border:.5px solid var(--dsw-alias-border-l3);border-radius:16px;box-shadow:0 30px 90px rgba(0,0,0,.46)}
.aimrule-launcher-head{flex:none;height:44px;display:flex;align-items:center;gap:10px;padding:0 8px 0 14px;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1)}
.aimrule-launcher-mark{display:inline-flex;align-items:center;justify-content:center;color:var(--dsw-alias-state-business-primary);flex:none}
.aimrule-launcher-heading{display:flex;flex-direction:column;gap:1px;min-width:0}
.aimrule-launcher-heading b{font-size:12.5px;font-weight:600;color:var(--dsw-alias-label-primary);line-height:1.25}
.aimrule-launcher-heading span{font-size:10.5px;color:var(--dsw-alias-label-secondary);line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.aimrule-launcher-spacer{flex:1}
.aimrule-launcher-close{width:28px;height:28px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;padding:0}
.aimrule-launcher-close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.aimrule-launcher-body{flex:1;min-height:0;display:flex;overflow:hidden}
.aimrule-launcher-body > .aimrule-root{flex:1;min-width:0;min-height:0;--dsh-frame-top-clearance:0px}
@media (max-width:720px){.aimrule-launcher-mask{padding:8px}.aimrule-launcher{width:96vw;height:94vh}}

.aimrule-btn:focus-visible,.aimrule-flow-option:focus-visible,.aimrule-tree-row:focus-visible,.aimrule-crumb:focus-visible,.aimrule-module-pick:focus-visible,.aimrule-module-add:focus-visible{outline:2px solid var(--aim-accent);outline-offset:1px}
.aimrule-field input:focus-visible,.aimrule-field textarea:focus-visible,.aimrule-field select:focus-visible,.aimrule-composer-input:focus-visible,.aimrule-run-input:focus-visible,.aimrule-run-expect:focus-visible{border-color:var(--aim-accent);box-shadow:0 0 0 2px var(--aim-accent-soft);outline:none}

`;

  // shared/export.js
  var PROSE = {
    start: "\u5F00\u59CB",
    end: "\u7ED3\u675F",
    judge: "\u5224\u65AD",
    calc: "\u8BA1\u7B97",
    action: "\u52A8\u4F5C",
    module: "\u6A21\u5757"
  };
  function nodeTypeLabel(type) {
    return PROSE[type] || type || "\u8282\u70B9";
  }
  function edgeLabel(edge) {
    return edge.label ? String(edge.label) : "";
  }
  function childrenOf(state, parentId) {
    return (state.nodes || []).filter((node) => (node.parentId || null) === (parentId || null));
  }
  function edgesIn(state, parentId) {
    const scope = parentId || null;
    const byId2 = new Map((state.nodes || []).map((node) => [node.id, node]));
    return (state.edges || []).filter((edge) => {
      const source = byId2.get(edge.source);
      const target = byId2.get(edge.target);
      if (!source || !target) return false;
      return (source.parentId || null) === scope && (target.parentId || null) === scope;
    });
  }
  function byId(state) {
    return new Map((state.nodes || []).map((node) => [node.id, node]));
  }
  function escapeMermaid(text) {
    return String(text == null ? "" : text).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "<br/>");
  }
  function sanitizeId(id) {
    return String(id || "n").replace(/[^A-Za-z0-9_]/g, "_");
  }
  function mermaidShape(node) {
    const label = `"${escapeMermaid(nodeLabel(node))}"`;
    switch (node.type) {
      case "start":
      case "end":
        return `([${label}])`;
      case "judge":
        return `{${label}}`;
      case "calc":
        return `[(${label})]`;
      case "module":
        return `${label}`;
      default:
        return `[${label}]`;
    }
  }
  function nodeLabel(node) {
    const data = node.data || {};
    const base = data.label || node.id;
    if (node.type === "calc" && data.expr) return `${base}: ${data.expr}`;
    return base;
  }
  function mermaidEdges(state, parentId) {
    const lines = [];
    for (const edge of edgesIn(state, parentId)) {
      const label = edgeLabel(edge);
      lines.push(`  ${sanitizeId(edge.source)} ${label ? `-->|${escapeMermaid(label)}|` : "-->"} ${sanitizeId(edge.target)}`);
    }
    return lines;
  }
  function mermaidScope(state, parentId, indent) {
    const pad = "  ".repeat(indent);
    const lines = [];
    for (const node of childrenOf(state, parentId)) {
      if (node.type === "module") {
        lines.push(`${pad}subgraph ${sanitizeId(node.id)}["${escapeMermaid(nodeLabel(node))}"]`);
        const inner = mermaidScope(state, node.id, indent + 1);
        if (inner.length === 0) lines.push(`${pad}  ${sanitizeId(node.id)}_empty["\u7A7A\u6A21\u5757"]`);
        lines.push(...inner);
        lines.push(`${pad}end`);
      } else {
        lines.push(`${pad}${sanitizeId(node.id)}${mermaidShape(node)}`);
      }
    }
    const edges = mermaidEdges(state, parentId);
    for (const line of edges) lines.push(pad + line.trim());
    return lines;
  }
  function describeNode(node) {
    const data = node.data || {};
    const parts = [];
    if (data.label) parts.push(`**${data.label}**`);
    if (node.type === "judge" && data.condition) parts.push(`\u6761\u4EF6\uFF1A\`${data.condition}\``);
    if (node.type === "calc" && data.expr) parts.push(`\u516C\u5F0F\uFF1A\`${data.expr}\``);
    if (data.action) parts.push(`\u52A8\u4F5C\uFF1A${data.action}`);
    if (data.sourceRef) parts.push(`\u6EAF\u6E90\uFF1A${data.sourceRef}`);
    if (data.notes) parts.push(`\u5907\u6CE8\uFF1A${data.notes}`);
    return parts.join("\uFF1B");
  }
  function walkScopes(state, parentId, visit) {
    for (const node of childrenOf(state, parentId)) {
      visit(node, parentId);
      if (node.type === "module") walkScopes(state, node.id, visit);
    }
  }
  function renderFlowMarkdown(state) {
    const project = state.project || {};
    const lines = [];
    lines.push(`# ${project.name || "\u4E1A\u52A1\u903B\u8F91\u6D41\u7A0B"}`);
    lines.push("");
    if (project.description) {
      lines.push(`> ${project.description}`);
      lines.push("");
    }
    lines.push("## \u6D41\u7A0B\u56FE");
    lines.push("");
    lines.push("```mermaid");
    lines.push("flowchart TD");
    const body = mermaidScope(state, null, 1);
    if (body.length === 0) lines.push('  empty["\u5C1A\u672A\u751F\u6210\u8282\u70B9"]');
    lines.push(...body);
    lines.push("```");
    lines.push("");
    lines.push("## \u8282\u70B9\u8BF4\u660E");
    lines.push("");
    let index = 0;
    walkScopes(state, null, (node, parentId) => {
      index += 1;
      const where = parentId ? `\uFF08\u4F4D\u4E8E\u6A21\u5757 \`${parentId}\`\uFF09` : "";
      lines.push(`${index}. \`${node.id}\` \xB7 ${nodeTypeLabel(node.type)}${where}`);
      lines.push(`   - ${describeNode(node)}`);
      const out = edgesIn(state, parentId).filter((edge) => edge.source === node.id);
      for (const edge of out) {
        lines.push(`   - ${edgeLabel(edge) ? `\u5206\u652F\u300C${edgeLabel(edge)}\u300D` : "\u6D41\u5411"} \u2192 \`${edge.target}\``);
      }
    });
    if (index === 0) lines.push("_\u6682\u65E0\u8282\u70B9_");
    const sources = state.sources || [];
    if (sources.length > 0) {
      lines.push("");
      lines.push("## \u8F93\u5165\u6765\u6E90");
      lines.push("");
      for (const source of sources) {
        lines.push(`- **${source.title || "\u672A\u547D\u540D\u6765\u6E90"}**\uFF08${source.kind || "text"}\uFF09`);
      }
    }
    lines.push("");
    return lines.join("\n");
  }
  function nextNodes(state, nodeId) {
    return (state.edges || []).filter((edge) => edge.source === nodeId);
  }
  function pseudoLines(state, parentId, indent, seen) {
    const pad = "  ".repeat(indent);
    const lines = [];
    const nodes = childrenOf(state, parentId);
    if (nodes.length === 0) return lines;
    const map = byId(state);
    const starts = nodes.filter((node) => node.type === "start");
    const roots = starts.length > 0 ? starts : nodes.filter((node) => !(state.edges || []).some((edge) => edge.target === node.id));
    const queue = (roots.length > 0 ? roots : nodes.slice(0, 1)).map((node) => node.id);
    const visited = /* @__PURE__ */ new Set();
    while (queue.length > 0) {
      const id = queue.shift();
      if (visited.has(id)) continue;
      visited.add(id);
      const node = map.get(id);
      if (!node || (node.parentId || null) !== (parentId || null)) continue;
      const data = node.data || {};
      if (node.type === "start") {
        lines.push(`${pad}// \u8F93\u5165\uFF1A${data.label || id}`);
      } else if (node.type === "judge") {
        const outs = nextNodes(state, id).filter((edge) => map.has(edge.target));
        const yes = outs.filter((edge) => edge.label !== "\u5426");
        const no = outs.filter((edge) => edge.label === "\u5426");
        lines.push(`${pad}IF ${data.condition || "\u6761\u4EF6\u5F85\u8865\u5145"} THEN`);
        const body = [];
        for (const edge of yes) body.push(...pseudoForTarget(state, edge, indent + 1, visited));
        lines.push(...body.length > 0 ? body : [`${pad}  // \u5F85\u8865\u5145\u547D\u4E2D\u5206\u652F`]);
        if (no.length > 0) {
          lines.push(`${pad}ELSE`);
          const alt = [];
          for (const edge of no) alt.push(...pseudoForTarget(state, edge, indent + 1, visited));
          lines.push(...alt.length > 0 ? alt : [`${pad}  // \u5F85\u8865\u5145\u672A\u547D\u4E2D\u5206\u652F`]);
        }
        lines.push(`${pad}END IF`);
      } else if (node.type === "calc") {
        lines.push(`${pad}${calcLine(data)}`);
      } else if (node.type === "action") {
        lines.push(`${pad}DO ${data.action || data.label || id}`);
      } else if (node.type === "module") {
        lines.push(`${pad}CALL ${data.label || id}(...)   // \u89C1\u4E0B\u65B9\u6A21\u5757`);
      } else if (node.type === "end") {
        lines.push(`${pad}RETURN ${data.label || "\u7ED3\u679C"}`);
      }
      if (node.type !== "judge") {
        for (const edge of nextNodes(state, id)) {
          const target = map.get(edge.target);
          if (!target) continue;
          if ((target.parentId || null) !== (parentId || null)) continue;
          if (!visited.has(target.id)) queue.push(target.id);
        }
      }
    }
    return lines;
  }
  function calcLine(data) {
    const expr = String(data.expr || "").trim();
    const action = String(data.action || "").trim();
    if (expr) {
      const eq = expr.indexOf("=");
      const before = eq > 0 ? expr[eq - 1] : "";
      const after = eq > 0 ? expr[eq + 1] : "";
      const comparison = [":", "=", "!", "<", ">", "~"].includes(before) || after === "=";
      if (eq > 0 && !comparison) return `${expr.slice(0, eq).trim()} := ${expr.slice(eq + 1).trim()}`;
      if (eq === 0) return `${action || "COMPUTE"} := ${expr}`;
      return `${action || "COMPUTE"} := ${expr}`;
    }
    return `${action || "COMPUTE"} := ${data.label || "\u5F85\u8865\u5145"}`;
  }
  function pseudoForTarget(state, edge, indent, visited) {
    const map = byId(state);
    const node = map.get(edge.target);
    if (!node) return [];
    const source = map.get(edge.source);
    if (source && (node.parentId || null) !== (source.parentId || null)) {
      return [`${"  ".repeat(indent)}CALL ${node.data && node.data.label ? node.data.label : node.id}(...)   // \u8DE8\u6A21\u5757\u8C03\u7528`];
    }
    const pad = "  ".repeat(indent);
    if (visited.has(node.id)) return [`${pad}// \u6C47\u5408\u81F3 ${node.data && node.data.label ? node.data.label : node.id}`];
    visited.add(node.id);
    if (node.type === "judge") {
      return pseudoInlineJudge(state, node, indent, visited);
    }
    const data = node.data || {};
    const lines = [];
    if (node.type === "calc") lines.push(`${pad}${calcLine(data)}`);
    else if (node.type === "action") lines.push(`${pad}DO ${data.action || data.label || node.id}`);
    else if (node.type === "end") lines.push(`${pad}RETURN ${data.label || "\u7ED3\u679C"}`);
    else if (node.type === "module") lines.push(`${pad}CALL ${data.label || node.id}(...)`);
    else lines.push(`${pad}// ${nodeTypeLabel(node.type)}\uFF1A${data.label || node.id}`);
    for (const next of nextNodes(state, node.id)) {
      lines.push(...pseudoForTarget(state, next, indent, visited));
    }
    return lines;
  }
  function pseudoInlineJudge(state, node, indent, visited) {
    const map = byId(state);
    const pad = "  ".repeat(indent);
    const outs = nextNodes(state, node.id).filter((edge) => map.has(edge.target));
    const yes = outs.filter((edge) => edge.label !== "\u5426");
    const no = outs.filter((edge) => edge.label === "\u5426");
    const lines = [`${pad}IF ${(node.data || {}).condition || "\u6761\u4EF6\u5F85\u8865\u5145"} THEN`];
    const hit = [];
    for (const edge of yes) hit.push(...pseudoForTarget(state, edge, indent + 1, visited));
    lines.push(...hit.length > 0 ? hit : [`${pad}  // \u5F85\u8865\u5145`]);
    if (no.length > 0) {
      lines.push(`${pad}ELSE`);
      const miss = [];
      for (const edge of no) miss.push(...pseudoForTarget(state, edge, indent + 1, visited));
      lines.push(...miss.length > 0 ? miss : [`${pad}  // \u5F85\u8865\u5145`]);
    }
    lines.push(`${pad}END IF`);
    return lines;
  }
  function renderPseudo(state) {
    const project = state.project || {};
    const lines = [];
    lines.push(`// ${project.name || "\u4E1A\u52A1\u903B\u8F91"} \u2014\u2014 \u7531 AimRule \u753B\u5E03\u751F\u6210`);
    lines.push("// \u7EA6\u5B9A\uFF1AIF \u6761\u4EF6 THEN \u52A8\u4F5C\uFF1B\u672A\u8986\u76D6\u7684\u5206\u652F\u5FC5\u987B\u663E\u5F0F\u963B\u65AD\u6216\u629B\u9519\u3002");
    lines.push("");
    lines.push("FUNCTION evaluate(input):");
    const rootLines = pseudoLines(state, null, 1, /* @__PURE__ */ new Set());
    lines.push(...rootLines.length > 0 ? rootLines : ["  // \u753B\u5E03\u4E3A\u7A7A"]);
    const modules = [];
    walkScopes(state, null, (node) => {
      if (node.type === "module") modules.push(node);
    });
    for (const module of modules) {
      lines.push("");
      lines.push(`FUNCTION ${module.data && module.data.label ? module.data.label : module.id}(input):`);
      const inner = pseudoLines(state, module.id, 1, /* @__PURE__ */ new Set());
      lines.push(...inner.length > 0 ? inner : ["  // \u7A7A\u6A21\u5757"]);
    }
    lines.push("");
    return lines.join("\n");
  }
  function yamlScalar(value) {
    if (value === null || value === void 0) return "null";
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    const text = String(value);
    if (text === "") return '""';
    if (/^[A-Za-z0-9_\-./\u4e00-\u9fa5]+$/.test(text) && !/^(true|false|null|yes|no|on|off|\d+(\.\d+)?)$/i.test(text)) return text;
    return JSON.stringify(text);
  }
  function isObject(value) {
    return value !== null && typeof value === "object";
  }
  function yamlLines(value, indent) {
    const pad = "  ".repeat(indent);
    if (Array.isArray(value)) {
      if (value.length === 0) return [`${pad}[]`];
      const lines = [];
      for (const item of value) {
        if (isObject(item)) {
          const child = yamlLines(item, indent + 1);
          const first = child[0].slice((indent + 1) * 2);
          lines.push(`${pad}- ${first}`);
          lines.push(...child.slice(1));
        } else {
          lines.push(`${pad}- ${yamlScalar(item)}`);
        }
      }
      return lines;
    }
    if (isObject(value)) {
      const keys = Object.keys(value);
      if (keys.length === 0) return [`${pad}{}`];
      const lines = [];
      for (const key of keys) {
        const item = value[key];
        if (item === void 0) continue;
        if (Array.isArray(item) || isObject(item)) {
          const empty = Array.isArray(item) ? item.length === 0 : Object.keys(item).length === 0;
          if (empty) lines.push(`${pad}${key}: ${Array.isArray(item) ? "[]" : "{}"}`);
          else {
            lines.push(`${pad}${key}:`);
            lines.push(...yamlLines(item, indent + 1));
          }
        } else {
          lines.push(`${pad}${key}: ${yamlScalar(item)}`);
        }
      }
      return lines;
    }
    return [`${pad}${yamlScalar(value)}`];
  }
  function toYaml(value) {
    return yamlLines(value, 0).join("\n");
  }
  function collectInterface(state) {
    const inputs = [];
    const outputs = [];
    const roots = (state.nodes || []).filter((node) => !node.parentId);
    roots.forEach((node) => {
      const data = node.data || {};
      if (node.type === "start") {
        const list = data.outputs || data.inputs;
        if (Array.isArray(list) && list.length > 0) list.forEach((item) => inputs.push({ name: String(item), type: "string" }));
        else inputs.push({ name: data.label || node.id, type: "string" });
      }
      if (node.type === "end") {
        const list = data.inputs || data.outputs;
        if (Array.isArray(list) && list.length > 0) list.forEach((item) => outputs.push({ name: String(item), type: "string" }));
        else outputs.push({ name: data.label || node.id, type: "string" });
      }
    });
    return { inputs, outputs };
  }
  function renderContract(state) {
    const project = state.project || {};
    const iface = collectInterface(state);
    const rules = [];
    walkScopes(state, null, (node) => {
      const data = node.data || {};
      if (node.type === "judge" || node.type === "calc" || node.type === "action") {
        rules.push({
          id: node.id,
          kind: node.type,
          label: data.label || node.id,
          expression: node.type === "judge" ? data.condition || "" : data.expr || "",
          action: data.action || "",
          source: data.sourceRef || ""
        });
      }
    });
    const doc = {
      version: 1,
      name: project.name || "business-rule",
      entry: "evaluate",
      inputs: iface.inputs.map((input) => ({ name: input.name, type: "string", required: true })),
      outputs: iface.outputs.map((output) => ({ name: output.name, type: "string" })),
      rules,
      sources: (state.sources || []).map((source) => ({ title: source.title || "", kind: source.kind || "text" }))
    };
    return toYaml(doc);
  }
  function renderTestCases(state) {
    const project = state.project || {};
    const stored = Array.isArray(state.tests) ? state.tests : [];
    const cases = [];
    if (stored.length > 0) {
      stored.forEach((testCase, index) => {
        const expect = testCase.expect && typeof testCase.expect === "object" ? testCase.expect : {};
        cases.push({
          id: testCase.id || `case_${index + 1}`,
          name: testCase.name || `\u7528\u4F8B ${index + 1}`,
          rule: testCase.rule || void 0,
          input: testCase.inputs || {},
          expect,
          note: Object.keys(expect).length === 0 ? "\u671F\u671B\u503C\u5F85\u8865\u5145" : void 0
        });
      });
    } else {
      let index = 0;
      walkScopes(state, null, (node) => {
        const data = node.data || {};
        if (node.type !== "judge") return;
        index += 1;
        cases.push({
          id: `case_${index}_true`,
          name: `${data.label || node.id} \u547D\u4E2D`,
          rule: node.id,
          input: {},
          expect: {},
          note: "\u671F\u671B\u503C\u5F85\u8865\u5145"
        });
        cases.push({
          id: `case_${index}_false`,
          name: `${data.label || node.id} \u672A\u547D\u4E2D`,
          rule: node.id,
          input: {},
          expect: {},
          note: "\u671F\u671B\u503C\u5F85\u8865\u5145"
        });
      });
    }
    const doc = {
      version: 1,
      suite: project.name || "business-rule",
      defaults: state.testInputs && Object.keys(state.testInputs).length > 0 ? state.testInputs : void 0,
      cases
    };
    return toYaml(doc);
  }
  function buildExports(state) {
    return {
      "flow.md": renderFlowMarkdown(state),
      "logic_pseudo.md": renderPseudo(state),
      "contract.yaml": renderContract(state),
      "test_cases.yaml": renderTestCases(state)
    };
  }

  // shared/evaluate.js
  var STATUS = {
    pass: "pass",
    fail: "fail",
    ok: "ok",
    inconclusive: "inconclusive",
    error: "error"
  };
  var EvalProblem = class extends Error {
    constructor(kind, message) {
      super(message);
      this.kind = kind;
    }
  };
  var IDENT_START = /[\p{L}_]/u;
  var IDENT_PART = /[\p{L}\p{N}_]/u;
  var WORD_OPERATORS = /* @__PURE__ */ new Set(["AND", "OR", "NOT", "TRUE", "FALSE", "NULL"]);
  function tokenize(source) {
    const tokens = [];
    const text = String(source || "");
    let index = 0;
    while (index < text.length) {
      const char = text[index];
      if (/\s/.test(char)) {
        index += 1;
        continue;
      }
      if (char === '"' || char === "'") {
        const quote = char;
        let value = "";
        index += 1;
        while (index < text.length && text[index] !== quote) {
          if (text[index] === "\\" && index + 1 < text.length) {
            index += 1;
            value += text[index];
          } else {
            value += text[index];
          }
          index += 1;
        }
        if (index >= text.length) throw new EvalProblem("error", "\u5B57\u7B26\u4E32\u6CA1\u6709\u95ED\u5408");
        index += 1;
        tokens.push({ type: "literal", value });
        continue;
      }
      if (/[0-9]/.test(char) || char === "." && /[0-9]/.test(text[index + 1] || "")) {
        let raw = "";
        while (index < text.length && /[0-9.]/.test(text[index])) {
          raw += text[index];
          index += 1;
        }
        const value = Number(raw);
        if (!Number.isFinite(value)) throw new EvalProblem("error", `\u975E\u6CD5\u6570\u5B57\uFF1A${raw}`);
        tokens.push({ type: "literal", value });
        continue;
      }
      if (IDENT_START.test(char)) {
        let raw = "";
        while (index < text.length && IDENT_PART.test(text[index])) {
          raw += text[index];
          index += 1;
        }
        const upper = raw.toUpperCase();
        if (WORD_OPERATORS.has(upper)) {
          if (upper === "TRUE") tokens.push({ type: "literal", value: true });
          else if (upper === "FALSE") tokens.push({ type: "literal", value: false });
          else if (upper === "NULL") tokens.push({ type: "literal", value: null });
          else tokens.push({ type: "op", value: upper === "AND" ? "&&" : upper === "OR" ? "||" : "!" });
        } else {
          tokens.push({ type: "ident", value: raw });
        }
        continue;
      }
      const two = text.slice(index, index + 2);
      if (["==", "!=", ">=", "<=", "&&", "||"].includes(two)) {
        tokens.push({ type: "op", value: two });
        index += 2;
        continue;
      }
      if ("><+-*/%!(),".includes(char)) {
        tokens.push({ type: "op", value: char });
        index += 1;
        continue;
      }
      throw new EvalProblem("error", `\u65E0\u6CD5\u8BC6\u522B\u7684\u5B57\u7B26\uFF1A${char}`);
    }
    return tokens;
  }
  function parseExpression(source) {
    const tokens = tokenize(source);
    let cursor = 0;
    const peek = () => tokens[cursor];
    const next = () => tokens[cursor++];
    const expectOp = (value) => {
      const token = next();
      if (!token || token.type !== "op" || token.value !== value) throw new EvalProblem("error", `\u7F3A\u5C11 \u201C${value}\u201D`);
      return token;
    };
    const parseOr = () => {
      let left = parseAnd();
      while (peek() && peek().type === "op" && peek().value === "||") {
        next();
        left = { kind: "binary", op: "||", left, right: parseAnd() };
      }
      return left;
    };
    const parseAnd = () => {
      let left = parseCompare();
      while (peek() && peek().type === "op" && peek().value === "&&") {
        next();
        left = { kind: "binary", op: "&&", left, right: parseCompare() };
      }
      return left;
    };
    const parseCompare = () => {
      const left = parseAdditive();
      const token = peek();
      if (token && token.type === "op" && ["==", "!=", ">=", "<=", ">", "<"].includes(token.value)) {
        next();
        return { kind: "binary", op: token.value, left, right: parseAdditive() };
      }
      return left;
    };
    const parseAdditive = () => {
      let left = parseMultiplicative();
      while (peek() && peek().type === "op" && ["+", "-"].includes(peek().value)) {
        const op = next().value;
        left = { kind: "binary", op, left, right: parseMultiplicative() };
      }
      return left;
    };
    const parseMultiplicative = () => {
      let left = parseUnary();
      while (peek() && peek().type === "op" && ["*", "/", "%"].includes(peek().value)) {
        const op = next().value;
        left = { kind: "binary", op, left, right: parseUnary() };
      }
      return left;
    };
    const parseUnary = () => {
      const token = peek();
      if (token && token.type === "op" && token.value === "!") {
        next();
        return { kind: "unary", op: "!", value: parseUnary() };
      }
      if (token && token.type === "op" && token.value === "-") {
        next();
        return { kind: "unary", op: "-", value: parseUnary() };
      }
      return parsePrimary();
    };
    const parsePrimary = () => {
      const token = next();
      if (!token) throw new EvalProblem("error", "\u8868\u8FBE\u5F0F\u4E0D\u5B8C\u6574");
      if (token.type === "literal") return { kind: "literal", value: token.value };
      if (token.type === "ident") {
        if (peek() && peek().type === "op" && peek().value === "(") {
          next();
          const args = [];
          if (peek() && peek().type === "op" && peek().value === ")") next();
          else {
            args.push(parseOr());
            while (peek() && peek().type === "op" && peek().value === ",") {
              next();
              args.push(parseOr());
            }
            expectOp(")");
          }
          return { kind: "call", name: token.value, args };
        }
        return { kind: "ident", name: token.value };
      }
      if (token.type === "op" && token.value === "(") {
        const value = parseOr();
        expectOp(")");
        return value;
      }
      throw new EvalProblem("error", `\u610F\u5916\u7684\u7B26\u53F7\uFF1A${token.value}`);
    };
    const ast = parseOr();
    if (cursor < tokens.length) throw new EvalProblem("error", `\u8868\u8FBE\u5F0F\u5C3E\u90E8\u6709\u591A\u4F59\u5185\u5BB9\uFF1A${tokens[cursor].value}`);
    return ast;
  }
  function toComparable(value) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed !== "" && Number.isFinite(Number(trimmed))) return Number(trimmed);
      return value;
    }
    return value;
  }
  function compare(op, left, right) {
    if (op === "==") return toComparable(left) === toComparable(right);
    if (op === "!=") return toComparable(left) !== toComparable(right);
    const a = toComparable(left);
    const b = toComparable(right);
    if (op === ">") return a > b;
    if (op === "<") return a < b;
    if (op === ">=") return a >= b;
    if (op === "<=") return a <= b;
    return false;
  }
  var FUNCTIONS = {
    min: (...args) => Math.min(...args.map(Number)),
    max: (...args) => Math.max(...args.map(Number)),
    abs: (value) => Math.abs(Number(value)),
    round: (value, digits) => {
      const factor = 10 ** (digits === void 0 ? 0 : Number(digits));
      return Math.round(Number(value) * factor) / factor;
    },
    floor: (value) => Math.floor(Number(value)),
    ceil: (value) => Math.ceil(Number(value)),
    len: (value) => String(value).length,
    contains: (haystack, needle) => String(haystack).includes(String(needle)),
    lower: (value) => String(value).toLowerCase(),
    upper: (value) => String(value).toUpperCase(),
    number: (value) => Number(value),
    text: (value) => String(value)
  };
  function evaluateAst(ast, variables) {
    switch (ast.kind) {
      case "literal":
        return ast.value;
      case "ident": {
        const value = variables.get(ast.name);
        if (!variables.has(ast.name) || value === null || value === void 0) {
          throw new EvalProblem("missing", `\u7F3A\u5C11\u8F93\u5165\uFF1A${ast.name}`);
        }
        return value;
      }
      case "unary": {
        const value = evaluateAst(ast.value, variables);
        return ast.op === "!" ? !truthy(value) : -Number(value);
      }
      case "binary": {
        if (ast.op === "&&") return truthy(evaluateAst(ast.left, variables)) ? truthy(evaluateAst(ast.right, variables)) : false;
        if (ast.op === "||") return truthy(evaluateAst(ast.left, variables)) ? true : truthy(evaluateAst(ast.right, variables));
        const left = evaluateAst(ast.left, variables);
        const right = evaluateAst(ast.right, variables);
        if (["==", "!=", ">", "<", ">=", "<="].includes(ast.op)) return compare(ast.op, left, right);
        if (ast.op === "+") {
          if (typeof left === "string" || typeof right === "string") return String(left) + String(right);
          return Number(left) + Number(right);
        }
        if (ast.op === "-") return Number(left) - Number(right);
        if (ast.op === "*") return Number(left) * Number(right);
        if (ast.op === "/") return Number(left) / Number(right);
        if (ast.op === "%") return Number(left) % Number(right);
        return null;
      }
      case "call": {
        const fn = FUNCTIONS[ast.name];
        if (!fn) throw new EvalProblem("inconclusive", `\u4E0D\u652F\u6301\u7684\u51FD\u6570\uFF1A${ast.name}`);
        return fn(...ast.args.map((arg) => evaluateAst(arg, variables)));
      }
      default:
        throw new EvalProblem("error", "\u672A\u77E5\u8868\u8FBE\u5F0F");
    }
  }
  function truthy(value) {
    if (typeof value === "string") {
      const text = value.trim().toLowerCase();
      if (["false", "no", "\u5426", "0", ""].includes(text)) return false;
      return text.length > 0;
    }
    return Boolean(value);
  }
  function isObject2(value) {
    return value !== null && typeof value === "object";
  }
  function childrenOf2(nodes, parentId) {
    return nodes.filter((node) => (node.parentId || null) === (parentId || null));
  }
  function outgoing(edges, id) {
    return edges.filter((edge) => edge.source === id);
  }
  function labelKind(label) {
    const text = String(label || "").trim().toLowerCase();
    if (["\u662F", "\u771F", "yes", "true", "y"].includes(text)) return "yes";
    if (["\u5426", "\u5047", "no", "false", "n", "\u5176\u4ED6"].includes(text)) return "no";
    return "";
  }
  function splitAssignment(expression) {
    const text = String(expression || "");
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "=") continue;
      const before = text[index - 1];
      const after = text[index + 1];
      if (["=", "!", "<", ">", ":"].includes(before) || after === "=") continue;
      const target = text.slice(0, index).trim();
      if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(target)) return null;
      return [target, text.slice(index + 1).trim()];
    }
    return null;
  }
  function runCase(doc, testCase) {
    const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
    const edges = Array.isArray(doc.edges) ? doc.edges : [];
    const variables = /* @__PURE__ */ new Map();
    const inputs = isObject2(testCase && testCase.inputs) ? testCase.inputs : {};
    for (const [key, value] of Object.entries(inputs)) variables.set(key, value);
    const trace = [];
    const visited = /* @__PURE__ */ new Set();
    let status = STATUS.ok;
    let message = "";
    let currentNodeId = null;
    const step = (node, detail) => {
      trace.push({ nodeId: node.id, kind: node.type, detail });
    };
    const walk = (scope, depth) => {
      if (depth > 24) throw new EvalProblem("inconclusive", "\u6A21\u5757\u5D4C\u5957\u8FC7\u6DF1");
      const scopeNodes2 = childrenOf2(nodes, scope);
      if (scopeNodes2.length === 0) return;
      const starts = scopeNodes2.filter((node2) => node2.type === "start");
      let node = starts[0] || scopeNodes2[0];
      let steps = 0;
      while (node && steps < 500) {
        steps += 1;
        currentNodeId = node.id;
        if (visited.has(node.id)) {
          step(node, "\u6C47\u5408\uFF0C\u505C\u6B62");
          return;
        }
        visited.add(node.id);
        const data = node.data || {};
        if (node.type === "judge") {
          const condition = String(data.condition || "").trim();
          if (!condition) throw new EvalProblem("error", `\u5224\u65AD\u8282\u70B9\u300C${data.label || node.id}\u300D\u7F3A\u5C11\u6761\u4EF6`);
          let result;
          try {
            result = truthy(evaluateAst(parseExpression(condition), variables));
          } catch (error) {
            if (error instanceof EvalProblem) {
              if (error.kind === "inconclusive") throw error;
              throw new EvalProblem(error.kind, `\u5224\u65AD\u300C${data.label || node.id}\u300D\uFF1A${error.message}`);
            }
            throw error;
          }
          step(node, `${condition} \u2192 ${result ? "\u662F" : "\u5426"}`);
          const outs2 = outgoing(edges, node.id);
          const want = result ? "yes" : "no";
          const picked = outs2.find((edge) => labelKind(edge.label) === want) || outs2.find((edge) => !String(edge.label || "").trim()) || outs2[0];
          if (!picked) return;
          node = nodes.find((item) => item.id === picked.target);
          continue;
        }
        if (node.type === "calc") {
          const expression = String(data.expr || "").trim();
          if (expression) {
            const split = splitAssignment(expression);
            try {
              if (split) {
                const value = evaluateAst(parseExpression(split[1]), variables);
                variables.set(split[0], value);
                step(node, `${split[0]} = ${JSON.stringify(value)}`);
              } else {
                evaluateAst(parseExpression(expression), variables);
                step(node, expression);
              }
            } catch (error) {
              if (error instanceof EvalProblem) {
                if (error.kind === "inconclusive") throw error;
                throw new EvalProblem(error.kind, `\u8BA1\u7B97\u300C${data.label || node.id}\u300D\uFF1A${error.message}`);
              }
              throw error;
            }
          } else {
            step(node, "\u65E0\u516C\u5F0F");
          }
        } else if (node.type === "module") {
          step(node, "\u8FDB\u5165\u6A21\u5757");
          walk(node.id, depth + 1);
        } else if (node.type === "end") {
          step(node, `\u8FD4\u56DE\uFF1A${data.label || node.id}`);
          variables.set("__end", data.label || node.id);
          return;
        } else if (node.type === "action") {
          step(node, data.action || data.label || "\u52A8\u4F5C");
        } else {
          step(node, data.label || node.type);
        }
        const outs = outgoing(edges, node.id);
        if (node.type === "judge") continue;
        if (outs.length === 0) return;
        node = nodes.find((item) => item.id === outs[0].target);
      }
    };
    try {
      walk(null, 0);
    } catch (error) {
      if (error instanceof EvalProblem) {
        return {
          status: error.kind === "inconclusive" ? STATUS.inconclusive : STATUS.error,
          trace,
          variables: Object.fromEntries(variables),
          mismatches: [],
          message: error.message,
          nodeId: currentNodeId
        };
      }
      return {
        status: STATUS.error,
        trace,
        variables: Object.fromEntries(variables),
        mismatches: [],
        message: error.message || String(error),
        nodeId: currentNodeId
      };
    }
    const expect = isObject2(testCase && testCase.expect) ? testCase.expect : {};
    const mismatches = [];
    for (const [key, expected] of Object.entries(expect)) {
      if (expected === null || expected === void 0 || expected === "") continue;
      const actual = variables.has(key) ? variables.get(key) : void 0;
      if (!compare("==", actual, expected)) mismatches.push({ key, expected, actual });
    }
    if (mismatches.length > 0) status = STATUS.fail;
    else if (Object.keys(expect).length > 0) status = STATUS.pass;
    return {
      status,
      trace,
      variables: Object.fromEntries(variables),
      mismatches,
      message: mismatches.length > 0 ? `${mismatches.length} \u9879\u671F\u671B\u503C\u4E0D\u4E00\u81F4` : "",
      nodeId: status === STATUS.fail ? testCase && testCase.rule || currentNodeId : null
    };
  }
  function literalOf(ast) {
    if (!ast) return null;
    if (ast.kind === "literal") return { value: ast.value };
    if (ast.kind === "unary" && ast.op === "-" && ast.value && ast.value.kind === "literal") return { value: -Number(ast.value.value) };
    return null;
  }
  function altValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value + 1 : "\u5176\u4ED6";
    if (typeof value === "boolean") return !value;
    return "\u5176\u4ED6";
  }
  function generateCases(doc) {
    const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
    const rootJudges = nodes.filter((node) => node.type === "judge" && !node.parentId);
    const cases = [];
    let index = 0;
    for (const judge of rootJudges) {
      index += 1;
      const data = judge.data || {};
      let condition = null;
      try {
        condition = parseExpression(String(data.condition || ""));
      } catch {
        condition = null;
      }
      const equality = condition && condition.kind === "binary" && (condition.op === "==" || condition.op === "!=") ? condition.left.kind === "ident" ? { name: condition.left.name, literal: literalOf(condition.right), negate: condition.op === "!=" } : condition.right.kind === "ident" ? { name: condition.right.name, literal: literalOf(condition.left), negate: condition.op === "!=" } : null : null;
      if (equality && equality.literal) {
        const hit = equality.negate ? altValue(equality.literal.value) : equality.literal.value;
        const miss = equality.negate ? equality.literal.value : altValue(equality.literal.value);
        cases.push({
          id: `case_${index}_true`,
          name: `\u300C${data.label || judge.id}\u300D\u547D\u4E2D`,
          inputs: { [equality.name]: hit },
          expect: {},
          rule: judge.id
        });
        cases.push({
          id: `case_${index}_false`,
          name: `\u300C${data.label || judge.id}\u300D\u672A\u547D\u4E2D`,
          inputs: { [equality.name]: miss },
          expect: {},
          rule: judge.id
        });
      } else {
        cases.push({
          id: `case_${index}`,
          name: `\u300C${data.label || judge.id}\u300D\u8DEF\u5F84`,
          inputs: {},
          expect: {},
          rule: judge.id
        });
      }
    }
    if (cases.length === 0) {
      cases.push({ id: "case_1", name: "\u9ED8\u8BA4\u8DD1\u901A", inputs: {}, expect: {} });
    }
    return cases;
  }

  // src/components.jsx
  function AimRuleIcon({ size = 16 }) {
    return h(
      "svg",
      {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        "aria-hidden": true,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.9,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        style: { display: "block", overflow: "visible" }
      },
      h("circle", { cx: 12, cy: 2.6, r: 1.3, fill: "currentColor", stroke: "none" }),
      h("path", { d: "M12 4.2V6.2" }),
      h("path", { d: "M12 6.2 16.4 10.6 12 15 7.6 10.6Z" }),
      h("path", { d: "M7.6 10.6H4.6V16.4", opacity: 0.78 }),
      h("path", { d: "M16.4 10.6H19.4V16.4" }),
      h("circle", { cx: 4.6, cy: 17.5, r: 1.2, fill: "currentColor", stroke: "none", opacity: 0.78 }),
      h("circle", { cx: 19.4, cy: 17.5, r: 1.2, fill: "currentColor", stroke: "none" })
    );
  }
  function AimRuleSidebarIcon({ size = 20 }) {
    return AimRuleIcon({ size });
  }
  function NodeCard({ node, selected, connectTarget, childCount, onMouseDown, onDoubleClick, onConnectStart, onConnectEnd }) {
    const meta = TYPE_META[node.type] || TYPE_META.action;
    const data = node.data || {};
    return h(
      "div",
      {
        className: "aimrule-node",
        "data-node-id": node.id,
        "data-selected": selected,
        "data-connect-target": Boolean(connectTarget),
        "data-module": node.type === "module",
        "data-type": node.type,
        style: { left: posOf(node).x, top: posOf(node).y },
        onMouseDown,
        onDoubleClick,
        onMouseUp: (event) => onConnectEnd(event, node.id),
        title: node.type === "module" ? "\u53CC\u51FB\u8FDB\u5165\u6A21\u5757\u5185\u90E8" : `${meta.label}\uFF1A${data.label || node.id}`
      },
      h(
        "div",
        { className: "aimrule-node-head" },
        h("span", { className: "aimrule-node-glyph", style: { color: meta.color } }, meta.glyph),
        h("span", { className: "aimrule-node-title" }, data.label || node.id),
        node.type === "module" ? h("span", { className: "aimrule-node-badge" }, `${childCount} \u9879`) : null
      ),
      node.type === "judge" && data.condition ? h("div", { className: "aimrule-node-line" }, "IF ", h("b", null, data.condition)) : null,
      node.type === "calc" && data.expr ? h("div", { className: "aimrule-node-line" }, data.expr.includes("=") ? null : "= ", h("b", null, data.expr)) : null,
      node.type !== "judge" && node.type !== "calc" && data.action ? h("div", { className: "aimrule-node-line" }, data.action) : null,
      data.sourceRef ? h("div", { className: "aimrule-node-src" }, "\xA7 ", data.sourceRef) : null,
      h("div", {
        className: "aimrule-handle",
        "data-side": "in",
        title: "\u8F93\u5165\u7AEF\u70B9",
        onMouseDown: (event) => event.stopPropagation(),
        onMouseUp: (event) => onConnectEnd(event, node.id)
      }),
      h("div", {
        className: "aimrule-handle",
        "data-side": "out",
        title: "\u62D6\u62FD\u4EE5\u8FDE\u63A5",
        onMouseDown: (event) => onConnectStart(event, node),
        onMouseUp: (event) => event.stopPropagation()
      })
    );
  }
  function ProjectPicker({ useWorkspaces, useSessions, value, onChange }) {
    const items = useWorkspaces((snapshot) => snapshot.items);
    const byId2 = useSessions((snapshot) => snapshot.byId);
    const didDefault = useRef(false);
    const [open, setOpen] = useState(false);
    const options = useMemo(() => {
      const list = (items || []).map((workspace) => ({
        path: workspace.path,
        title: workspace.title || baseName(workspace.path)
      }));
      if (value && !list.some((item) => item.path === value)) list.unshift({ path: value, title: baseName(value) });
      return list;
    }, [items, value]);
    useEffect(() => {
      if (didDefault.current) return;
      didDefault.current = true;
      let chosen = null;
      try {
        chosen = window.localStorage.getItem("aimrule.project.chosen");
      } catch {
        chosen = null;
      }
      if (chosen === "1" || value) return;
      const rows = Object.values(byId2 || {}).filter((row) => row && row.cwd && row.origin !== "subagent");
      rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const candidate = rows.length > 0 && options.some((item) => item.path === rows[0].cwd) ? rows[0].cwd : options.length > 0 ? options[0].path : "";
      if (candidate) onChange(candidate);
    }, [byId2, onChange, options, value]);
    const current = options.find((item) => item.path === (value || ""));
    return h(
      "div",
      { className: "aimrule-workspace" },
      h(
        "button",
        {
          className: "aimrule-btn aimrule-workspace-trigger",
          "data-kind": "ghost",
          title: value ? `\u5F53\u524D\u5DE5\u4F5C\u533A\uFF1A${value}` : "\u5168\u5C40\u5DE5\u4F5C\u533A",
          onClick: () => setOpen((current2) => !current2)
        },
        h(
          "svg",
          { width: 13, height: 13, viewBox: "0 0 16 16", "aria-hidden": true, style: { flex: "none" } },
          h("path", {
            d: "M1.5 3.5h4.2l1.2 1.4h7.6v7.6H1.5z",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 1.2,
            strokeLinejoin: "round"
          })
        ),
        h("span", { className: "aimrule-workspace-name" }, value ? current ? current.title : baseName(value) : "\u5168\u5C40\u753B\u5E03"),
        h("span", { style: { opacity: 0.6 } }, "\u25BE")
      ),
      open ? h(
        "div",
        { className: "aimrule-flow-menu aimrule-workspace-menu" },
        h(
          "button",
          {
            className: "aimrule-flow-option",
            "data-active": !value,
            onClick: () => {
              onChange("");
              setOpen(false);
            }
          },
          h("span", { className: "aimrule-flow-option-name" }, "\u5168\u5C40\u753B\u5E03")
        ),
        ...options.map(
          (item) => h(
            "button",
            {
              key: item.path,
              className: "aimrule-flow-option",
              "data-active": item.path === value,
              title: item.path,
              onClick: () => {
                onChange(item.path);
                setOpen(false);
              }
            },
            h("span", { className: "aimrule-flow-option-name" }, item.title),
            h("span", { className: "aimrule-flow-option-meta" }, baseName(item.path))
          )
        )
      ) : null,
      open ? h("div", { className: "aimrule-flow-mask", onClick: () => setOpen(false) }) : null
    );
  }

  // src/app.jsx
  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || "");
        const comma = result.indexOf(",");
        resolve(comma >= 0 ? result.slice(comma + 1) : "");
      };
      reader.onerror = () => reject(reader.error || new Error("\u8BFB\u53D6\u6587\u4EF6\u5931\u8D25"));
      reader.readAsDataURL(file);
    });
  }
  async function request(path, options) {
    const response = await fetch(path, {
      headers: { "content-type": "application/json" },
      ...options
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = { ok: false, error: `\u63A5\u53E3\u8FD4\u56DE\u5F02\u5E38\uFF08HTTP ${response.status}\uFF09` };
    }
    if (!response.ok || !data || data.ok === false) {
      const error = new Error(data && data.error || `\u8BF7\u6C42\u5931\u8D25\uFF08HTTP ${response.status}\uFF09`);
      error.detail = data && data.detail;
      error.code = data && data.code;
      throw error;
    }
    return data;
  }
  function pickCurrentSession(state) {
    const rows = Object.values(state && state.byId || {});
    const retained = rows.find((row) => row && row.retainedBy && row.retainedBy.mainView > 0);
    if (retained && retained.id) return retained.id;
    let best = "";
    let bestAt = -Infinity;
    for (const row of rows) {
      if (!row || !row.id || row.subagent || row.blank) continue;
      const at = Number(row.updatedAt) || 0;
      if (at > bestAt) {
        bestAt = at;
        best = row.id;
      }
    }
    return best;
  }
  function SessionWatcher({ useSessions, onResolve }) {
    const resolved = useSessions(pickCurrentSession);
    useEffect(() => {
      if (resolved) onResolve(resolved);
    }, [onResolve, resolved]);
    return null;
  }
  function AimRulePage(props) {
    const useSessions = props && typeof props.useSessions === "function" ? props.useSessions : null;
    const [sessionId, setSessionId] = useState(() => {
      const explicit = props && typeof props.sessionId === "string" ? props.sessionId : "";
      if (explicit) return explicit;
      try {
        return props && typeof props.readCurrentSession === "function" ? props.readCurrentSession() || "" : "";
      } catch {
        return "";
      }
    });
    const projectHooks = props && typeof props.useWorkspaces === "function" && typeof props.useSessions === "function";
    const defaultProject = props && typeof props.defaultProject === "string" ? props.defaultProject : "";
    const autoProjectRef = useRef("");
    const [project, setProject] = useState(() => {
      if (defaultProject) return defaultProject;
      try {
        return window.localStorage.getItem("aimrule.project") || "";
      } catch {
        return "";
      }
    });
    const [flowId, setFlowId] = useState("");
    const [flows, setFlows] = useState([]);
    const [flowsLoading, setFlowsLoading] = useState(true);
    const [flowMenu, setFlowMenu] = useState(false);
    const [historyEditId, setHistoryEditId] = useState("");
    const [historyEditName, setHistoryEditName] = useState("");
    const [historyBusy, setHistoryBusy] = useState(false);
    const [moreMenu, setMoreMenu] = useState(false);
    const [addMenu, setAddMenu] = useState(false);
    const [modules, setModules] = useState([]);
    const [draggingModule, setDraggingModule] = useState(null);
    const [modulePanel, setModulePanel] = useState(false);
    const [toolsMenu, setToolsMenu] = useState(false);
    const [moduleFilter, setModuleFilter] = useState("");
    const [modulePreviewKey, setModulePreviewKey] = useState("");
    const recentStorageKey = `aimrule.recentModules:${project || "global"}`;
    const [recentKeys, setRecentKeys] = useState(() => {
      try {
        const raw = JSON.parse(window.localStorage.getItem(`aimrule.recentModules:${project || "global"}`) || "[]");
        return Array.isArray(raw) ? raw.filter((key) => typeof key === "string").slice(0, 6) : [];
      } catch {
        return [];
      }
    });
    const [modulesLoading, setModulesLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [detectBusy, setDetectBusy] = useState(false);
    const [extractBusy, setExtractBusy] = useState("");
    const [stateDir, setStateDir] = useState("");
    const [doc, setDoc] = useState(null);
    const [focusId, setFocusId] = useState(null);
    const [selection, setSelection] = useState([]);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const [view, setView] = useState({ x: 60, y: 60, k: 1 });
    const [modal, setModal] = useState(null);
    const [busy, setBusy] = useState("");
    const [error, setError] = useState("");
    const [notes, setNotes] = useState([]);
    const [toast, setToast] = useState(null);
    const [syncState, setSyncState] = useState("loading");
    const [marquee, setMarquee] = useState(null);
    const [pendingEdge, setPendingEdge] = useState(null);
    const [connectTarget, setConnectTarget] = useState(null);
    const [panning, setPanning] = useState(false);
    const [canvasMenu, setCanvasMenu] = useState(null);
    const [nodeMenu, setNodeMenu] = useState(null);
    const [canvasTool, setCanvasTool] = useState("select");
    const [exportTab, setExportTab] = useState("flow.md");
    const [genForm, setGenForm] = useState({ text: "" });
    const [composerMenu, setComposerMenu] = useState(false);
    const [composerPicker, setComposerPicker] = useState(null);
    const [refNodes, setRefNodes] = useState([]);
    const [refPaths, setRefPaths] = useState([]);
    const [nodeFilter, setNodeFilter] = useState("");
    const [workspaceEntries, setWorkspaceEntries] = useState([]);
    const [workspaceLoading, setWorkspaceLoading] = useState(false);
    const [workspaceFilter, setWorkspaceFilter] = useState("");
    const [workspaceExpanded, setWorkspaceExpanded] = useState({});
    const [transcriptItems, setTranscriptItems] = useState([]);
    const [transcriptLoading, setTranscriptLoading] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState([]);
    const [uploads, setUploads] = useState([]);
    const [testDrafts, setTestDrafts] = useState([]);
    const [aiAppend, setAiAppend] = useState(true);
    const [testDefaults, setTestDefaults] = useState("{}");
    const [testResults, setTestResults] = useState({});
    const docRef = useRef(null);
    const viewRef = useRef(view);
    const stageRef = useRef(null);
    const pastRef = useRef([]);
    const futureRef = useRef([]);
    const spaceRef = useRef(false);
    const selectionRef = useRef(selection);
    const focusRef = useRef(focusId);
    const saveTimerRef = useRef(null);
    const savedDocRef = useRef(null);
    const loadedForRef = useRef(null);
    const flowsRef = useRef([]);
    const filesInputRef = useRef(null);
    const composerRef = useRef(null);
    const folderInputRef = useRef(null);
    const nodeClipboardRef = useRef(null);
    const moduleWrapRef = useRef(null);
    const moduleDragRef = useRef(false);
    const moduleInsertOffsetRef = useRef(0);
    const ready = doc !== null;
    useEffect(() => {
      docRef.current = doc;
    }, [doc]);
    useEffect(() => {
      viewRef.current = view;
    }, [view]);
    useEffect(() => {
      selectionRef.current = selection;
    }, [selection]);
    useEffect(() => {
      focusRef.current = focusId;
    }, [focusId]);
    const params = [];
    if (project) params.push(`project=${encodeURIComponent(project)}`);
    if (flowId) params.push(`flow=${encodeURIComponent(flowId)}`);
    const flowQuery = params.length ? `?${params.join("&")}` : "";
    const workspaceQuery = project ? `?project=${encodeURIComponent(project)}` : "";
    const cacheKey = `aimrule.state:${project || "global"}:${flowId || "none"}`;
    const flowKey = `${project || "global"}::${flowId || "none"}`;
    useEffect(() => {
      flowsRef.current = flows;
    }, [flows]);
    useEffect(() => {
      if (!flowId) return;
      try {
        window.localStorage.setItem(`aimrule.flow:${project || "global"}`, flowId);
      } catch {
      }
    }, [flowId, project]);
    const chooseProject = useCallback((path2) => {
      const next = path2 || "";
      setProject(next);
      try {
        window.localStorage.setItem("aimrule.project", next);
        window.localStorage.setItem("aimrule.project.chosen", "1");
      } catch {
      }
    }, []);
    useEffect(() => {
      if (!defaultProject || autoProjectRef.current === defaultProject) return;
      autoProjectRef.current = defaultProject;
      chooseProject(defaultProject);
    }, [chooseProject, defaultProject]);
    useEffect(() => {
      try {
        const raw = JSON.parse(window.localStorage.getItem(recentStorageKey) || "[]");
        setRecentKeys(Array.isArray(raw) ? raw.filter((key) => typeof key === "string").slice(0, 6) : []);
      } catch {
        setRecentKeys([]);
      }
    }, [recentStorageKey]);
    const notify = useCallback((text, tone) => {
      setToast({ text, tone: tone || "info", at: Date.now() });
    }, []);
    useEffect(() => {
      if (!toast) return void 0;
      const timer = setTimeout(() => setToast(null), 4200);
      return () => clearTimeout(timer);
    }, [toast]);
    useEffect(() => {
      let alive = true;
      setFlowsLoading(true);
      setFlows([]);
      setFlowId("");
      setFlowMenu(false);
      setCandidates([]);
      setModules([]);
      request(`/aimrule/api/flows${workspaceQuery}`, { method: "GET" }).then(async (data) => {
        if (!alive) return;
        let list = Array.isArray(data.flows) ? data.flows : [];
        let chosen = "";
        try {
          chosen = window.localStorage.getItem(`aimrule.flow:${project || "global"}`) || "";
        } catch {
          chosen = "";
        }
        if (!list.some((item) => item.id === chosen)) chosen = list.length > 0 ? list[0].id : "";
        if (!chosen) {
          const created = await request("/aimrule/api/flows", {
            method: "POST",
            body: JSON.stringify({ project, name: "\u672A\u547D\u540D\u6D41\u7A0B\u56FE" })
          });
          if (!alive) return;
          list = Array.isArray(created.flows) ? created.flows : [];
          chosen = created.flow || (list[0] ? list[0].id : "");
        }
        setFlows(list);
        setFlowId(chosen);
        setFlowsLoading(false);
      }).catch((caught) => {
        if (!alive) return;
        setFlowsLoading(false);
        setError(caught.message || "\u6D41\u7A0B\u56FE\u5217\u8868\u52A0\u8F7D\u5931\u8D25");
        if (project) {
          try {
            window.localStorage.removeItem("aimrule.project");
          } catch {
          }
          chooseProject("");
        }
      });
      return () => {
        alive = false;
      };
    }, [chooseProject, project, workspaceQuery]);
    useEffect(() => {
      if (!flowId || flowsLoading) return void 0;
      if (!flowsRef.current.some((item) => item.id === flowId)) return void 0;
      let alive = true;
      loadedForRef.current = null;
      setDoc(null);
      docRef.current = null;
      setSyncState("loading");
      setSelection([]);
      setFocusId(null);
      setSelectedEdge(null);
      const fallback = () => {
        try {
          const raw = window.localStorage.getItem(cacheKey);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && Array.isArray(parsed.nodes)) {
              const next = hasMissingPositions(parsed) ? layoutState(parsed) : parsed;
              if (!alive) return;
              loadedForRef.current = flowKey;
              setDoc(next);
              docRef.current = next;
              savedDocRef.current = next;
              setSyncState("local");
              setTimeout(() => {
                if (alive) fitView({ minScale: 0.7 });
              }, 60);
              return;
            }
          }
        } catch {
        }
        if (!alive) return;
        const empty = { version: 1, project: { name: "\u672A\u547D\u540D\u4E1A\u52A1\u903B\u8F91", description: "" }, nodes: [], edges: [], templates: [], sources: [], updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
        loadedForRef.current = flowKey;
        setDoc(empty);
        docRef.current = empty;
        savedDocRef.current = empty;
        setSyncState("local");
      };
      request(`/aimrule/api/state${flowQuery}`, { method: "GET" }).then((data) => {
        if (!alive) return;
        let next = data.state;
        if (hasMissingPositions(next)) next = layoutState(next);
        loadedForRef.current = flowKey;
        setStateDir(data.dir || "");
        if (data.warning) notify(data.warning, "error");
        setDoc(next);
        docRef.current = next;
        savedDocRef.current = next;
        setSyncState("synced");
        setTimeout(() => {
          if (alive) fitView({ minScale: 0.7 });
        }, 60);
      }).catch(() => fallback());
      return () => {
        alive = false;
      };
    }, [cacheKey, flowId, flowKey, flowQuery, flowsLoading]);
    useEffect(() => {
      if (!doc || !flowId) return void 0;
      if (loadedForRef.current !== flowKey) return void 0;
      if (savedDocRef.current === doc) return void 0;
      const timer = setTimeout(() => {
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(doc));
        } catch {
        }
        request(`/aimrule/api/state${flowQuery}`, { method: "PUT", body: JSON.stringify({ state: doc }) }).then((data) => {
          savedDocRef.current = doc;
          setSyncState("synced");
          if (Array.isArray(data.flows)) setFlows(data.flows);
        }).catch(() => setSyncState("local"));
      }, 700);
      saveTimerRef.current = timer;
      return () => clearTimeout(timer);
    }, [cacheKey, doc, flowId, flowKey, flowQuery]);
    const applyDoc = useCallback((next, options) => {
      const previous = docRef.current;
      if (!previous) {
        docRef.current = next;
        setDoc(next);
        return;
      }
      if (!options || options.history !== false) {
        pastRef.current.push(previous);
        if (pastRef.current.length > 80) pastRef.current.shift();
        futureRef.current = [];
      }
      docRef.current = next;
      setDoc(next);
    }, []);
    const mutate = useCallback(
      (fn, options) => {
        const current2 = docRef.current;
        if (!current2) return;
        applyDoc(fn(current2), options);
      },
      [applyDoc]
    );
    const undo = useCallback(() => {
      const previous = pastRef.current.pop();
      if (!previous) return;
      futureRef.current.push(docRef.current);
      docRef.current = previous;
      setDoc(previous);
      setSelection((current2) => current2.filter((id) => previous.nodes.some((node) => node.id === id)));
    }, []);
    const redo = useCallback(() => {
      const next = futureRef.current.pop();
      if (!next) return;
      pastRef.current.push(docRef.current);
      docRef.current = next;
      setDoc(next);
    }, []);
    const toWorld = useCallback((clientX, clientY) => {
      const stage = stageRef.current;
      const rect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 };
      const current2 = viewRef.current;
      return { x: (clientX - rect.left - current2.x) / current2.k, y: (clientY - rect.top - current2.y) / current2.k };
    }, []);
    const viewportCenter = useCallback(() => {
      const stage = stageRef.current;
      if (!stage) return { x: 200, y: 160 };
      const rect = stage.getBoundingClientRect();
      const current2 = viewRef.current;
      return { x: (rect.width / 2 - current2.x) / current2.k, y: (rect.height / 2 - current2.y) / current2.k };
    }, []);
    const fitView = useCallback((options) => {
      const stage = stageRef.current;
      const current2 = docRef.current;
      if (!stage || !current2) return;
      const nodes = scopeNodes(current2, focusRef.current);
      if (nodes.length === 0) {
        const next2 = { x: 60, y: 60, k: 1 };
        viewRef.current = next2;
        setView(next2);
        return;
      }
      const rect = stage.getBoundingClientRect();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        const position = posOf(node);
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x + NODE_W);
        maxY = Math.max(maxY, position.y + NODE_H);
      }
      const padding = 60;
      const fitted = Math.min(1.2, Math.max(MIN_K, Math.min((rect.width - padding * 2) / (maxX - minX), (rect.height - padding * 2) / (maxY - minY))));
      const floor = options && Number.isFinite(options.minScale) ? Math.max(MIN_K, options.minScale) : MIN_K;
      const scale = Math.max(fitted, floor);
      const next = {
        k: scale,
        x: fitted < floor ? 48 - minX * scale : (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
        y: 48 - minY * scale
      };
      viewRef.current = next;
      setView(next);
    }, []);
    const zoomBy = useCallback((factor) => {
      const stage = stageRef.current;
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const current2 = viewRef.current;
      const k = Math.min(MAX_K, Math.max(MIN_K, current2.k * factor));
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const next = { k, x: cx - (cx - current2.x) * (k / current2.k), y: cy - (cy - current2.y) * (k / current2.k) };
      viewRef.current = next;
      setView(next);
    }, []);
    useEffect(() => {
      const stage = stageRef.current;
      if (!stage) return void 0;
      const onWheel = (event) => {
        event.preventDefault();
        const current2 = viewRef.current;
        if (event.ctrlKey || event.metaKey) {
          const rect = stage.getBoundingClientRect();
          const mx = event.clientX - rect.left;
          const my = event.clientY - rect.top;
          const k = Math.min(MAX_K, Math.max(MIN_K, current2.k * Math.exp(-event.deltaY * 22e-4)));
          const next = { k, x: mx - (mx - current2.x) * (k / current2.k), y: my - (my - current2.y) * (k / current2.k) };
          viewRef.current = next;
          setView(next);
        } else {
          const next = { ...current2, x: current2.x - event.deltaX, y: current2.y - event.deltaY };
          viewRef.current = next;
          setView(next);
        }
      };
      stage.addEventListener("wheel", onWheel, { passive: false });
      return () => stage.removeEventListener("wheel", onWheel);
    }, [ready]);
    const drill = useCallback((id) => {
      setFocusId(id);
      setSelection([]);
      setSelectedEdge(null);
      const next = { x: 60, y: 60, k: 1 };
      viewRef.current = next;
      setView(next);
    }, []);
    const addNode = useCallback(
      (type, at) => {
        const current2 = docRef.current;
        if (!current2) return;
        const center = at || viewportCenter();
        const node = {
          id: uid("n_"),
          type,
          parentId: focusRef.current,
          pos: { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - NODE_H / 2) },
          data: defaultData(type)
        };
        let edges = current2.edges;
        const selected = selectionRef.current;
        if (selected.length === 1) {
          const source = current2.nodes.find((item) => item.id === selected[0]);
          if (source) {
            const label = source.type === "judge" ? current2.edges.some((edge) => edge.source === source.id && edge.label === "\u662F") ? "\u5426" : "\u662F" : "";
            edges = [...edges, { id: uid("e_"), source: source.id, target: node.id, label }];
          }
        }
        applyDoc({ ...current2, nodes: [...current2.nodes, node], edges });
        setSelection([node.id]);
        setSelectedEdge(null);
      },
      [applyDoc, viewportCenter]
    );
    const copySelection = useCallback((idsArg) => {
      const current2 = docRef.current;
      if (!current2) return false;
      const ids = new Set(Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selectionRef.current);
      if (ids.size === 0) return false;
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of current2.nodes) {
          if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
            ids.add(node.id);
            changed = true;
          }
        }
      }
      const nodes = current2.nodes.filter((node) => ids.has(node.id)).map((node) => ({ ...node, pos: { ...posOf(node) }, data: { ...node.data } }));
      const edges = current2.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge }));
      nodeClipboardRef.current = { nodes, edges };
      notify(`\u5DF2\u590D\u5236 ${nodes.length} \u4E2A\u8282\u70B9`);
      return true;
    }, [notify]);
    const pasteNodes = useCallback(
      (at) => {
        const current2 = docRef.current;
        const clip = nodeClipboardRef.current;
        if (!current2 || !clip || clip.nodes.length === 0) return false;
        const idMap = /* @__PURE__ */ new Map();
        for (const node of clip.nodes) idMap.set(node.id, uid("n_"));
        const minX = Math.min(...clip.nodes.map((node) => posOf(node).x));
        const minY = Math.min(...clip.nodes.map((node) => posOf(node).y));
        const origin = at ? { x: at.x, y: at.y } : { x: minX + 30, y: minY + 30 };
        const dx = origin.x - minX;
        const dy = origin.y - minY;
        const nodes = clip.nodes.map((node) => ({
          ...node,
          id: idMap.get(node.id),
          parentId: node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : focusRef.current,
          pos: { x: Math.round(posOf(node).x + dx), y: Math.round(posOf(node).y + dy) },
          data: { ...node.data }
        }));
        const edges = clip.edges.map((edge) => ({ ...edge, id: uid("e_"), source: idMap.get(edge.source), target: idMap.get(edge.target) })).filter((edge) => edge.source && edge.target);
        applyDoc({ ...current2, nodes: [...current2.nodes, ...nodes], edges: [...current2.edges, ...edges] });
        setSelection([...idMap.values()]);
        setSelectedEdge(null);
        notify(`\u5DF2\u7C98\u8D34 ${nodes.length} \u4E2A\u8282\u70B9`);
        return true;
      },
      [applyDoc, notify]
    );
    const addNodesToComposer = useCallback(
      (ids) => {
        const current2 = docRef.current;
        const valid = (ids || []).filter((id) => current2 && current2.nodes.some((node) => node.id === id));
        if (valid.length === 0) return;
        setRefNodes((existing) => Array.from(/* @__PURE__ */ new Set([...existing, ...valid])));
        setNodeMenu(null);
        setCanvasMenu(null);
        setComposerMenu(false);
        setComposerPicker(null);
        setTimeout(() => {
          if (composerRef.current) composerRef.current.focus();
        }, 30);
        notify(`\u5DF2\u52A0\u5165\u5BF9\u8BDD\u6846 ${valid.length} \u4E2A\u8282\u70B9`);
      },
      [notify]
    );
    const addEdge = useCallback(
      (source, target) => {
        const current2 = docRef.current;
        if (!current2 || source === target) return;
        if (current2.edges.some((edge) => edge.source === source && edge.target === target)) return;
        const sourceNode = current2.nodes.find((node) => node.id === source);
        const label = sourceNode && sourceNode.type === "judge" ? current2.edges.some((edge) => edge.source === source && edge.label === "\u662F") ? "\u5426" : "\u662F" : "";
        applyDoc({ ...current2, edges: [...current2.edges, { id: uid("e_"), source, target, label }] });
      },
      [applyDoc]
    );
    const deleteSelection = useCallback(
      (idsArg) => {
        const current2 = docRef.current;
        if (!current2) return;
        if (selectedEdge && (!Array.isArray(idsArg) || idsArg.length === 0)) {
          applyDoc({ ...current2, edges: current2.edges.filter((edge) => edge.id !== selectedEdge) });
          setSelectedEdge(null);
          return;
        }
        const ids = Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selection;
        if (ids.length === 0) return;
        const doomed = new Set(ids);
        let changed = true;
        while (changed) {
          changed = false;
          for (const node of current2.nodes) {
            if (node.parentId && doomed.has(node.parentId) && !doomed.has(node.id)) {
              doomed.add(node.id);
              changed = true;
            }
          }
        }
        applyDoc({
          ...current2,
          nodes: current2.nodes.filter((node) => !doomed.has(node.id)),
          edges: current2.edges.filter((edge) => !doomed.has(edge.source) && !doomed.has(edge.target))
        });
        setSelection([]);
      },
      [applyDoc, selection, selectedEdge]
    );
    const patchNode = useCallback(
      (id, patch) => {
        mutate((current2) => ({
          ...current2,
          nodes: current2.nodes.map((node) => node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)
        }), { history: false });
      },
      [mutate]
    );
    const pushHistoryOnce = useCallback(() => {
      const current2 = docRef.current;
      if (!current2) return;
      pastRef.current.push(current2);
      if (pastRef.current.length > 80) pastRef.current.shift();
      futureRef.current = [];
    }, []);
    const moveNodes = useCallback((ids, deltaX, deltaY, origins) => {
      const current2 = docRef.current;
      if (!current2) return;
      const set = new Set(ids);
      const next = {
        ...current2,
        nodes: current2.nodes.map((node) => {
          if (!set.has(node.id)) return node;
          const origin = origins[node.id] || posOf(node);
          return { ...node, pos: { x: Math.round(origin.x + deltaX), y: Math.round(origin.y + deltaY) } };
        })
      };
      docRef.current = next;
      setDoc(next);
    }, []);
    const nudgeSelection = useCallback(
      (deltaX, deltaY) => {
        const current2 = docRef.current;
        const ids = selectionRef.current;
        if (!current2 || ids.length === 0) return;
        pushHistoryOnce();
        const set = new Set(ids);
        const next = {
          ...current2,
          nodes: current2.nodes.map((node) => {
            if (!set.has(node.id)) return node;
            const position = posOf(node);
            return { ...node, pos: { x: Math.round(position.x + deltaX), y: Math.round(position.y + deltaY) } };
          })
        };
        docRef.current = next;
        setDoc(next);
      },
      [pushHistoryOnce]
    );
    const beginNodeDrag = useCallback(
      (event, node) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const current2 = docRef.current;
        if (!current2) return;
        let ids = selectionRef.current;
        if (!ids.includes(node.id)) {
          ids = event.shiftKey ? [...ids, node.id] : [node.id];
          setSelection(ids);
          selectionRef.current = ids;
        }
        setSelectedEdge(null);
        const start = toWorld(event.clientX, event.clientY);
        const origins = {};
        for (const item of current2.nodes) if (ids.includes(item.id)) origins[item.id] = { ...posOf(item) };
        let moved = false;
        let pending = null;
        let frame = 0;
        const raf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame.bind(window) : (callback) => setTimeout(callback, 16);
        const cancelRaf = typeof window.cancelAnimationFrame === "function" ? window.cancelAnimationFrame.bind(window) : clearTimeout;
        const flush = () => {
          if (!pending) return;
          const next = pending;
          pending = null;
          moveNodes(ids, next.dx, next.dy, origins);
        };
        pushHistoryOnce();
        const onMove = (moveEvent) => {
          const point = toWorld(moveEvent.clientX, moveEvent.clientY);
          const dx = point.x - start.x;
          const dy = point.y - start.y;
          if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
          moved = true;
          pending = { dx, dy };
          if (!frame) {
            frame = raf(() => {
              frame = 0;
              flush();
            });
          }
        };
        const onUp = () => {
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
          if (frame) cancelRaf(frame);
          frame = 0;
          flush();
          if (!moved) {
            const previous = pastRef.current.pop();
            if (previous) futureRef.current = [];
          }
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      [moveNodes, pushHistoryOnce, toWorld]
    );
    const beginConnect = useCallback(
      (event, node) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const position = posOf(node);
        const start = { x: position.x + NODE_W, y: position.y + NODE_H / 2 };
        setPendingEdge({ from: node.id, start, cursor: start });
        setConnectTarget(null);
        const onMove = (moveEvent) => {
          const point = toWorld(moveEvent.clientX, moveEvent.clientY);
          const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
          const host = element && element.closest ? element.closest("[data-node-id]") : null;
          const target = host ? host.getAttribute("data-node-id") : "";
          setConnectTarget(target && target !== node.id ? target : null);
          setPendingEdge((previous) => previous ? { ...previous, cursor: point } : previous);
        };
        const onUp = (upEvent) => {
          const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
          const host = element && element.closest ? element.closest("[data-node-id]") : null;
          if (host) {
            const target = host.getAttribute("data-node-id");
            if (target && target !== node.id) addEdge(node.id, target);
          }
          setConnectTarget(null);
          setPendingEdge(null);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      [addEdge, toWorld]
    );
    const finishConnect = useCallback(
      (event, targetId) => {
        if (!pendingEdge) return;
        event.stopPropagation();
        if (pendingEdge.from !== targetId) addEdge(pendingEdge.from, targetId);
        setPendingEdge(null);
        setConnectTarget(null);
      },
      [addEdge, pendingEdge]
    );
    const onStageDoubleClick = useCallback(
      (event) => {
        if (event.target.closest && event.target.closest(
          ".aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes, [data-node-id], [data-edge-id]"
        )) {
          return;
        }
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        setCanvasMenu({
          x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
          y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 376)),
          world: toWorld(event.clientX, event.clientY)
        });
        setNodeMenu(null);
      },
      [toWorld]
    );
    const onStageMouseDown = useCallback(
      (event) => {
        if (event.button === 2) return;
        if (event.target.closest && (event.target.closest("[data-node-id]") || event.target.closest("[data-edge-id]"))) return;
        if (event.target.closest && event.target.closest(
          ".aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes"
        )) {
          return;
        }
        const panRequested = event.button === 1 || event.altKey || spaceRef.current || event.button === 0 && canvasTool === "hand" && !event.shiftKey;
        if (panRequested) {
          event.preventDefault();
          const origin = { ...viewRef.current };
          const startX = event.clientX;
          const startY = event.clientY;
          const clearOnClick = event.button === 0 && !event.altKey && !spaceRef.current;
          let moved = false;
          setPanning(true);
          const onMove2 = (moveEvent) => {
            if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 2) moved = true;
            const next = { ...origin, x: origin.x + (moveEvent.clientX - startX), y: origin.y + (moveEvent.clientY - startY) };
            viewRef.current = next;
            setView(next);
          };
          const onUp2 = () => {
            setPanning(false);
            if (clearOnClick && !moved) {
              setSelection([]);
              selectionRef.current = [];
              setSelectedEdge(null);
            }
            window.removeEventListener("mousemove", onMove2);
            window.removeEventListener("mouseup", onUp2);
          };
          window.addEventListener("mousemove", onMove2);
          window.addEventListener("mouseup", onUp2);
          return;
        }
        if (event.button !== 0) return;
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const startScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top };
        const startWorld = toWorld(event.clientX, event.clientY);
        const additive = event.shiftKey;
        if (!additive) {
          setSelection([]);
          selectionRef.current = [];
        }
        setSelectedEdge(null);
        const baseSelection = additive ? selectionRef.current : [];
        const onMove = (moveEvent) => {
          const currentX = moveEvent.clientX - rect.left;
          const currentY = moveEvent.clientY - rect.top;
          const box = {
            x: Math.min(currentX, startScreen.x),
            y: Math.min(currentY, startScreen.y),
            w: Math.abs(currentX - startScreen.x),
            h: Math.abs(currentY - startScreen.y)
          };
          setMarquee(box);
          if (box.w < 3 && box.h < 3) return;
          const current2 = docRef.current;
          if (!current2) return;
          const a = { x: Math.min(startWorld.x, (moveEvent.clientX - rect.left - viewRef.current.x) / viewRef.current.k), y: Math.min(startWorld.y, (moveEvent.clientY - rect.top - viewRef.current.y) / viewRef.current.k) };
          const b = { x: Math.max(startWorld.x, (moveEvent.clientX - rect.left - viewRef.current.x) / viewRef.current.k), y: Math.max(startWorld.y, (moveEvent.clientY - rect.top - viewRef.current.y) / viewRef.current.k) };
          const hits = scopeNodes(current2, focusRef.current).filter((node) => {
            const position = posOf(node);
            return position.x < b.x && position.x + NODE_W > a.x && position.y < b.y && position.y + NODE_H > a.y;
          }).map((node) => node.id);
          const merged = additive ? Array.from(/* @__PURE__ */ new Set([...baseSelection, ...hits])) : hits;
          selectionRef.current = merged;
          setSelection(merged);
        };
        const onUp = () => {
          setMarquee(null);
          window.removeEventListener("mousemove", onMove);
          window.removeEventListener("mouseup", onUp);
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
      },
      [canvasTool, toWorld]
    );
    const onStageContextMenu = useCallback(
      (event) => {
        if (event.target.closest && event.target.closest(
          ".aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes"
        )) {
          return;
        }
        const stage = stageRef.current;
        if (!stage) return;
        const rect = stage.getBoundingClientRect();
        const nodeHost = event.target.closest ? event.target.closest("[data-node-id]") : null;
        if (nodeHost) {
          event.preventDefault();
          const id = nodeHost.getAttribute("data-node-id");
          const inSelection = selectionRef.current.includes(id);
          const ids = inSelection ? [...selectionRef.current] : [id];
          if (!inSelection && (selectionRef.current.length > 0 || selectedEdge)) {
            setSelection([]);
            selectionRef.current = [];
            setSelectedEdge(null);
          }
          setNodeMenu({
            x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
            y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 230)),
            ids
          });
          setCanvasMenu(null);
          return;
        }
        event.preventDefault();
        if (event.target.closest && event.target.closest("[data-edge-id]")) return;
        setCanvasMenu({
          x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
          y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 376)),
          world: toWorld(event.clientX, event.clientY)
        });
        setNodeMenu(null);
      },
      [selectedEdge, toWorld]
    );
    const encapsulate = useCallback(
      (idsArg) => {
        const current2 = docRef.current;
        const ids = Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selection;
        if (!current2 || ids.length === 0) return;
        const chosen = new Set(ids);
        const picked = current2.nodes.filter((node) => chosen.has(node.id));
        if (picked.length === 0) return;
        const moduleId = uid("m_");
        const centerX = picked.reduce((sum, node) => sum + posOf(node).x + NODE_W / 2, 0) / picked.length;
        const centerY = picked.reduce((sum, node) => sum + posOf(node).y + NODE_H / 2, 0) / picked.length;
        const moduleNode = {
          id: moduleId,
          type: "module",
          parentId: focusRef.current,
          pos: { x: Math.round(centerX - NODE_W / 2), y: Math.round(centerY - NODE_H / 2) },
          data: { ...defaultData("module"), label: `\u6A21\u5757 ${current2.nodes.filter((node) => node.type === "module").length + 1}` }
        };
        const nodes = current2.nodes.map((node) => chosen.has(node.id) ? { ...node, parentId: moduleId } : node);
        nodes.push(moduleNode);
        const edges = current2.edges.map((edge) => {
          const fromInside = chosen.has(edge.source);
          const toInside = chosen.has(edge.target);
          if (fromInside && toInside) return edge;
          if (fromInside) return { ...edge, source: moduleId };
          if (toInside) return { ...edge, target: moduleId };
          return edge;
        });
        applyDoc({ ...current2, nodes, edges });
        setSelection([moduleId]);
      },
      [applyDoc, selection]
    );
    const ungroup = useCallback(
      (moduleId) => {
        const current2 = docRef.current;
        if (!current2) return;
        const moduleNode = current2.nodes.find((node) => node.id === moduleId);
        if (!moduleNode) return;
        const parent = moduleNode.parentId || null;
        const nodes = current2.nodes.filter((node) => node.id !== moduleId).map((node) => node.parentId === moduleId ? { ...node, parentId: parent } : node);
        const edges = current2.edges.filter((edge) => edge.source !== moduleId && edge.target !== moduleId);
        applyDoc({ ...current2, nodes, edges });
        setSelection([]);
        if (focusRef.current === moduleId) drill(parent);
      },
      [applyDoc, drill]
    );
    const addFiles = useCallback((fileList) => {
      const incoming = Array.from(fileList || []);
      if (incoming.length === 0) return;
      const next = [...uploads];
      let total = next.reduce((sum, item) => sum + item.size, 0);
      let skipped = 0;
      for (const file of incoming) {
        if (next.length >= 200) {
          skipped += 1;
          continue;
        }
        if (file.size > 2e7 || total + file.size > 3e7) {
          skipped += 1;
          continue;
        }
        const path2 = file.webkitRelativePath || file.name;
        if (next.some((item) => item.path === path2 && item.size === file.size && item.lastModified === file.lastModified)) continue;
        next.push({
          key: `${path2}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 6)}`,
          name: file.name,
          path: path2,
          size: file.size,
          lastModified: file.lastModified || 0,
          file
        });
        total += file.size;
      }
      setUploads(next);
      if (next.length > uploads.length) notify(`\u5DF2\u6DFB\u52A0 ${next.length - uploads.length} \u4E2A\u6587\u4EF6`);
      if (skipped > 0) notify(`${skipped} \u4E2A\u6587\u4EF6\u88AB\u8DF3\u8FC7\uFF08\u5355\u4E2A 20MB / \u603B\u8BA1 30MB / \u6700\u591A 200 \u4E2A\uFF09`, "error");
    }, [notify, uploads]);
    const removeFile = useCallback((key) => {
      setUploads((current2) => current2.filter((item) => item.key !== key));
    }, []);
    const toggleMessage = useCallback((index) => {
      setSelectedMessages(
        (current2) => current2.includes(index) ? current2.filter((item) => item !== index) : [...current2, index].sort((a, b) => a - b)
      );
    }, []);
    const selectAllMessages = useCallback(() => {
      setSelectedMessages(transcriptItems.map((_, index) => index));
    }, [transcriptItems]);
    const clearMessages = useCallback(() => {
      setSelectedMessages([]);
    }, []);
    const loadChatRefs = useCallback(async () => {
      if (transcriptLoading) return;
      if (!sessionId) {
        setTranscriptItems([]);
        setSelectedMessages([]);
        return;
      }
      setTranscriptLoading(true);
      setError("");
      try {
        const data = await request("/aimrule/api/transcript", {
          method: "POST",
          body: JSON.stringify({ sessionId, maxChars: 24e3 })
        });
        const items = Array.isArray(data.items) ? data.items : [];
        setTranscriptItems(items);
        setSelectedMessages(items.map((_, index) => index));
      } catch (caught) {
        setError(caught.message || "\u8BFB\u53D6\u5BF9\u8BDD\u8BB0\u5F55\u5931\u8D25");
      } finally {
        setTranscriptLoading(false);
      }
    }, [sessionId, transcriptLoading]);
    const loadWorkspaceRefs = useCallback(async () => {
      if (workspaceLoading) return;
      setWorkspaceLoading(true);
      setError("");
      try {
        const data = await request(`/aimrule/api/workspace/tree${workspaceQuery}`, { method: "GET" });
        const entries = Array.isArray(data.entries) ? data.entries : [];
        setWorkspaceEntries(entries);
        const topLevel = {};
        for (const node of buildWorkspaceTree(entries)) if (node.type === "dir") topLevel[node.path] = true;
        setWorkspaceExpanded(topLevel);
      } catch (caught) {
        setError(caught.message || "\u8BFB\u53D6\u5DE5\u4F5C\u533A\u6587\u4EF6\u5931\u8D25");
      } finally {
        setWorkspaceLoading(false);
      }
    }, [workspaceLoading, workspaceQuery]);
    const openComposerPicker = useCallback((kind) => {
      setComposerMenu(false);
      setComposerPicker(kind);
      setNodeFilter("");
      setWorkspaceFilter("");
      if (kind === "chat") loadChatRefs();
      if (kind === "workspace") loadWorkspaceRefs();
    }, [loadChatRefs, loadWorkspaceRefs]);
    const toggleNodeRef = useCallback((id) => {
      setRefNodes((current2) => current2.includes(id) ? current2.filter((item) => item !== id) : [...current2, id]);
    }, []);
    const togglePathRef = useCallback((entry) => {
      setRefPaths((current2) => {
        if (current2.some((item) => item.path === entry.path)) return current2.filter((item) => item.path !== entry.path);
        const covered = current2.some((item) => item.type === "dir" && entry.path.startsWith(`${item.path}/`));
        if (covered) return current2;
        if (entry.type === "dir") {
          return [...current2.filter((item) => !item.path.startsWith(`${entry.path}/`)), { path: entry.path, type: "dir" }];
        }
        return [...current2, { path: entry.path, type: "file" }];
      });
    }, []);
    const submitComposer = useCallback(async () => {
      if (busy) return;
      const current2 = docRef.current;
      if (!current2) return;
      const typed = genForm.text.trim();
      const hasRefs = refNodes.length > 0 || selectedMessages.length > 0 || refPaths.length > 0 || uploads.length > 0;
      if (!typed && !hasRefs) {
        notify("\u8BF7\u8F93\u5165\u8981\u6C42\uFF0C\u6216\u7528 \uFF0B \u5F15\u7528\u8282\u70B9\u3001\u5BF9\u8BDD\u8BB0\u5F55\u3001\u5DE5\u4F5C\u533A\u6587\u4EF6", "error");
        return;
      }
      setBusy("generate");
      setError("");
      try {
        const sections = [];
        if (refNodes.length > 0) {
          const context = nodeContextText(current2, refNodes);
          if (context) sections.push(`## \u5F15\u7528\u753B\u5E03
${context}`);
        }
        if (selectedMessages.length > 0) {
          const chat = [...selectedMessages].sort((a, b) => a - b).map((index) => transcriptItems[index]).filter(Boolean).map((item) => `\u3010${item.role}\u3011
${item.text}`).join("\n\n");
          if (chat) sections.push(`## \u5BF9\u8BDD\u8BB0\u5F55
${chat}`);
        }
        if (refPaths.length > 0) {
          const data2 = await request("/aimrule/api/ingest", {
            method: "POST",
            body: JSON.stringify({ project, paths: refPaths.map((item) => item.path) })
          });
          if (data2.text) sections.push(`## \u5DE5\u4F5C\u533A\u6587\u4EF6
${data2.text}`);
        }
        if (uploads.length > 0) {
          const payload = [];
          for (const item of uploads) {
            const data2 = await fileToBase64(item.file);
            if (data2) payload.push({ name: item.path || item.name, data: data2 });
          }
          if (payload.length > 0) {
            const data2 = await request("/aimrule/api/ingest", {
              method: "POST",
              body: JSON.stringify({ files: payload })
            });
            if (data2.text) sections.push(`## \u4E0A\u4F20\u9644\u4EF6
${data2.text}`);
          }
        }
        const source = sections.join("\n\n");
        const text = source || typed;
        const instruction = source ? typed : "";
        if (text.trim().length < 10 && instruction.length < 1) throw new Error("\u8BF7\u8865\u5145\u81F3\u5C11 10 \u4E2A\u5B57\u7684\u6750\u6599\uFF0C\u6216\u5199\u6E05\u63D0\u70BC\u8981\u6C42");
        const data = await request("/aimrule/api/generate", {
          method: "POST",
          body: JSON.stringify({
            text: text.length > 6e4 ? text.slice(-6e4) : text,
            instruction,
            mode: "merge",
            project,
            flow: flowId
          })
        });
        let next = data.state;
        if (hasMissingPositions(next)) next = layoutState(next);
        applyDoc(next);
        setFocusId(null);
        setSelection([]);
        setTimeout(fitView, 40);
        setGenForm({ text: "" });
        setRefNodes([]);
        setSelectedMessages([]);
        setRefPaths([]);
        setUploads([]);
        setComposerPicker(null);
        setComposerMenu(false);
        notify(`\u5DF2\u751F\u6210 ${next.nodes.length} \u4E2A\u8282\u70B9\u3001${next.edges.length} \u6761\u8FDE\u7EBF${data.attempts > 1 ? `\uFF08\u7B2C ${data.attempts} \u6B21\u901A\u8FC7\u6821\u9A8C\uFF09` : ""}`);
        setNotes(Array.isArray(data.notes) ? data.notes : []);
        if (Array.isArray(data.flows)) setFlows(data.flows);
      } catch (caught) {
        setError(caught.message || "\u751F\u6210\u5931\u8D25");
      } finally {
        setBusy("");
      }
    }, [applyDoc, busy, fitView, flowId, genForm, notify, project, refNodes, refPaths, selectedMessages, transcriptItems, uploads]);
    useEffect(() => {
      if (selection.length > 0 || selectedEdge) {
        setComposerMenu(false);
        setComposerPicker(null);
      }
    }, [selection, selectedEdge]);
    useEffect(() => {
      setRefNodes([]);
      setRefPaths([]);
      setGenForm({ text: "" });
      setComposerMenu(false);
      setComposerPicker(null);
    }, [flowId]);
    const createFlow = useCallback(async () => {
      if (busy) return;
      setBusy("flow");
      setError("");
      try {
        const data = await request("/aimrule/api/flows", {
          method: "POST",
          body: JSON.stringify({ project, name: "\u672A\u547D\u540D\u6D41\u7A0B\u56FE" })
        });
        if (Array.isArray(data.flows)) setFlows(data.flows);
        setFlowId(data.flow || "");
        notify("\u5DF2\u65B0\u5EFA\u7A7A\u767D\u6D41\u7A0B\u56FE");
      } catch (caught) {
        setError(caught.message || "\u65B0\u5EFA\u6D41\u7A0B\u56FE\u5931\u8D25");
      } finally {
        setBusy("");
      }
    }, [busy, notify, project]);
    const deleteFlow = useCallback(async () => {
      if (busy) return;
      if (flows.length <= 1) {
        notify("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u6D41\u7A0B\u56FE", "error");
        return;
      }
      const name = docRef.current && docRef.current.project.name || "\u5F53\u524D\u6D41\u7A0B\u56FE";
      if (!window.confirm(`\u5220\u9664\u6D41\u7A0B\u56FE\u300C${name}\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`)) return;
      setBusy("flow");
      setError("");
      try {
        const data = await request("/aimrule/api/flows/delete", {
          method: "POST",
          body: JSON.stringify({ project, flow: flowId })
        });
        const list = Array.isArray(data.flows) ? data.flows : [];
        setFlows(list);
        setFlowId(list.length > 0 ? list[0].id : "");
        notify("\u5DF2\u5220\u9664\u6D41\u7A0B\u56FE");
      } catch (caught) {
        setError(caught.message || "\u5220\u9664\u6D41\u7A0B\u56FE\u5931\u8D25");
      } finally {
        setBusy("");
      }
    }, [busy, flowId, flows.length, notify, project]);
    const openHistory = useCallback(() => {
      setFlowMenu(false);
      setHistoryEditId("");
      setHistoryEditName("");
      setModal("history");
      request(`/aimrule/api/flows${workspaceQuery}`, { method: "GET" }).then((data) => {
        if (Array.isArray(data.flows)) setFlows(data.flows);
      }).catch(() => {
      });
    }, [workspaceQuery]);
    const beginHistoryRename = useCallback((item) => {
      setHistoryEditId(item.id);
      setHistoryEditName(item.name || "");
    }, []);
    const renameFlowById = useCallback(
      async (id, rawName) => {
        const name = String(rawName || "").trim();
        if (!name) {
          notify("\u753B\u5E03\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A", "error");
          return;
        }
        if (historyBusy) return;
        setHistoryBusy(true);
        try {
          if (id === flowId) {
            mutate((state) => ({ ...state, project: { ...state.project, name } }), { history: false });
            setFlows((current2) => current2.map((item) => item.id === id ? { ...item, name } : item));
          } else {
            const query = `?project=${encodeURIComponent(project || "")}&flow=${encodeURIComponent(id)}`;
            const data = await request(`/aimrule/api/state${query}`, { method: "GET" });
            const state = data.state;
            const saved = await request(`/aimrule/api/state${query}`, {
              method: "PUT",
              body: JSON.stringify({ state: { ...state, project: { ...state.project, name } } })
            });
            if (Array.isArray(saved.flows)) setFlows(saved.flows);
          }
          setHistoryEditId("");
          setHistoryEditName("");
          notify("\u5DF2\u91CD\u547D\u540D\u753B\u5E03");
        } catch (caught) {
          notify(caught.message || "\u91CD\u547D\u540D\u5931\u8D25", "error");
        } finally {
          setHistoryBusy(false);
        }
      },
      [flowId, historyBusy, mutate, notify, project]
    );
    const deleteFlowById = useCallback(
      async (id) => {
        if (historyBusy) return;
        if (flows.length <= 1) {
          notify("\u81F3\u5C11\u4FDD\u7559\u4E00\u4E2A\u753B\u5E03", "error");
          return;
        }
        const item = flows.find((row) => row.id === id);
        if (!window.confirm(`\u5220\u9664\u753B\u5E03\u300C${item && item.name || id}\u300D\uFF1F\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002`)) return;
        setHistoryBusy(true);
        try {
          const data = await request("/aimrule/api/flows/delete", {
            method: "POST",
            body: JSON.stringify({ project, flow: id })
          });
          const list = Array.isArray(data.flows) ? data.flows : [];
          setFlows(list);
          if (id === flowId) setFlowId(list.length > 0 ? list[0].id : "");
          if (historyEditId === id) {
            setHistoryEditId("");
            setHistoryEditName("");
          }
          notify("\u5DF2\u5220\u9664\u753B\u5E03");
        } catch (caught) {
          notify(caught.message || "\u5220\u9664\u753B\u5E03\u5931\u8D25", "error");
        } finally {
          setHistoryBusy(false);
        }
      },
      [flowId, flows, historyBusy, historyEditId, notify, project]
    );
    const loadModules = useCallback(async (open) => {
      if (open) setModal("modules");
      setModulesLoading(true);
      setError("");
      try {
        const data = await request(`/aimrule/api/modules${workspaceQuery}`, { method: "GET" });
        setModules(Array.isArray(data.modules) ? data.modules : []);
      } catch (caught) {
        setError(caught.message || "\u6A21\u5757\u5E93\u52A0\u8F7D\u5931\u8D25");
      } finally {
        setModulesLoading(false);
      }
    }, [workspaceQuery]);
    const openModules = useCallback(() => {
      loadModules(true);
    }, [loadModules]);
    useEffect(() => {
      if (!modulePanel) return void 0;
      const onDown = (event) => {
        if (moduleWrapRef.current && moduleWrapRef.current.contains(event.target)) return;
        setModulePanel(false);
      };
      document.addEventListener("mousedown", onDown);
      return () => document.removeEventListener("mousedown", onDown);
    }, [modulePanel]);
    const detectModules = useCallback(async () => {
      if (detectBusy) return;
      setDetectBusy(true);
      setError("");
      try {
        const data = await request("/aimrule/api/modules/detect", {
          method: "POST",
          body: JSON.stringify({ project })
        });
        const list = Array.isArray(data.candidates) ? data.candidates : [];
        setCandidates(list);
        notify(list.length > 0 ? `\u68C0\u6D4B\u5230 ${list.length} \u4E2A\u53EF\u590D\u7528\u5019\u9009` : "\u6CA1\u6709\u68C0\u6D4B\u5230\u8DE8\u6D41\u7A0B\u56FE\u91CD\u590D\u7684\u5B50\u56FE");
      } catch (caught) {
        setError(caught.message || "\u590D\u7528\u68C0\u6D4B\u5931\u8D25");
      } finally {
        setDetectBusy(false);
      }
    }, [detectBusy, notify, project]);
    const reloadCurrentFlow = useCallback(async () => {
      if (!flowId) return;
      setError("");
      try {
        const data = await request(`/aimrule/api/state${flowQuery}`, { method: "GET" });
        let next = data.state;
        if (hasMissingPositions(next)) next = layoutState(next);
        loadedForRef.current = flowKey;
        savedDocRef.current = next;
        docRef.current = next;
        setDoc(next);
        setSelection([]);
        setSelectedEdge(null);
        setSyncState("synced");
      } catch (caught) {
        setError(caught.message || "\u91CD\u65B0\u52A0\u8F7D\u6D41\u7A0B\u56FE\u5931\u8D25");
      }
    }, [flowId, flowKey, flowQuery]);
    const extractCandidate = useCallback(async (candidate, occurrence) => {
      if (extractBusy) return;
      const key = `${occurrence.flowId}:${candidate.name}`;
      setExtractBusy(key);
      setError("");
      try {
        await request("/aimrule/api/modules/extract", {
          method: "POST",
          body: JSON.stringify({
            project,
            flowId: occurrence.flowId,
            nodeIds: occurrence.nodeIds,
            name: candidate.name,
            reason: candidate.reason
          })
        });
        notify(`\u5DF2\u5728\u300C${occurrence.flowName}\u300D\u628A\u300C${candidate.name}\u300D\u62BD\u4E3A\u6A21\u5757`);
        setCandidates(
          (list) => list.map(
            (item) => item !== candidate ? item : {
              ...item,
              occurrences: item.occurrences.filter(
                (entry) => !(entry.flowId === occurrence.flowId && entry.nodeIds.join(",") === occurrence.nodeIds.join(","))
              )
            }
          ).filter((item) => item.occurrences.length >= 2)
        );
        await loadModules(false);
        request(`/aimrule/api/flows${workspaceQuery}`, { method: "GET" }).then((data) => {
          if (Array.isArray(data.flows)) setFlows(data.flows);
        }).catch(() => {
        });
        if (occurrence.flowId === flowId) await reloadCurrentFlow();
      } catch (caught) {
        setError(caught.message || "\u62BD\u53D6\u6A21\u5757\u5931\u8D25");
      } finally {
        setExtractBusy("");
      }
    }, [extractBusy, flowId, loadModules, notify, project, reloadCurrentFlow]);
    const rememberModule = useCallback(
      (entry) => {
        if (!entry || !entry.key) return;
        setRecentKeys((previous) => {
          const next = [entry.key, ...previous.filter((key) => key !== entry.key)].slice(0, 6);
          try {
            window.localStorage.setItem(recentStorageKey, JSON.stringify(next));
          } catch {
          }
          return next;
        });
      },
      [recentStorageKey]
    );
    const insertModule = useCallback((entry, at) => {
      const current2 = docRef.current;
      if (!current2 || !entry || !Array.isArray(entry.nodes) || entry.nodes.length === 0) return;
      const remap = /* @__PURE__ */ new Map();
      for (const node of entry.nodes) {
        remap.set(node.id, uid(node.id === entry.moduleId ? "m_" : "n_"));
      }
      const moduleId = remap.get(entry.moduleId);
      if (!moduleId) return;
      const scope = focusRef.current;
      const center = viewportCenter();
      const stamp = `\u590D\u7528\u81EA ${entry.flowName} / ${entry.name}`;
      const nodes = entry.nodes.map((node) => {
        const isRoot = node.id === entry.moduleId;
        return {
          ...node,
          id: remap.get(node.id),
          parentId: isRoot ? scope : node.parentId && remap.has(node.parentId) ? remap.get(node.parentId) : moduleId,
          pos: isRoot ? { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - NODE_H / 2) } : { ...posOf(node) },
          data: {
            ...node.data,
            notes: [node.data && node.data.notes, stamp].filter(Boolean).join("\uFF1B")
          }
        };
      });
      const edges = entry.edges.filter((edge) => remap.has(edge.source) && remap.has(edge.target)).map((edge) => ({
        id: uid("e_"),
        source: remap.get(edge.source),
        target: remap.get(edge.target),
        label: edge.label || ""
      }));
      applyDoc({ ...current2, nodes: [...current2.nodes, ...nodes], edges: [...current2.edges, ...edges] });
      setSelection([moduleId]);
      setSelectedEdge(null);
      setModal(null);
      rememberModule(entry);
      notify(`\u5DF2\u63D2\u5165\u6A21\u5757\u300C${entry.name}\u300D\uFF08${entry.flowName}\uFF09`);
    }, [applyDoc, notify, rememberModule]);
    const insertModuleFromPanel = useCallback(
      (entry) => {
        const center = viewportCenter();
        const step = moduleInsertOffsetRef.current % 5;
        moduleInsertOffsetRef.current += 1;
        insertModule(entry, { x: center.x + step * 24, y: center.y + step * 24 });
      },
      [insertModule, viewportCenter]
    );
    const onStageDragOver = useCallback(
      (event) => {
        const types = Array.from(event.dataTransfer && event.dataTransfer.types || []);
        if (types.includes("Files")) {
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
          return;
        }
        if (!draggingModule) return;
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      },
      [draggingModule]
    );
    const onStageDrop = useCallback(
      (event) => {
        const files2 = event.dataTransfer && event.dataTransfer.files;
        if (files2 && files2.length > 0) {
          event.preventDefault();
          addFiles(files2);
          return;
        }
        if (!draggingModule) return;
        event.preventDefault();
        const point = toWorld(event.clientX, event.clientY);
        const entry = draggingModule;
        setDraggingModule(null);
        insertModule(entry, point);
      },
      [addFiles, draggingModule, insertModule, toWorld]
    );
    const parseObject = (text, label) => {
      let value;
      try {
        value = JSON.parse(String(text || "{}"));
      } catch (caught) {
        throw new Error(`${label} \u4E0D\u662F\u5408\u6CD5 JSON\uFF1A${caught.message}`);
      }
      if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} \u5FC5\u987B\u662F JSON \u5BF9\u8C61`);
      return value;
    };
    const toDraft = (testCase) => ({
      id: testCase.id,
      name: testCase.name || testCase.id,
      rule: testCase.rule || "",
      inputs: JSON.stringify(testCase.inputs || {}),
      expect: JSON.stringify(testCase.expect || {})
    });
    const openTests = useCallback(() => {
      const current2 = docRef.current;
      if (!current2) return;
      setTestDrafts((current2.tests || []).map(toDraft));
      setTestDefaults(JSON.stringify(current2.testInputs || {}));
      setTestResults({});
      setError("");
      setModal("tests");
    }, []);
    const generateTests = useCallback(() => {
      const current2 = docRef.current;
      if (!current2) return;
      const cases = generateCases(current2);
      setTestDrafts(cases.map(toDraft));
      setTestResults({});
      notify(`\u5DF2\u751F\u6210 ${cases.length} \u6761\u7528\u4F8B\uFF1B\u8BF7\u5728\u9ED8\u8BA4\u8F93\u5165\u91CC\u586B\u516C\u5171\u5165\u53C2\uFF0C\u518D\u8865\u671F\u671B\u503C`);
    }, [notify]);
    const aiGenerateTests = useCallback(async () => {
      const current2 = docRef.current;
      if (!current2 || busy) return;
      setBusy("tests");
      setError("");
      try {
        const data = await request("/aimrule/api/tests/generate", {
          method: "POST",
          body: JSON.stringify({ project, flow: flowId, doc: current2 })
        });
        const cases = Array.isArray(data.cases) ? data.cases : [];
        const generated = cases.map(toDraft);
        if (aiAppend) {
          const usedIds = new Set(testDrafts.map((draft) => draft.id));
          const usedNames = new Set(testDrafts.map((draft) => draft.name));
          const merged = [...testDrafts];
          for (const draft of generated) {
            let id = draft.id;
            let suffix = 2;
            while (usedIds.has(id)) {
              id = `${draft.id}_${suffix}`;
              suffix += 1;
            }
            usedIds.add(id);
            let name = draft.name;
            let nameSuffix = 2;
            while (usedNames.has(name)) {
              name = `${draft.name} ${nameSuffix}`;
              nameSuffix += 1;
            }
            usedNames.add(name);
            merged.push({ ...draft, id, name });
          }
          setTestDrafts(merged);
          let existingDefaults = {};
          try {
            existingDefaults = parseObject(testDefaults, "\u9ED8\u8BA4\u8F93\u5165");
          } catch {
            existingDefaults = {};
          }
          setTestDefaults(JSON.stringify({ ...existingDefaults, ...data.defaults || {} }));
        } else {
          setTestDrafts(generated);
          setTestDefaults(JSON.stringify(data.defaults || {}));
          setTestResults({});
        }
        const note = Array.isArray(data.notes) && data.notes.length > 0 ? `\uFF1B${data.notes[0]}` : "";
        notify(`AI ${aiAppend ? "\u8FFD\u52A0" : "\u751F\u6210"} ${cases.length} \u6761\u7528\u4F8B${note}`);
      } catch (caught) {
        notify(caught.message || "AI \u751F\u6210\u6D4B\u8BD5\u7528\u4F8B\u5931\u8D25", "error");
      } finally {
        setBusy("");
      }
    }, [aiAppend, busy, flowId, notify, project, testDefaults, testDrafts]);
    const collectTests = useCallback(() => {
      const defaults = parseObject(testDefaults, "\u9ED8\u8BA4\u8F93\u5165");
      const cases = testDrafts.map((draft) => ({
        id: draft.id,
        name: draft.name || draft.id,
        rule: draft.rule || void 0,
        inputs: parseObject(draft.inputs, `\u7528\u4F8B\u300C${draft.name}\u300D\u7684\u8F93\u5165`),
        expect: parseObject(draft.expect, `\u7528\u4F8B\u300C${draft.name}\u300D\u7684\u671F\u671B`)
      }));
      return { defaults, cases };
    }, [testDefaults, testDrafts]);
    const runTests = useCallback(
      (onlyId) => {
        const current2 = docRef.current;
        if (!current2) return;
        let collected;
        try {
          collected = collectTests();
        } catch (caught) {
          notify(caught.message, "error");
          return;
        }
        const targets = onlyId ? collected.cases.filter((item) => item.id === onlyId) : collected.cases;
        if (targets.length === 0) {
          notify("\u6CA1\u6709\u53EF\u8FD0\u884C\u7684\u7528\u4F8B", "error");
          return;
        }
        const next = onlyId ? { ...testResults } : {};
        for (const testCase of targets) {
          next[testCase.id] = runCase(current2, { ...testCase, inputs: { ...collected.defaults, ...testCase.inputs } });
        }
        setTestResults(next);
        applyDoc({ ...current2, tests: collected.cases, testInputs: collected.defaults });
        const values = Object.values(next);
        const count = (status) => values.filter((item) => item.status === status).length;
        notify(`\u8FD0\u884C\u5B8C\u6210\uFF1A\u901A\u8FC7 ${count("pass")} \xB7 \u5931\u8D25 ${count("fail")} \xB7 \u51FA\u9519 ${count("error")} \xB7 \u5176\u4ED6 ${count("inconclusive") + count("ok")}`);
      },
      [applyDoc, collectTests, notify, testResults]
    );
    const saveTests = useCallback(() => {
      const current2 = docRef.current;
      if (!current2) return;
      try {
        const collected = collectTests();
        applyDoc({ ...current2, tests: collected.cases, testInputs: collected.defaults });
        notify("\u7528\u4F8B\u5DF2\u4FDD\u5B58");
      } catch (caught) {
        notify(caught.message, "error");
      }
    }, [applyDoc, collectTests, notify]);
    const locateNode = useCallback((nodeId) => {
      const current2 = docRef.current;
      if (!current2 || !nodeId) return;
      const node = current2.nodes.find((item) => item.id === nodeId);
      if (!node) return;
      setModal(null);
      setFocusId(node.parentId || null);
      setSelection([node.id]);
      setSelectedEdge(null);
      const stage = stageRef.current;
      const rect = stage ? stage.getBoundingClientRect() : { width: 800, height: 600 };
      const position = posOf(node);
      const next = {
        k: 1,
        x: rect.width / 2 - (position.x + NODE_W / 2),
        y: rect.height / 2 - (position.y + NODE_H / 2)
      };
      viewRef.current = next;
      setView(next);
    }, []);
    const files = useMemo(() => doc ? buildExports(doc) : {}, [doc]);
    const download = useCallback(
      (name, content) => {
        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 2e3);
      },
      []
    );
    useEffect(() => {
      const onKeyDown = (event) => {
        const target = event.target;
        const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
        if (tag === "input" || tag === "textarea" || tag === "select" || target && target.isContentEditable) return;
        if (event.key === " ") {
          spaceRef.current = true;
          return;
        }
        if (event.key === "Delete" || event.key === "Backspace") {
          event.preventDefault();
          deleteSelection();
          return;
        }
        if (event.key.startsWith("Arrow") && selectionRef.current.length > 0) {
          if (modal || addMenu || canvasMenu || nodeMenu || flowMenu || moreMenu || composerMenu || composerPicker || modulePanel || toolsMenu) return;
          event.preventDefault();
          const step = event.shiftKey ? 10 : 1;
          nudgeSelection(
            event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0,
            event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0
          );
          return;
        }
        if (event.key === "Escape") {
          const hadOverlay = Boolean(
            modal || selection.length > 0 || selectedEdge || composerMenu || composerPicker || flowMenu || moreMenu || addMenu || canvasMenu || nodeMenu
          );
          setSelection([]);
          setSelectedEdge(null);
          setModal(null);
          setCanvasMenu(null);
          setNodeMenu(null);
          setComposerMenu(false);
          setComposerPicker(null);
          setModulePanel(false);
          setToolsMenu(false);
          setFlowMenu(false);
          setMoreMenu(false);
          setAddMenu(false);
          if (hadOverlay) return;
          if (focusRef.current) {
            const current2 = docRef.current;
            const pathNow = current2 ? pathOf(current2, focusRef.current) : [];
            drill(pathNow.length > 1 ? pathNow[pathNow.length - 2].id : null);
          }
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "c") {
          if (copySelection()) event.preventDefault();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "v") {
          if (pasteNodes()) event.preventDefault();
          return;
        }
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) redo();
          else undo();
        }
      };
      const onKeyUp = (event) => {
        if (event.key === " ") spaceRef.current = false;
      };
      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
    }, [addMenu, canvasMenu, composerMenu, composerPicker, copySelection, deleteSelection, drill, flowMenu, modal, modulePanel, moreMenu, nodeMenu, nudgeSelection, pasteNodes, redo, selectedEdge, selection.length, toolsMenu, undo]);
    const workspaceTree = useMemo(
      () => filterWorkspaceTree(buildWorkspaceTree(workspaceEntries), workspaceFilter),
      [workspaceEntries, workspaceFilter]
    );
    const visibleModules = useMemo(() => {
      const query = moduleFilter.trim().toLowerCase();
      if (!query) return modules;
      return modules.filter((entry) => {
        const nodeText = (entry.nodes || []).map((node) => {
          const data = node.data || {};
          return `${data.label || ""} ${data.condition || ""} ${data.action || ""} ${data.expr || ""} ${data.notes || ""}`;
        }).join(" ");
        return `${entry.name} ${entry.flowName} ${nodeText}`.toLowerCase().includes(query);
      });
    }, [moduleFilter, modules]);
    const recentEntries = useMemo(() => {
      if (moduleFilter.trim()) return [];
      const byKey = new Map(modules.map((entry) => [entry.key, entry]));
      return recentKeys.map((key) => byKey.get(key)).filter(Boolean);
    }, [moduleFilter, modules, recentKeys]);
    const moduleGroups = useMemo(() => {
      const flowModules = recentEntries.length > 0 ? visibleModules.filter((entry) => !recentKeys.includes(entry.key)) : visibleModules;
      const grouped = /* @__PURE__ */ new Map();
      for (const entry of flowModules) {
        const key = entry.flowId || entry.flowName;
        if (!grouped.has(key)) grouped.set(key, { flowId: entry.flowId, flowName: entry.flowName, entries: [] });
        grouped.get(key).entries.push(entry);
      }
      return [...grouped.values()].sort((a, b) => {
        const currentA = a.flowId === flowId ? 0 : 1;
        const currentB = b.flowId === flowId ? 0 : 1;
        return currentA - currentB || String(a.flowName).localeCompare(String(b.flowName));
      }).map((group) => ({ ...group, entries: [...group.entries].sort((a, b) => String(a.name).localeCompare(String(b.name))) }));
    }, [flowId, recentEntries, recentKeys, visibleModules]);
    useEffect(() => {
      if (!modulePanel) return;
      if (modulePreviewKey && visibleModules.some((entry) => entry.key === modulePreviewKey)) return;
      setModulePreviewKey(visibleModules[0] ? visibleModules[0].key : "");
    }, [modulePanel, modulePreviewKey, visibleModules]);
    const visible = useMemo(() => doc ? scopeNodes(doc, focusId) : [], [doc, focusId]);
    const visibleIds = useMemo(() => new Set(visible.map((node) => node.id)), [visible]);
    const visibleEdges = useMemo(
      () => doc ? doc.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) : [],
      [doc, visibleIds]
    );
    const childCounts = useMemo(() => {
      const counts = /* @__PURE__ */ new Map();
      if (doc) {
        for (const node of doc.nodes) if (node.parentId) counts.set(node.parentId, (counts.get(node.parentId) || 0) + 1);
      }
      return counts;
    }, [doc]);
    if (!doc) {
      return h("div", { className: "aimrule-root" }, h("style", null, CSS), h("div", { className: "aimrule-loading" }, "\u6B63\u5728\u52A0\u8F7D AimRule \u753B\u5E03\u2026"));
    }
    const current = doc;
    const positions = new Map(visible.map((node) => [node.id, posOf(node)]));
    const nodeMap = new Map(current.nodes.map((node) => [node.id, node]));
    const selectedNodes = current.nodes.filter((node) => selection.includes(node.id));
    const single = selectedNodes.length === 1 ? selectedNodes[0] : null;
    const selectedEdgeObj = selectedEdge ? current.edges.find((edge) => edge.id === selectedEdge) || null : null;
    const path = focusId ? pathOf(current, focusId) : [];
    const renderWorkspaceNode = (node, depth) => {
      const selected = refPaths.some((item) => item.path === node.path);
      if (node.type === "dir") {
        const open = Boolean(workspaceFilter.trim()) || Boolean(workspaceExpanded[node.path]);
        return h(
          "div",
          { key: node.path, className: "aimrule-tree-group" },
          h(
            "div",
            { className: "aimrule-tree-row", style: { paddingLeft: `${6 + depth * 14}px` } },
            h(
              "button",
              {
                className: "aimrule-tree-toggle",
                title: open ? "\u6536\u8D77" : "\u5C55\u5F00",
                onClick: () => setWorkspaceExpanded((current2) => ({ ...current2, [node.path]: !current2[node.path] }))
              },
              open ? "\u25BE" : "\u25B8"
            ),
            h("input", {
              type: "checkbox",
              checked: selected,
              onChange: () => togglePathRef({ path: node.path, type: "dir" })
            }),
            h("span", { className: "aimrule-menu-glyph" }, "\u25A6"),
            h("span", { className: "aimrule-picker-label" }, node.name),
            h("span", { className: "aimrule-picker-meta" }, `${countTreeFiles(node)} \u6587\u4EF6`)
          ),
          open ? h(
            "div",
            { className: "aimrule-tree-children" },
            ...node.children.map((child) => renderWorkspaceNode(child, depth + 1))
          ) : null
        );
      }
      return h(
        "label",
        {
          key: node.path,
          className: "aimrule-picker-row aimrule-tree-row",
          style: { paddingLeft: `${6 + depth * 14 + 22}px` }
        },
        h("input", {
          type: "checkbox",
          checked: selected,
          onChange: () => togglePathRef({ path: node.path, type: "file" })
        }),
        h("span", { className: "aimrule-menu-glyph" }, "\xA7"),
        h("span", { className: "aimrule-picker-label" }, node.name),
        node.size ? h("span", { className: "aimrule-picker-meta" }, formatBytes(node.size)) : null
      );
    };
    const modulePreview = visibleModules.find((entry) => entry.key === modulePreviewKey) || visibleModules[0] || null;
    const previewNodes = modulePreview ? (modulePreview.nodes || []).filter((node) => node.id !== modulePreview.moduleId) : [];
    const renderModulePick = (entry) => {
      const nodes = (entry.nodes || []).filter((node) => node.id !== entry.moduleId);
      const summary = nodes.slice(0, 3).map((node) => node.data && node.data.label || node.id).join(" \xB7 ") || "\u7A7A\u6A21\u5757";
      return h(
        "div",
        {
          key: entry.key,
          className: "aimrule-module-pick",
          "data-active": modulePreviewKey === entry.key,
          role: "button",
          tabIndex: 0,
          draggable: true,
          title: "\u70B9\u51FB\u63D2\u5165\u5230\u4E2D\u592E\uFF0C\u6216\u62D6\u5230\u753B\u5E03\u843D\u70B9",
          onMouseEnter: () => setModulePreviewKey(entry.key),
          onFocus: () => setModulePreviewKey(entry.key),
          onDragStart: (event) => {
            moduleDragRef.current = true;
            if (event.dataTransfer) {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData("application/x-aimrule-module", entry.key);
              event.dataTransfer.setData("text/plain", entry.name);
            }
            setDraggingModule(entry);
          },
          onDragEnd: () => {
            setTimeout(() => {
              moduleDragRef.current = false;
            }, 0);
            setDraggingModule(null);
          },
          onKeyDown: (event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (!moduleDragRef.current) insertModuleFromPanel(entry);
          },
          onClick: () => {
            if (moduleDragRef.current) return;
            insertModuleFromPanel(entry);
          }
        },
        h("span", { className: "aimrule-module-grip" }, "\u22EE\u22EE"),
        h(
          "div",
          { className: "aimrule-module-info" },
          h("b", null, entry.name),
          h("span", null, `${entry.flowName} \xB7 ${entry.nodeCount} \u8282\u70B9`),
          h("span", { className: "aimrule-module-summary" }, summary)
        ),
        h("span", { className: "aimrule-module-add" }, "\uFF0B")
      );
    };
    const formatHistoryTime = (value) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return "\u2014";
      const now = /* @__PURE__ */ new Date();
      const pad = (number) => String(number).padStart(2, "0");
      const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      if (sameDay) return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
      return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };
    const historyFlows = [...flows].sort(
      (a, b) => new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime()
    );
    const composerReady = genForm.text.trim().length > 0 || refNodes.length > 0 || selectedMessages.length > 0 || refPaths.length > 0 || uploads.length > 0;
    const nodeRect = (id) => {
      const position = positions.get(id) || { x: 0, y: 0 };
      return { x: position.x, y: position.y };
    };
    const inspectorMeta = single ? TYPE_META[single.type] || TYPE_META.action : null;
    const edgeSourceNode = selectedEdgeObj ? nodeMap.get(selectedEdgeObj.source) : null;
    const edgeTargetNode = selectedEdgeObj ? nodeMap.get(selectedEdgeObj.target) : null;
    const edgeSourceLabel = edgeSourceNode ? edgeSourceNode.data && edgeSourceNode.data.label || edgeSourceNode.id : "";
    const edgeTargetLabel = edgeTargetNode ? edgeTargetNode.data && edgeTargetNode.data.label || edgeTargetNode.id : "";
    return h(
      "div",
      { className: "aimrule-root" },
      h("style", null, CSS),
      useSessions && !sessionId ? h(SessionWatcher, { useSessions, onResolve: setSessionId }) : null,
      h(
        "div",
        { className: "aimrule-top" },
        h(
          "div",
          { className: "aimrule-brand" },
          h("span", { className: "aimrule-logo" }, h(AimRuleIcon, { size: 18 })),
          h(
            "div",
            { className: "aimrule-title-wrap" },
            h("input", {
              className: "aimrule-title",
              value: current.project.name,
              spellCheck: false,
              "aria-label": "\u6D41\u7A0B\u56FE\u540D\u79F0",
              style: { width: `${Math.min(280, Math.max(120, (current.project.name || "").length * 15 + 24))}px` },
              onFocus: pushHistoryOnce,
              onChange: (event) => mutate((state) => ({ ...state, project: { ...state.project, name: event.target.value } }), { history: false })
            }),
            h(
              "button",
              {
                className: "aimrule-title-more",
                title: "\u5207\u6362\u3001\u65B0\u5EFA\u6216\u5220\u9664\u6D41\u7A0B\u56FE",
                "aria-label": "\u6D41\u7A0B\u56FE\u83DC\u5355",
                onClick: () => setFlowMenu((open) => !open),
                disabled: flowsLoading
              },
              "\u5207\u6362",
              h("span", { className: "aimrule-title-more-chevron" }, "\u25BE")
            ),
            h(
              "button",
              {
                className: "aimrule-history-btn",
                title: "\u753B\u5E03\u5386\u53F2",
                "aria-label": "\u753B\u5E03\u5386\u53F2",
                onClick: openHistory,
                disabled: flowsLoading
              },
              h(
                "svg",
                {
                  width: 14,
                  height: 14,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.8,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": true
                },
                h("circle", { cx: 12, cy: 12, r: 8 }),
                h("path", { d: "M12 7v5l3 2" })
              )
            ),
            flowMenu ? h(
              "div",
              { className: "aimrule-flow-menu" },
              ...flows.length > 0 ? flows.map(
                (item) => h(
                  "button",
                  {
                    key: item.id,
                    className: "aimrule-flow-option",
                    "data-active": item.id === flowId,
                    onClick: () => {
                      setFlowMenu(false);
                      setFlowId(item.id);
                    }
                  },
                  h("span", { className: "aimrule-flow-option-name" }, item.name || "\u672A\u547D\u540D\u6D41\u7A0B\u56FE"),
                  h("span", { className: "aimrule-flow-option-meta" }, `${item.nodes} \u8282\u70B9`)
                )
              ) : [h("div", { key: "none", className: "aimrule-flow-option", style: { cursor: "default", color: "var(--aim-muted)" } }, "\u6682\u65E0\u6D41\u7A0B\u56FE")],
              h("div", { className: "aimrule-flow-menu-sep" }),
              h(
                "button",
                {
                  className: "aimrule-btn aimrule-new-flow-menu",
                  "data-kind": "primary",
                  onClick: () => {
                    setFlowMenu(false);
                    createFlow();
                  },
                  disabled: busy === "flow"
                },
                "\uFF0B \u65B0\u5EFA\u6D41\u7A0B\u56FE"
              ),
              h(
                "button",
                {
                  className: "aimrule-flow-option",
                  "data-danger": true,
                  onClick: () => {
                    setFlowMenu(false);
                    deleteFlow();
                  },
                  disabled: flows.length <= 1 || busy === "flow"
                },
                "\u5220\u9664\u5F53\u524D\u6D41\u7A0B\u56FE"
              )
            ) : null,
            flowMenu ? h("div", { className: "aimrule-flow-mask", onClick: () => setFlowMenu(false) }) : null
          ),
          h(
            "span",
            { className: "aimrule-sync", "data-state": syncState, title: stateDir || "\u672A\u8FDE\u63A5 Host" },
            h("span", { className: "aimrule-sync-label" }, syncState === "synced" ? "\u5DF2\u540C\u6B65" : syncState === "local" ? "\u4EC5\u672C\u5730" : "\u52A0\u8F7D\u4E2D\u2026")
          )
        ),
        projectHooks ? h(ProjectPicker, {
          useWorkspaces: props.useWorkspaces,
          useSessions: props.useSessions,
          value: project,
          onChange: chooseProject
        }) : null,
        h(
          "div",
          { className: "aimrule-actions" },
          h(
            "div",
            { className: "aimrule-top-tools" },
            h(
              "button",
              {
                className: "aimrule-btn aimrule-tool-add",
                title: "\u6DFB\u52A0\u8282\u70B9",
                "aria-label": "\u6DFB\u52A0\u8282\u70B9",
                onClick: () => setAddMenu((open) => !open)
              },
              "\uFF0B"
            ),
            addMenu ? h(
              "div",
              { className: "aimrule-add-menu" },
              h("div", { className: "aimrule-add-menu-title" }, "\u6DFB\u52A0\u8282\u70B9"),
              ...["judge", "calc", "action", "module"].map(
                (type) => h(
                  "button",
                  {
                    key: type,
                    className: "aimrule-add-item",
                    onClick: () => {
                      addNode(type);
                      setAddMenu(false);
                    }
                  },
                  h("span", { className: "aimrule-dot", style: { background: TYPE_META[type].color } }),
                  h(
                    "div",
                    { className: "aimrule-add-item-text" },
                    h("b", null, TYPE_META[type].label),
                    h("span", null, TYPE_META[type].hint)
                  )
                )
              )
            ) : null,
            addMenu ? h("div", { className: "aimrule-flow-mask", onClick: () => setAddMenu(false) }) : null,
            h(
              "button",
              {
                className: "aimrule-btn aimrule-tool-pan",
                "data-active": canvasTool === "hand",
                title: canvasTool === "hand" ? "\u62D6\u62FD\u6A21\u5F0F\uFF1A\u6309\u4F4F\u7A7A\u767D\u5904\u62D6\u52A8\u753B\u5E03\uFF08\u70B9\u51FB\u5207\u56DE\u6846\u9009\uFF09" : "\u6846\u9009\u6A21\u5F0F\uFF1A\u62D6\u62FD\u7A7A\u767D\u5904\u591A\u9009\uFF1B\u70B9\u51FB\u5207\u6362\u4E3A\u62D6\u62FD\u753B\u5E03",
                "aria-label": "\u62D6\u62FD\u753B\u5E03",
                onClick: () => setCanvasTool((current2) => current2 === "hand" ? "select" : "hand")
              },
              h(
                "svg",
                {
                  width: 16,
                  height: 16,
                  viewBox: "0 0 24 24",
                  fill: "none",
                  stroke: "currentColor",
                  strokeWidth: 1.6,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                  "aria-hidden": true
                },
                h("path", {
                  d: "M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5.5a1.5 1.5 0 0 1 3 0V11m0-1V6.5a1.5 1.5 0 0 1 3 0V11m0-1V9a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.6-2.1l-3.1-3.7a1.7 1.7 0 0 1 2.5-2.3L9 15m-1-6V9.5a1.5 1.5 0 0 1 3 0V12"
                })
              )
            ),
            h("span", { className: "aimrule-bar-sep aimrule-tool-secondary-sep" }),
            h(
              "button",
              { className: "aimrule-btn aimrule-tool-secondary", onClick: undo, disabled: pastRef.current.length === 0, title: "\u64A4\u9500 (\u2318Z)", "aria-label": "\u64A4\u9500" },
              "\u21B6"
            ),
            h(
              "button",
              { className: "aimrule-btn aimrule-tool-secondary", onClick: redo, disabled: futureRef.current.length === 0, title: "\u91CD\u505A (\u21E7\u2318Z)", "aria-label": "\u91CD\u505A" },
              "\u21B7"
            ),
            h("span", { className: "aimrule-bar-sep aimrule-tool-secondary-sep" }),
            h(
              "button",
              {
                className: "aimrule-btn aimrule-tool-secondary",
                title: "\u81EA\u52A8\u5E03\u5C40",
                "aria-label": "\u81EA\u52A8\u5E03\u5C40",
                onClick: () => {
                  pushHistoryOnce();
                  applyDoc(layoutState(docRef.current), { history: false });
                  setTimeout(fitView, 30);
                }
              },
              "\u25A6"
            ),
            h("span", { className: "aimrule-bar-sep aimrule-tool-secondary-sep" }),
            h("button", { className: "aimrule-btn aimrule-tool-secondary", onClick: () => zoomBy(1 / 1.2), title: "\u7F29\u5C0F" }, "\u2212"),
            h("button", { className: "aimrule-btn aimrule-tool-secondary", onClick: fitView, title: "\u9002\u5E94\u753B\u5E03" }, "\u2922"),
            h("button", { className: "aimrule-btn aimrule-tool-secondary", onClick: () => zoomBy(1.2), title: "\u653E\u5927" }, "+"),
            h("span", { className: "aimrule-bar-sep" }),
            h(
              "div",
              { className: "aimrule-module-wrap", ref: moduleWrapRef },
              h(
                "button",
                {
                  className: "aimrule-btn aimrule-tool-modules",
                  "data-active": modulePanel,
                  title: "\u63D2\u5165\u6A21\u5757",
                  onClick: () => {
                    if (modulePanel) {
                      setModulePanel(false);
                    } else {
                      setModuleFilter("");
                      setModulePanel(true);
                      loadModules(false);
                    }
                  }
                },
                h("span", null, "\u25A6"),
                h("span", { className: "aimrule-tool-modules-label" }, "\u6A21\u5757")
              ),
              modulePanel ? h(
                "div",
                { className: "aimrule-module-popover" },
                h(
                  "div",
                  { className: "aimrule-module-popover-head" },
                  h("b", null, "\u63D2\u5165\u6A21\u5757"),
                  h("span", { className: "aimrule-module-popover-hint" }, "\u60AC\u505C\u770B\u5185\u5BB9\uFF1B\u70B9\u51FB\u653E\u5230\u4E2D\u592E\uFF0C\u6216\u62D6\u5230\u843D\u70B9"),
                  h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModulePanel(false) }, "\u2715")
                ),
                h(
                  "div",
                  { style: { padding: "8px 10px 4px" } },
                  h("input", {
                    className: "aimrule-input",
                    value: moduleFilter,
                    placeholder: "\u641C\u7D22\u6A21\u5757\u3001\u52A8\u4F5C\u3001\u6761\u4EF6\u2026",
                    onChange: (event) => setModuleFilter(event.target.value)
                  })
                ),
                h(
                  "div",
                  { className: "aimrule-module-popover-body" },
                  h(
                    "div",
                    { className: "aimrule-module-list" },
                    modulesLoading ? h("p", { className: "aimrule-hint" }, "\u6B63\u5728\u626B\u63CF\u6D41\u7A0B\u56FE\u2026") : modules.length === 0 ? h("p", { className: "aimrule-hint" }, "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u6A21\u5757\u3002\u5148\u5728\u753B\u5E03\u4E0A\u6846\u9009\u8282\u70B9\uFF0C\u53F3\u952E\u300C\u5408\u5E76\u6A21\u5757\u300D\uFF1B\u6216\u7528\u5B8C\u6574\u6A21\u5757\u5E93\u91CC\u7684\u300CAI \u68C0\u6D4B\u590D\u7528\u300D\u3002") : visibleModules.length === 0 ? h("p", { className: "aimrule-hint" }, "\u6CA1\u6709\u5339\u914D\u7684\u6A21\u5757\u3002\u53EF\u4EE5\u641C\u6A21\u5757\u540D\u3001\u6765\u6E90\u6D41\u7A0B\u56FE\uFF0C\u6216\u6A21\u5757\u5185\u90E8\u7684\u8282\u70B9\u540D\u3001\u6761\u4EF6\u3001\u52A8\u4F5C\u3002") : [
                      recentEntries.length > 0 ? h(
                        "div",
                        { key: "recent" },
                        h(
                          "div",
                          { className: "aimrule-module-group" },
                          h("span", null, "\u6700\u8FD1\u4F7F\u7528"),
                          h("span", { className: "aimrule-module-group-meta" }, String(recentEntries.length))
                        ),
                        ...recentEntries.map(renderModulePick)
                      ) : null,
                      ...moduleGroups.map(
                        (group) => h(
                          "div",
                          { key: `group:${group.flowId || group.flowName}` },
                          h(
                            "div",
                            { className: "aimrule-module-group" },
                            h("span", null, group.flowName),
                            group.flowId === flowId ? h("span", { className: "aimrule-module-current" }, "\u5F53\u524D") : null
                          ),
                          ...group.entries.map(renderModulePick)
                        )
                      )
                    ]
                  ),
                  modulePreview ? h(
                    "div",
                    { className: "aimrule-module-detail" },
                    h(
                      "div",
                      { className: "aimrule-module-detail-head" },
                      h("b", null, modulePreview.name),
                      h("span", null, `${modulePreview.flowName} \xB7 ${modulePreview.nodeCount} \u8282\u70B9`)
                    ),
                    h(
                      "div",
                      { className: "aimrule-module-detail-list" },
                      previewNodes.length === 0 ? h("p", { className: "aimrule-hint" }, "\u8FD9\u4E2A\u6A21\u5757\u6CA1\u6709\u5185\u90E8\u8282\u70B9\u3002") : previewNodes.slice(0, 8).map((node) => {
                        const meta = TYPE_META[node.type] || TYPE_META.action;
                        const data = node.data || {};
                        const detail = data.condition ? `IF ${data.condition}` : data.expr || data.action || "";
                        return h(
                          "div",
                          { key: node.id, className: "aimrule-module-detail-node" },
                          h("span", { className: "aimrule-module-detail-glyph", style: { color: meta.color } }, meta.glyph),
                          h(
                            "span",
                            { className: "aimrule-module-detail-text" },
                            h("b", null, data.label || node.id),
                            detail ? h("span", null, detail) : null
                          )
                        );
                      })
                    ),
                    h("p", { className: "aimrule-module-detail-hint" }, "\u70B9\u51FB\u5DE6\u4FA7\u63D2\u5165\u5230\u753B\u5E03\u4E2D\u592E\uFF0C\u6216\u62D6\u62FD\u5230\u843D\u70B9\u3002")
                  ) : null
                ),
                h(
                  "div",
                  { className: "aimrule-module-popover-foot" },
                  h(
                    "button",
                    {
                      className: "aimrule-btn",
                      "data-kind": "ghost",
                      onClick: () => {
                        setModulePanel(false);
                        loadModules(true);
                      }
                    },
                    "\u5B8C\u6574\u6A21\u5757\u5E93"
                  ),
                  h("span", { className: "aimrule-composer-hint", style: { marginLeft: "auto" } }, `${modules.length} \u4E2A\u6A21\u5757`)
                )
              ) : null
            ),
            h(
              "div",
              { className: "aimrule-tool-more-wrap" },
              h(
                "button",
                {
                  className: "aimrule-btn aimrule-tool-more",
                  "data-active": toolsMenu,
                  title: "\u66F4\u591A\u753B\u5E03\u5DE5\u5177",
                  onClick: () => setToolsMenu((open) => !open)
                },
                "\u2699"
              ),
              toolsMenu ? h(
                "div",
                { className: "aimrule-tools-menu" },
                h("div", { className: "aimrule-tools-menu-title" }, "\u753B\u5E03\u5DE5\u5177"),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    disabled: pastRef.current.length === 0,
                    onClick: () => {
                      setToolsMenu(false);
                      undo();
                    }
                  },
                  "\u64A4\u9500",
                  h("span", { className: "aimrule-flow-option-meta" }, "\u2318Z")
                ),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    disabled: futureRef.current.length === 0,
                    onClick: () => {
                      setToolsMenu(false);
                      redo();
                    }
                  },
                  "\u91CD\u505A",
                  h("span", { className: "aimrule-flow-option-meta" }, "\u21E7\u2318Z")
                ),
                h("div", { className: "aimrule-flow-menu-sep" }),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    onClick: () => {
                      setToolsMenu(false);
                      pushHistoryOnce();
                      applyDoc(layoutState(docRef.current), { history: false });
                      setTimeout(fitView, 30);
                    }
                  },
                  "\u81EA\u52A8\u5E03\u5C40"
                ),
                h("div", { className: "aimrule-flow-menu-sep" }),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    onClick: () => {
                      setToolsMenu(false);
                      zoomBy(1 / 1.2);
                    }
                  },
                  "\u7F29\u5C0F"
                ),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    onClick: () => {
                      setToolsMenu(false);
                      fitView();
                    }
                  },
                  "\u9002\u5E94\u753B\u5E03"
                ),
                h(
                  "button",
                  {
                    className: "aimrule-flow-option",
                    onClick: () => {
                      setToolsMenu(false);
                      zoomBy(1.2);
                    }
                  },
                  "\u653E\u5927"
                )
              ) : null,
              toolsMenu ? h("div", { className: "aimrule-flow-mask", onClick: () => setToolsMenu(false) }) : null
            )
          ),
          h("button", { className: "aimrule-btn", onClick: openTests }, "\u6D4B\u8BD5"),
          h(
            "div",
            { className: "aimrule-more-wrap" },
            h(
              "button",
              {
                className: "aimrule-btn aimrule-more-trigger",
                title: "\u66F4\u591A\u64CD\u4F5C",
                "aria-label": "\u66F4\u591A\u64CD\u4F5C",
                onClick: () => setMoreMenu((open) => !open)
              },
              "\u22EF"
            ),
            moreMenu ? h(
              "div",
              { className: "aimrule-flow-menu aimrule-more-menu" },
              h(
                "button",
                { className: "aimrule-flow-option", onClick: () => {
                  setMoreMenu(false);
                  openModules();
                } },
                "\u6A21\u5757\u5E93"
              ),
              h(
                "button",
                { className: "aimrule-flow-option", onClick: () => {
                  setMoreMenu(false);
                  setModal("export");
                } },
                "\u5BFC\u51FA"
              ),
              h(
                "button",
                { className: "aimrule-flow-option", onClick: () => {
                  setMoreMenu(false);
                  setModal("overview");
                } },
                "\u6982\u89C8\u4E0E\u5E2E\u52A9"
              )
            ) : null,
            moreMenu ? h("div", { className: "aimrule-flow-mask", onClick: () => setMoreMenu(false) }) : null
          )
        )
      ),
      notes.length > 0 ? h(
        "div",
        { className: "aimrule-notes" },
        h("b", null, "\u5F85\u4E1A\u52A1\u786E\u8BA4"),
        ...notes.slice(0, 3).map((note, index) => h("span", { key: index, className: "aimrule-note" }, note)),
        notes.length > 3 ? h("span", { className: "aimrule-note" }, `\u2026 \u53E6\u6709 ${notes.length - 3} \u6761`) : null,
        h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setNotes([]) }, "\u77E5\u9053\u4E86")
      ) : null,
      h(
        "div",
        { className: "aimrule-body" },
        h(
          "div",
          {
            className: "aimrule-stage",
            ref: stageRef,
            "data-panning": panning,
            "data-marquee": Boolean(marquee),
            "data-tool": canvasTool,
            onMouseDown: onStageMouseDown,
            onDoubleClick: onStageDoubleClick,
            onContextMenu: onStageContextMenu,
            onDragOver: onStageDragOver,
            onDrop: onStageDrop
          },
          focusId ? h(
            "div",
            { className: "aimrule-canvas-crumbs" },
            h(
              "button",
              { className: "aimrule-crumb-home", onClick: () => drill(null), title: "\u8FD4\u56DE\u6839\u753B\u5E03" },
              "\u2190 \u6839\u753B\u5E03"
            ),
            ...path.map(
              (node, index) => h(
                "span",
                { key: node.id, className: "aimrule-crumb-wrap" },
                h("span", { className: "aimrule-crumb-sep" }, "\u203A"),
                h(
                  "button",
                  {
                    className: "aimrule-crumb",
                    "data-current": index === path.length - 1,
                    onClick: () => drill(node.id)
                  },
                  node.data && node.data.label ? node.data.label : node.id
                )
              )
            )
          ) : null,
          h(
            "div",
            { className: "aimrule-world", style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` } },
            h(
              "svg",
              { className: "aimrule-edges", width: 6e3, height: 4e3 },
              h(
                "defs",
                null,
                h(
                  "marker",
                  { id: "aimrule-arrow", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" },
                  h("path", { d: "M 0 0 L 10 5 L 0 10 z", style: { fill: "var(--aimrule-edge)" } })
                )
              ),
              ...visibleEdges.map((edge) => {
                const from = nodeRect(edge.source);
                const to = nodeRect(edge.target);
                const pathData = edgePath(from, to);
                const midX = (from.x + NODE_W + to.x) / 2;
                const midY = (from.y + to.y + NODE_H) / 2;
                return h(
                  "g",
                  { key: edge.id, "data-edge-id": edge.id },
                  h("path", { className: "aimrule-edge", "data-selected": selectedEdge === edge.id, d: pathData, markerEnd: "url(#aimrule-arrow)" }),
                  h("path", {
                    className: "aimrule-edge-hit",
                    d: pathData,
                    onMouseDown: (event) => {
                      event.stopPropagation();
                      setSelectedEdge(edge.id);
                      setSelection([]);
                      selectionRef.current = [];
                    }
                  }),
                  edge.label ? h("text", { className: "aimrule-edge-label", x: midX, y: midY - 4, textAnchor: "middle" }, edge.label) : null
                );
              }),
              pendingEdge ? h("path", {
                className: "aimrule-edge",
                style: { strokeDasharray: "5 4", stroke: "var(--dsw-alias-brand-primary)" },
                d: edgePath({ x: pendingEdge.start.x - NODE_W, y: pendingEdge.start.y - NODE_H / 2 }, { x: pendingEdge.cursor.x, y: pendingEdge.cursor.y - NODE_H / 2 })
              }) : null
            ),
            ...visible.map(
              (node) => h(NodeCard, {
                key: node.id,
                node,
                selected: selection.includes(node.id),
                connectTarget: connectTarget === node.id,
                childCount: childCounts.get(node.id) || 0,
                onMouseDown: (event) => beginNodeDrag(event, node),
                onDoubleClick: (event) => {
                  if (node.type === "module") {
                    event.stopPropagation();
                    drill(node.id);
                  }
                },
                onConnectStart: beginConnect,
                onConnectEnd: finishConnect
              })
            )
          ),
          visible.length === 0 ? h(
            "div",
            { className: "aimrule-hero" },
            h("span", { className: "aimrule-eyebrow" }, focusId ? "\u7A7A\u6A21\u5757" : "\u5F00\u59CB"),
            h("h2", null, focusId ? "\u8FD9\u4E2A\u6A21\u5757\u8FD8\u662F\u7A7A\u7684" : "\u628A\u6761\u6587\uFF0C\u53D8\u6210\u53EF\u6267\u884C\u7684\u89C4\u5219"),
            h(
              "p",
              null,
              focusId ? "\u4ECE\u753B\u5E03\u5DE5\u5177\u6761\u300C\uFF0B\u300D\u6DFB\u52A0\u8282\u70B9\uFF0C\u6216\u56DE\u5230\u6839\u753B\u5E03\u628A\u5DF2\u6709\u8282\u70B9\u5C01\u88C5\u8FDB\u6765\u3002" : "\u5728\u4E0B\u65B9\u63CF\u8FF0\u76EE\u6807\uFF0C\u7528 \uFF0B \u5F15\u7528\u8282\u70B9\u3001\u5BF9\u8BDD\u8BB0\u5F55\u6216\u5DE5\u4F5C\u533A\u6587\u4EF6\uFF1B\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7C98\u8D34\u539F\u6587\u3002\u7A7A\u767D\u5904\u62D6\u62FD\u6846\u9009\uFF1B\u70B9\u624B\u5F62\u5DE5\u5177\u6216\u6309\u4F4F\u7A7A\u683C\u62D6\u62FD\u753B\u5E03\u3002"
            ),
            focusId ? null : h(
              "button",
              {
                className: "aimrule-hero-link",
                onClick: () => {
                  applyDoc(demoDoc());
                  setTimeout(fitView, 40);
                }
              },
              "\u8F7D\u5165\u793A\u4F8B"
            )
          ) : null,
          marquee ? h("div", { className: "aimrule-marquee", style: { left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h } }) : null,
          composerMenu || composerPicker ? h("div", {
            className: "aimrule-composer-mask",
            onClick: () => {
              setComposerMenu(false);
              setComposerPicker(null);
            }
          }) : null,
          modal === null ? h(
            "div",
            { className: "aimrule-composer" },
            refNodes.length > 0 || refPaths.length > 0 || selectedMessages.length > 0 || uploads.length > 0 ? h(
              "div",
              { className: "aimrule-composer-chips" },
              ...refNodes.map((id) => {
                const node = nodeMap.get(id);
                if (!node) return null;
                const meta = TYPE_META[node.type] || TYPE_META.action;
                return h(
                  "span",
                  { key: `node:${id}`, className: "aimrule-composer-chip" },
                  h("span", { className: "aimrule-dot", style: { background: meta.color } }),
                  `@${node.data && node.data.label || id}`,
                  h("button", { title: "\u79FB\u9664", onClick: () => toggleNodeRef(id) }, "\u2715")
                );
              }),
              ...refPaths.map(
                (item) => h(
                  "span",
                  { key: `path:${item.path}`, className: "aimrule-composer-chip" },
                  item.type === "dir" ? "\u25A6" : "\xA7",
                  item.path,
                  h("button", { title: "\u79FB\u9664", onClick: () => setRefPaths((current2) => current2.filter((entry) => entry.path !== item.path)) }, "\u2715")
                )
              ),
              selectedMessages.length > 0 ? h(
                "span",
                { className: "aimrule-composer-chip" },
                "\u25CC",
                `\u5BF9\u8BDD ${selectedMessages.length} \u6761`,
                h("button", { title: "\u79FB\u9664", onClick: () => setSelectedMessages([]) }, "\u2715")
              ) : null,
              ...uploads.map(
                (item) => h(
                  "span",
                  { key: item.key, className: "aimrule-composer-chip" },
                  "\u21A5",
                  item.path || item.name,
                  h("button", { title: "\u79FB\u9664", onClick: () => removeFile(item.key) }, "\u2715")
                )
              )
            ) : null,
            h(
              "div",
              { className: "aimrule-composer-box" },
              h(
                "button",
                {
                  className: "aimrule-composer-add",
                  title: "\u6DFB\u52A0\u5F15\u7528\u6216\u9644\u4EF6",
                  "aria-label": "\u6DFB\u52A0\u5F15\u7528\u6216\u9644\u4EF6",
                  onClick: () => setComposerMenu((open) => !open)
                },
                "\uFF0B"
              ),
              h("textarea", {
                ref: composerRef,
                className: "aimrule-composer-input",
                rows: 1,
                value: genForm.text,
                placeholder: "\u63CF\u8FF0\u89C4\u5219\uFF0C\u6216\u7528 \uFF0B \u5F15\u7528\u8282\u70B9\u3001\u5BF9\u8BDD\u8BB0\u5F55\u3001\u5DE5\u4F5C\u533A\u6587\u4EF6\u2026",
                onChange: (event) => setGenForm({ ...genForm, text: event.target.value }),
                onKeyDown: (event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault();
                    submitComposer();
                  }
                }
              }),
              h(
                "button",
                {
                  className: "aimrule-composer-send",
                  title: "\u751F\u6210",
                  "aria-label": "\u751F\u6210",
                  onClick: submitComposer,
                  disabled: busy === "generate" || !composerReady
                },
                busy === "generate" ? "\u2026" : "\u2191"
              )
            ),
            h(
              "div",
              { className: "aimrule-composer-foot" },
              h("span", { className: "aimrule-spacer" }),
              h(
                "span",
                { className: "aimrule-composer-hint" },
                busy === "generate" ? "\u6B63\u5728\u63D0\u70BC\u2026" : "Enter \u751F\u6210 \xB7 Shift+Enter \u6362\u884C"
              )
            ),
            h("input", {
              ref: filesInputRef,
              type: "file",
              multiple: true,
              style: { display: "none" },
              onChange: (event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }
            }),
            h("input", {
              ref: folderInputRef,
              type: "file",
              multiple: true,
              webkitdirectory: "",
              directory: "",
              style: { display: "none" },
              onChange: (event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }
            }),
            composerMenu ? h(
              "div",
              { className: "aimrule-composer-menu" },
              h(
                "button",
                { className: "aimrule-composer-menu-item", onClick: () => {
                  setComposerMenu(false);
                  if (filesInputRef.current) filesInputRef.current.click();
                } },
                h("span", { className: "aimrule-menu-glyph" }, "\u21A5"),
                "\u4E0A\u4F20\u9644\u4EF6"
              ),
              h(
                "button",
                { className: "aimrule-composer-menu-item", onClick: () => {
                  setComposerMenu(false);
                  if (folderInputRef.current) folderInputRef.current.click();
                } },
                h("span", { className: "aimrule-menu-glyph" }, "\u21A5"),
                "\u4E0A\u4F20\u6587\u4EF6\u5939"
              ),
              h("div", { className: "aimrule-flow-menu-sep" }),
              h(
                "button",
                { className: "aimrule-composer-menu-item", onClick: () => openComposerPicker("workspace") },
                h("span", { className: "aimrule-menu-glyph" }, "\u2302"),
                "\u5DE5\u4F5C\u533A\u6587\u4EF6"
              ),
              h(
                "button",
                { className: "aimrule-composer-menu-item", onClick: () => openComposerPicker("chat") },
                h("span", { className: "aimrule-menu-glyph" }, "\u25CC"),
                "\u5BF9\u8BDD\u8BB0\u5F55"
              ),
              h(
                "button",
                { className: "aimrule-composer-menu-item", onClick: () => openComposerPicker("nodes") },
                h("span", { className: "aimrule-menu-glyph" }, "\u2B21"),
                "\u6D41\u7A0B\u56FE\u8282\u70B9"
              )
            ) : null,
            composerPicker ? h(
              "div",
              { className: "aimrule-composer-picker" },
              h(
                "div",
                { className: "aimrule-picker-head" },
                h(
                  "b",
                  null,
                  composerPicker === "nodes" ? "\u5F15\u7528\u6D41\u7A0B\u56FE\u8282\u70B9" : composerPicker === "chat" ? "\u5F15\u7528\u5BF9\u8BDD\u8BB0\u5F55" : "\u5F15\u7528\u5DE5\u4F5C\u533A\u6587\u4EF6/\u6587\u4EF6\u5939"
                ),
                h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setComposerPicker(null) }, "\u2715")
              ),
              composerPicker === "nodes" ? h(
                "div",
                { className: "aimrule-picker-body" },
                h("input", {
                  className: "aimrule-input",
                  value: nodeFilter,
                  placeholder: "\u641C\u7D22\u8282\u70B9\u6216\u6A21\u5757\u2026",
                  onChange: (event) => setNodeFilter(event.target.value)
                }),
                h(
                  "div",
                  { className: "aimrule-picker-list" },
                  ...current.nodes.filter((node) => {
                    const query = nodeFilter.trim().toLowerCase();
                    if (!query) return true;
                    return `${node.data && node.data.label || ""} ${node.id} ${node.type}`.toLowerCase().includes(query);
                  }).map((node) => {
                    const meta = TYPE_META[node.type] || TYPE_META.action;
                    return h(
                      "label",
                      { key: node.id, className: "aimrule-picker-row" },
                      h("input", {
                        type: "checkbox",
                        checked: refNodes.includes(node.id),
                        onChange: () => toggleNodeRef(node.id)
                      }),
                      h("span", { className: "aimrule-dot", style: { background: meta.color } }),
                      h("span", { className: "aimrule-picker-label" }, node.data && node.data.label || node.id),
                      h("span", { className: "aimrule-picker-meta" }, meta.label)
                    );
                  })
                )
              ) : composerPicker === "chat" ? h(
                "div",
                { className: "aimrule-picker-body" },
                transcriptLoading ? h("p", { className: "aimrule-hint" }, "\u6B63\u5728\u8BFB\u53D6\u5F53\u524D\u4F1A\u8BDD\u2026") : !sessionId ? h("p", { className: "aimrule-hint" }, "\u5F53\u524D\u6CA1\u6709\u6253\u5F00\u7684\u4F1A\u8BDD\u3002") : transcriptItems.length === 0 ? h("p", { className: "aimrule-hint" }, "\u5F53\u524D\u4F1A\u8BDD\u8FD8\u6CA1\u6709\u53EF\u7528\u7684\u5BF9\u8BDD\u8BB0\u5F55\u3002") : h(
                  "div",
                  { className: "aimrule-picker-list" },
                  ...transcriptItems.map(
                    (item, index) => h(
                      "label",
                      { key: `${item.seq || index}-${index}`, className: "aimrule-picker-row aimrule-picker-row-chat" },
                      h("input", {
                        type: "checkbox",
                        checked: selectedMessages.includes(index),
                        onChange: () => toggleMessage(index)
                      }),
                      h(
                        "span",
                        { className: "aimrule-role", "data-role": item.role === "\u52A9\u624B" ? "assistant" : "user" },
                        item.role
                      ),
                      h("span", { className: "aimrule-convo-text", title: item.text }, item.text)
                    )
                  )
                )
              ) : h(
                "div",
                { className: "aimrule-picker-body" },
                h("input", {
                  className: "aimrule-input",
                  value: workspaceFilter,
                  placeholder: "\u641C\u7D22\u5DE5\u4F5C\u533A\u6587\u4EF6\u6216\u6587\u4EF6\u5939\u2026",
                  onChange: (event) => setWorkspaceFilter(event.target.value)
                }),
                workspaceLoading ? h("p", { className: "aimrule-hint" }, "\u6B63\u5728\u8BFB\u53D6\u5DE5\u4F5C\u533A\u2026") : h(
                  "div",
                  { className: "aimrule-picker-list aimrule-file-tree" },
                  ...workspaceTree.map((node) => renderWorkspaceNode(node, 0))
                ),
                !workspaceLoading && workspaceTree.length === 0 ? h("p", { className: "aimrule-hint" }, "\u5DE5\u4F5C\u533A\u91CC\u6CA1\u6709\u53EF\u5F15\u7528\u7684\u6587\u4EF6\u3002") : null
              ),
              h(
                "div",
                { className: "aimrule-picker-foot" },
                h(
                  "span",
                  { className: "aimrule-composer-hint" },
                  composerPicker === "chat" ? `\u5DF2\u9009 ${selectedMessages.length} \u6761` : composerPicker === "nodes" ? `\u5DF2\u9009 ${refNodes.length} \u4E2A\u8282\u70B9` : `\u5DF2\u9009 ${refPaths.length} \u9879`
                ),
                h("span", { className: "aimrule-spacer" }),
                composerPicker === "chat" ? h(
                  "button",
                  { className: "aimrule-btn", "data-kind": "ghost", onClick: selectAllMessages },
                  "\u5168\u9009"
                ) : null,
                composerPicker === "chat" ? h(
                  "button",
                  { className: "aimrule-btn", "data-kind": "ghost", onClick: clearMessages },
                  "\u6E05\u7A7A"
                ) : null,
                h("button", { className: "aimrule-btn", "data-kind": "primary", onClick: () => setComposerPicker(null) }, "\u5B8C\u6210")
              )
            ) : null
          ) : null,
          toast ? h("div", { className: "aimrule-toast", "data-tone": toast.tone }, toast.text) : null,
          canvasMenu || nodeMenu ? h("div", {
            className: "aimrule-flow-mask",
            onClick: () => {
              setCanvasMenu(null);
              setNodeMenu(null);
            }
          }) : null,
          canvasMenu ? h(
            "div",
            {
              className: "aimrule-canvas-menu",
              style: { left: canvasMenu.x, top: canvasMenu.y },
              onMouseDown: (event) => event.stopPropagation(),
              onContextMenu: (event) => event.preventDefault()
            },
            h("div", { className: "aimrule-canvas-menu-title" }, "\u65B0\u5EFA\u8282\u70B9"),
            ...["start", "judge", "calc", "action", "end", "module"].map(
              (type) => h(
                "button",
                {
                  key: type,
                  className: "aimrule-add-item",
                  onClick: () => {
                    addNode(type, canvasMenu.world);
                    setCanvasMenu(null);
                  }
                },
                h("span", { className: "aimrule-dot", style: { background: TYPE_META[type].color } }),
                h("span", null, TYPE_META[type].label)
              )
            ),
            h("div", { className: "aimrule-flow-menu-sep" }),
            h(
              "button",
              {
                className: "aimrule-add-item",
                disabled: selection.length === 0,
                onClick: () => {
                  copySelection();
                  setCanvasMenu(null);
                }
              },
              h("span", { className: "aimrule-menu-glyph" }, "\u29C9"),
              "\u590D\u5236",
              selection.length > 0 ? h("span", { className: "aimrule-canvas-menu-meta" }, `${selection.length} \u4E2A`) : null
            ),
            h(
              "button",
              {
                className: "aimrule-add-item",
                disabled: !nodeClipboardRef.current,
                onClick: () => {
                  pasteNodes(canvasMenu.world);
                  setCanvasMenu(null);
                }
              },
              h("span", { className: "aimrule-menu-glyph" }, "\u25A3"),
              "\u7C98\u8D34"
            )
          ) : null,
          nodeMenu ? h(
            "div",
            {
              className: "aimrule-canvas-menu aimrule-node-menu",
              style: { left: nodeMenu.x, top: nodeMenu.y },
              onMouseDown: (event) => event.stopPropagation(),
              onContextMenu: (event) => event.preventDefault()
            },
            h(
              "div",
              { className: "aimrule-canvas-menu-title" },
              nodeMenu.ids.length > 1 ? `${nodeMenu.ids.length} \u4E2A\u8282\u70B9` : "\u8282\u70B9\u64CD\u4F5C"
            ),
            h(
              "button",
              {
                className: "aimrule-add-item",
                onClick: () => {
                  copySelection(nodeMenu.ids);
                  setNodeMenu(null);
                }
              },
              h("span", { className: "aimrule-menu-glyph" }, "\u29C9"),
              "\u590D\u5236"
            ),
            h(
              "button",
              {
                className: "aimrule-add-item",
                onClick: () => addNodesToComposer(nodeMenu.ids)
              },
              h("span", { className: "aimrule-menu-glyph" }, "\uFF0B"),
              "\u6DFB\u52A0\u5230\u5BF9\u8BDD\u6846"
            ),
            h(
              "button",
              {
                className: "aimrule-add-item",
                disabled: nodeMenu.ids.length < 2,
                title: nodeMenu.ids.length < 2 ? "\u6846\u9009\u591A\u4E2A\u8282\u70B9\u540E\u5408\u5E76" : "\u628A\u9009\u4E2D\u8282\u70B9\u5408\u5E76\u6210\u4E00\u4E2A\u6A21\u5757",
                onClick: () => {
                  encapsulate(nodeMenu.ids);
                  setNodeMenu(null);
                }
              },
              h("span", { className: "aimrule-menu-glyph" }, "\u25A3"),
              "\u5408\u5E76\u6A21\u5757"
            ),
            h("div", { className: "aimrule-flow-menu-sep" }),
            h(
              "button",
              {
                className: "aimrule-add-item",
                "data-danger": true,
                onClick: () => {
                  deleteSelection(nodeMenu.ids);
                  setNodeMenu(null);
                }
              },
              h("span", { className: "aimrule-menu-glyph" }, "\u232B"),
              "\u5220\u9664\u8282\u70B9"
            )
          ) : null
        ),
        single || selectedEdgeObj || selection.length > 1 ? h(
          "aside",
          { className: "aimrule-inspector" },
          h(
            "div",
            { className: "aimrule-inspector-head" },
            single && inspectorMeta ? h(
              "span",
              {
                className: "aimrule-inspector-glyph",
                style: {
                  color: inspectorMeta.color,
                  background: `color-mix(in srgb, ${inspectorMeta.color} 12%, transparent)`
                }
              },
              inspectorMeta.glyph
            ) : null,
            h(
              "div",
              { className: "aimrule-inspector-title" },
              h("h3", null, single ? single.data.label || "\u672A\u547D\u540D\u8282\u70B9" : selectedEdgeObj ? "\u8FDE\u7EBF\u5C5E\u6027" : `${selection.length} \u4E2A\u8282\u70B9`),
              single && inspectorMeta ? h("span", { className: "aimrule-inspector-sub" }, `${inspectorMeta.label} \xB7 ${single.id}`) : selectedEdgeObj ? h("span", { className: "aimrule-inspector-sub" }, `${edgeSourceLabel} \u2192 ${edgeTargetLabel}`) : null
            ),
            h(
              "button",
              {
                className: "aimrule-btn",
                "data-kind": "ghost",
                title: "\u5173\u95ED\u5C5E\u6027\u9762\u677F",
                onClick: () => {
                  setSelection([]);
                  setSelectedEdge(null);
                }
              },
              "\u2715"
            )
          ),
          h(
            "div",
            { className: "aimrule-inspector-body" },
            single ? [
              h(
                "div",
                { key: "basic", className: "aimrule-panel-section" },
                h("h3", null, "\u57FA\u672C\u4FE1\u606F"),
                h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u7C7B\u578B"),
                  h(
                    "select",
                    {
                      className: "aimrule-select",
                      value: single.type,
                      onChange: (event) => mutate((state) => ({
                        ...state,
                        nodes: state.nodes.map((node) => node.id === single.id ? { ...node, type: event.target.value } : node)
                      }))
                    },
                    ...TYPE_ORDER.map((type) => h("option", { key: type, value: type }, TYPE_META[type].label))
                  )
                ),
                h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u540D\u79F0"),
                  h("input", {
                    className: "aimrule-input",
                    value: single.data.label || "",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { label: event.target.value })
                  })
                )
              ),
              h(
                "div",
                { key: "rule", className: "aimrule-panel-section" },
                h("h3", null, "\u89C4\u5219"),
                single.type === "judge" ? h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u5224\u65AD\u6761\u4EF6"),
                  h("textarea", {
                    className: "aimrule-textarea",
                    value: single.data.condition || "",
                    placeholder: "\u4F8B\u5982\uFF1A\u6307\u6807 > \u9608\u503C",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { condition: event.target.value })
                  })
                ) : null,
                single.type === "calc" ? h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u8BA1\u7B97\u516C\u5F0F"),
                  h("input", {
                    className: "aimrule-input",
                    value: single.data.expr || "",
                    placeholder: "\u4F8B\u5982\uFF1A\u57FA\u6570 * \u7CFB\u6570",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { expr: event.target.value })
                  })
                ) : null,
                h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u6267\u884C\u52A8\u4F5C"),
                  h("input", {
                    className: "aimrule-input",
                    value: single.data.action || "",
                    placeholder: "\u4F8B\u5982\uFF1AESCALATE",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { action: event.target.value })
                  })
                )
              ),
              h(
                "div",
                { key: "trace", className: "aimrule-panel-section" },
                h("h3", null, "\u6EAF\u6E90\u4E0E\u5907\u6CE8"),
                h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u539F\u6587\u6761\u6B3E"),
                  h("input", {
                    className: "aimrule-input",
                    value: single.data.sourceRef || "",
                    placeholder: "\u4F8B\u5982\uFF1A\u539F\u6587\u7B2C 3 \u6761",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { sourceRef: event.target.value })
                  })
                ),
                h(
                  "div",
                  { className: "aimrule-field" },
                  h("span", { className: "aimrule-field-label" }, "\u9690\u542B\u524D\u63D0 / \u5907\u6CE8"),
                  h("textarea", {
                    className: "aimrule-textarea",
                    value: single.data.notes || "",
                    placeholder: "\u8BB0\u5F55\u53E3\u5F84\u3001\u4F8B\u5916\u6216\u3010\u5F85\u8865\u5145\u3011",
                    onFocus: pushHistoryOnce,
                    onChange: (event) => patchNode(single.id, { notes: event.target.value })
                  })
                )
              )
            ] : selectedEdgeObj ? h(
              "div",
              { className: "aimrule-panel-section" },
              h("h3", null, "\u8FDE\u7EBF"),
              h(
                "div",
                { className: "aimrule-field" },
                h("span", { className: "aimrule-field-label" }, "\u5206\u652F\u6807\u7B7E"),
                h("input", {
                  className: "aimrule-input",
                  value: selectedEdgeObj.label || "",
                  placeholder: "\u662F / \u5426 / \u5176\u4ED6\u6761\u4EF6",
                  onFocus: pushHistoryOnce,
                  onChange: (event) => mutate((state) => ({
                    ...state,
                    edges: state.edges.map((edge) => edge.id === selectedEdgeObj.id ? { ...edge, label: event.target.value } : edge)
                  }), { history: false })
                })
              ),
              h(
                "div",
                { className: "aimrule-edge-path" },
                `${nodeMap.get(selectedEdgeObj.source) ? nodeMap.get(selectedEdgeObj.source).data.label : selectedEdgeObj.source} \u2192 ${nodeMap.get(selectedEdgeObj.target) ? nodeMap.get(selectedEdgeObj.target).data.label : selectedEdgeObj.target}`
              )
            ) : [
              h(
                "div",
                { key: "selected", className: "aimrule-panel-section" },
                h("h3", null, "\u5DF2\u9009\u8282\u70B9"),
                h(
                  "div",
                  { className: "aimrule-selection-list" },
                  ...selection.map((id) => {
                    const node = nodeMap.get(id);
                    if (!node) return null;
                    const meta = TYPE_META[node.type] || TYPE_META.action;
                    return h(
                      "div",
                      { key: id, className: "aimrule-selection-row" },
                      h("span", { className: "aimrule-dot", style: { background: meta.color } }),
                      h("span", { className: "aimrule-selection-name" }, node.data && node.data.label || id),
                      h("span", { className: "aimrule-picker-meta" }, meta.label)
                    );
                  })
                )
              ),
              h(
                "div",
                { key: "batch", className: "aimrule-panel-section" },
                h("h3", null, "\u6279\u91CF\u64CD\u4F5C"),
                h("p", { className: "aimrule-hint" }, "\u53F3\u952E\u4EFB\u4E00\u9009\u4E2D\u8282\u70B9\uFF0C\u53EF\u590D\u5236\u3001\u52A0\u5165\u5BF9\u8BDD\u6846\u6216\u5408\u5E76\u6A21\u5757\u3002")
              )
            ]
          ),
          h(
            "div",
            { className: "aimrule-inspector-foot" },
            single ? [
              single.type === "module" ? h(
                "button",
                { key: "enter", className: "aimrule-btn", onClick: () => {
                  drill(single.id);
                } },
                `\u8FDB\u5165\u6A21\u5757\uFF08${childCounts.get(single.id) || 0} \u9879\uFF09`
              ) : null,
              single.type === "module" ? h("button", { key: "ungroup", className: "aimrule-btn", onClick: () => ungroup(single.id) }, "\u89E3\u6563\u6A21\u5757") : null,
              h("button", { key: "delete", className: "aimrule-btn", "data-kind": "danger", onClick: deleteSelection }, "\u5220\u9664\u8282\u70B9")
            ] : selectedEdgeObj ? h("button", { className: "aimrule-btn", "data-kind": "danger", onClick: deleteSelection }, "\u5220\u9664\u8FDE\u7EBF") : [
              h("button", { key: "group", className: "aimrule-btn", onClick: encapsulate }, "\u5408\u5E76\u4E3A\u6A21\u5757"),
              h("button", { key: "delete", className: "aimrule-btn", "data-kind": "danger", onClick: deleteSelection }, "\u5220\u9664\u6240\u9009")
            ]
          )
        ) : null
      ),
      modal === "history" ? h(
        "div",
        { className: "aimrule-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) setModal(null);
        } },
        h(
          "div",
          { className: "aimrule-modal aimrule-history-modal" },
          h(
            "div",
            { className: "aimrule-modal-head" },
            h("h2", null, "\u753B\u5E03\u5386\u53F2"),
            h("span", { className: "aimrule-history-count" }, `${flows.length} \u5F20`),
            h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModal(null) }, "\u2715")
          ),
          h(
            "div",
            { className: "aimrule-modal-body aimrule-history-body" },
            h(
              "div",
              { className: "aimrule-history-toolbar" },
              h(
                "div",
                { className: "aimrule-history-summary" },
                h("b", null, project ? baseName(project) : "\u5168\u5C40\u5DE5\u4F5C\u533A"),
                h("span", null, `${flows.length} \u5F20\u753B\u5E03 \xB7 \u5F53\u524D\u300C${current.project.name || "\u672A\u547D\u540D"}\u300D`)
              ),
              h(
                "button",
                {
                  className: "aimrule-btn",
                  "data-kind": "primary",
                  disabled: busy === "flow",
                  onClick: async () => {
                    await createFlow();
                    setModal(null);
                  }
                },
                "\uFF0B \u65B0\u5EFA\u753B\u5E03"
              )
            ),
            historyFlows.length === 0 ? h("p", { className: "aimrule-hint" }, "\u8FD9\u4E2A\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u753B\u5E03\u3002") : h(
              "div",
              { className: "aimrule-history-list" },
              ...historyFlows.map(
                (item) => h(
                  "div",
                  { key: item.id, className: "aimrule-history-row", "data-current": item.id === flowId },
                  h(
                    "div",
                    { className: "aimrule-history-main" },
                    h(
                      "div",
                      { className: "aimrule-history-name" },
                      historyEditId === item.id ? h(
                        "div",
                        { className: "aimrule-history-edit" },
                        h("input", {
                          className: "aimrule-input",
                          value: historyEditName,
                          autoFocus: true,
                          onChange: (event) => setHistoryEditName(event.target.value),
                          onKeyDown: (event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              renameFlowById(item.id, historyEditName);
                            } else if (event.key === "Escape") {
                              setHistoryEditId("");
                              setHistoryEditName("");
                            }
                          }
                        }),
                        h("button", { className: "aimrule-btn", disabled: historyBusy, onClick: () => renameFlowById(item.id, historyEditName) }, "\u4FDD\u5B58"),
                        h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => {
                          setHistoryEditId("");
                          setHistoryEditName("");
                        } }, "\u53D6\u6D88")
                      ) : h(
                        "span",
                        { className: "aimrule-history-title", title: item.name || item.id },
                        h("b", null, item.name || "\u672A\u547D\u540D\u753B\u5E03")
                      ),
                      item.id === flowId ? h("span", { className: "aimrule-history-current" }, "\u5F53\u524D") : null
                    ),
                    h(
                      "span",
                      { className: "aimrule-history-meta" },
                      `${formatHistoryTime(item.updatedAt)} \xB7 ${item.nodes} \u8282\u70B9 \xB7 ${item.edges} \u8FDE\u7EBF${item.modules ? ` \xB7 ${item.modules} \u6A21\u5757` : ""}`
                    ),
                    item.description ? h("span", { className: "aimrule-history-desc" }, item.description) : null
                  ),
                  h(
                    "div",
                    { className: "aimrule-history-actions" },
                    item.id === flowId ? null : h(
                      "button",
                      {
                        className: "aimrule-btn",
                        onClick: () => {
                          setFlowId(item.id);
                          setModal(null);
                        }
                      },
                      "\u6253\u5F00"
                    ),
                    h(
                      "button",
                      {
                        className: "aimrule-btn",
                        "data-kind": "ghost",
                        disabled: historyBusy,
                        onClick: () => beginHistoryRename(item)
                      },
                      "\u91CD\u547D\u540D"
                    ),
                    h(
                      "button",
                      {
                        className: "aimrule-btn",
                        "data-kind": "ghost",
                        disabled: historyBusy || flows.length <= 1,
                        style: { color: "var(--dsw-alias-state-error-primary)" },
                        onClick: () => deleteFlowById(item.id)
                      },
                      "\u5220\u9664"
                    )
                  )
                )
              )
            )
          ),
          h(
            "div",
            { className: "aimrule-modal-foot" },
            h("button", { className: "aimrule-btn", onClick: () => setModal("export") }, "\u5BFC\u51FA\u5F53\u524D\u753B\u5E03"),
            h("button", { className: "aimrule-btn", onClick: () => setModal(null) }, "\u5173\u95ED")
          )
        )
      ) : null,
      modal === "export" ? h(
        "div",
        { className: "aimrule-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) setModal(null);
        } },
        h(
          "div",
          { className: "aimrule-modal" },
          h(
            "div",
            { className: "aimrule-modal-head" },
            h("h2", null, "\u5BFC\u51FA\u5F00\u53D1\u4E0A\u4E0B\u6587"),
            h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModal(null) }, "\u2715")
          ),
          h(
            "div",
            { className: "aimrule-tabs" },
            ...Object.keys(files).map(
              (file) => h("button", { key: file, className: "aimrule-tab", "data-active": exportTab === file, onClick: () => setExportTab(file) }, file)
            )
          ),
          h("div", { className: "aimrule-modal-body", style: { paddingTop: 8 } }, h("pre", { className: "aimrule-pre" }, files[exportTab] || "")),
          h(
            "div",
            { className: "aimrule-modal-foot" },
            h("span", { className: "aimrule-hint", style: { marginRight: "auto" } }, `${current.nodes.length} \u4E2A\u8282\u70B9 \xB7 4 \u4EFD\u4EA7\u7269`),
            h(
              "button",
              {
                className: "aimrule-btn",
                onClick: () => {
                  const all = Object.entries(files).map(([name, content]) => `

---

# ${name}

${content}`).join("");
                  if (navigator.clipboard) navigator.clipboard.writeText(all.trim()).then(() => notify("\u5DF2\u590D\u5236\u5168\u90E8\u4EA7\u7269"), () => notify("\u590D\u5236\u5931\u8D25", "error"));
                }
              },
              "\u590D\u5236\u5168\u90E8"
            ),
            h("button", { className: "aimrule-btn", onClick: () => download(exportTab, files[exportTab] || "") }, "\u4E0B\u8F7D\u5F53\u524D"),
            h("button", { className: "aimrule-btn", "data-kind": "primary", onClick: () => Object.entries(files).forEach(([name, content]) => download(name, content)) }, "\u4E0B\u8F7D\u5168\u90E8")
          )
        )
      ) : null,
      modal === "tests" ? h(
        "div",
        { className: "aimrule-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) setModal(null);
        } },
        h(
          "div",
          { className: "aimrule-modal", style: { width: "min(920px, 100%)" } },
          h(
            "div",
            { className: "aimrule-modal-head" },
            h("h2", null, "\u6D4B\u8BD5\u9A8C\u8BC1"),
            h("span", { className: "aimrule-hint" }, `${testDrafts.length} \u6761\u7528\u4F8B`),
            h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModal(null) }, "\u2715")
          ),
          h(
            "div",
            { className: "aimrule-modal-body" },
            h(
              "div",
              { className: "aimrule-hint" },
              "\u9ED8\u8BA4\u8F93\u5165\u4F1A\u4E0E\u6BCF\u6761\u7528\u4F8B\u7684\u8F93\u5165\u5408\u5E76\uFF1B\u671F\u671B\u503C\u4E3A\u7A7A\u8868\u793A\u53EA\u8DD1\u901A\u3001\u4E0D\u6821\u9A8C\u3002\u53D8\u91CF\u540D\u987B\u4E0E\u5224\u65AD\u6761\u4EF6\u548C\u516C\u5F0F\u91CC\u7684\u4E00\u81F4\uFF0C\u516C\u5F0F\u5199\u6210\u300C\u6307\u6807 = \u57FA\u6570 * \u7CFB\u6570\u300D\u3002"
            ),
            h(
              "div",
              { className: "aimrule-field" },
              h("span", { className: "aimrule-field-label" }, "\u9ED8\u8BA4\u8F93\u5165\uFF08\u6240\u6709\u7528\u4F8B\u5171\u7528\uFF09"),
              h("textarea", {
                className: "aimrule-textarea",
                style: { minHeight: 44, fontFamily: "ui-monospace, Menlo, monospace" },
                value: testDefaults,
                placeholder: '{"\u57FA\u6570": 100, "\u7CFB\u6570": 0.3}',
                onChange: (event) => setTestDefaults(event.target.value)
              })
            ),
            h(
              "div",
              { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
              h("button", { className: "aimrule-btn", onClick: generateTests }, "\u4ECE\u753B\u5E03\u751F\u6210\u7528\u4F8B"),
              h("button", { className: "aimrule-btn", onClick: aiGenerateTests, disabled: busy === "tests" }, busy === "tests" ? "AI \u751F\u6210\u4E2D\u2026" : "\u2726 AI \u751F\u6210"),
              h(
                "label",
                { className: "aimrule-ai-append", title: "\u52FE\u9009\u65F6\u4FDD\u7559\u73B0\u6709\u7528\u4F8B\uFF0C\u53EA\u8FFD\u52A0\u65B0\u7528\u4F8B" },
                h("input", {
                  type: "checkbox",
                  checked: aiAppend,
                  onChange: (event) => setAiAppend(event.target.checked)
                }),
                "\u8FFD\u52A0"
              ),
              h(
                "button",
                {
                  className: "aimrule-btn",
                  "data-kind": "ghost",
                  disabled: testDrafts.length === 0,
                  onClick: () => {
                    setTestDrafts([]);
                    setTestResults({});
                  }
                },
                "\u6E05\u7A7A\u7528\u4F8B"
              ),
              h("button", { className: "aimrule-btn", "data-kind": "primary", onClick: () => runTests(), disabled: testDrafts.length === 0 }, "\u5168\u90E8\u8FD0\u884C"),
              h("button", { className: "aimrule-btn", onClick: saveTests, disabled: testDrafts.length === 0 }, "\u4FDD\u5B58\u7528\u4F8B")
            ),
            testDrafts.length === 0 ? h("p", { className: "aimrule-hint" }, "\u8FD8\u6CA1\u6709\u7528\u4F8B\u3002\u300C\u4ECE\u753B\u5E03\u751F\u6210\u7528\u4F8B\u300D\u6309\u6BCF\u4E2A\u5224\u65AD\u8282\u70B9\u751F\u6210\u547D\u4E2D/\u672A\u547D\u4E2D\u4E24\u6761\uFF1B\u300C\u2726 AI \u751F\u6210\u300D\u7531\u6A21\u578B\u7ED3\u5408\u6761\u4EF6\u3001\u516C\u5F0F\u548C\u6765\u6E90\u8865\u5168\u8F93\u5165\u4E0E\u671F\u671B\uFF0C\u8FD0\u884C\u540E\u518D\u6821\u51C6\u3002") : null,
            ...testDrafts.map((draft, index) => {
              const result = testResults[draft.id];
              const status = result ? result.status : "idle";
              const badge = { pass: "\u901A\u8FC7", fail: "\u5931\u8D25", error: "\u51FA\u9519", inconclusive: "\u4E0D\u786E\u5B9A", ok: "\u8DD1\u901A", idle: "\u5F85\u8DD1" }[status] || status;
              const traceTail = result && Array.isArray(result.trace) && result.trace.length > 0 ? result.trace.slice(-2).map((item) => item.detail).filter(Boolean).join(" \u2192 ") : "";
              return h(
                "div",
                { key: draft.id, className: "aimrule-case" },
                h(
                  "div",
                  { className: "aimrule-case-head" },
                  h("span", { className: "aimrule-badge", "data-status": status }, badge),
                  h("input", {
                    className: "aimrule-input",
                    style: { flex: 1 },
                    value: draft.name,
                    onChange: (event) => {
                      const next = testDrafts.slice();
                      next[index] = { ...draft, name: event.target.value };
                      setTestDrafts(next);
                    }
                  }),
                  h("button", { className: "aimrule-btn", onClick: () => runTests(draft.id) }, "\u8FD0\u884C"),
                  h(
                    "button",
                    {
                      className: "aimrule-btn aimrule-case-delete",
                      "data-kind": "ghost",
                      title: "\u5220\u9664\u7528\u4F8B",
                      onClick: () => {
                        setTestDrafts((current2) => current2.filter((_, itemIndex) => itemIndex !== index));
                        const next = { ...testResults };
                        delete next[draft.id];
                        setTestResults(next);
                      }
                    },
                    "\u2715"
                  )
                ),
                h(
                  "div",
                  { className: "aimrule-case-grid" },
                  h(
                    "div",
                    { className: "aimrule-field" },
                    h("span", { className: "aimrule-field-label" }, "\u8F93\u5165"),
                    h("textarea", {
                      className: "aimrule-textarea",
                      style: { minHeight: 40, fontFamily: "ui-monospace, Menlo, monospace" },
                      value: draft.inputs,
                      onChange: (event) => {
                        const next = testDrafts.slice();
                        next[index] = { ...draft, inputs: event.target.value };
                        setTestDrafts(next);
                      }
                    })
                  ),
                  h(
                    "div",
                    { className: "aimrule-field" },
                    h("span", { className: "aimrule-field-label" }, "\u671F\u671B"),
                    h("textarea", {
                      className: "aimrule-textarea",
                      style: { minHeight: 40, fontFamily: "ui-monospace, Menlo, monospace" },
                      value: draft.expect,
                      placeholder: '{"\u6307\u6807": 30}',
                      onChange: (event) => {
                        const next = testDrafts.slice();
                        next[index] = { ...draft, expect: event.target.value };
                        setTestDrafts(next);
                      }
                    })
                  )
                ),
                result ? h(
                  "div",
                  { className: "aimrule-case-result" },
                  result.message ? h("span", null, result.message) : null,
                  ...(result.mismatches || []).map(
                    (item) => h("span", { key: item.key, className: "aimrule-mismatch" }, `${item.key}: \u671F\u671B ${JSON.stringify(item.expected)}\uFF0C\u5B9E\u9645 ${JSON.stringify(item.actual)}`)
                  ),
                  traceTail && !result.message ? h("span", { className: "aimrule-muted" }, traceTail) : null,
                  result.nodeId ? h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => locateNode(result.nodeId) }, "\u5B9A\u4F4D\u8282\u70B9") : null
                ) : null
              );
            })
          ),
          h(
            "div",
            { className: "aimrule-modal-foot" },
            h("span", { className: "aimrule-hint", style: { marginRight: "auto" } }, "\u8FD0\u884C\u4F1A\u540C\u65F6\u628A\u7528\u4F8B\u4FDD\u5B58\u8FDB\u753B\u5E03\u6587\u6863"),
            h("button", { className: "aimrule-btn", onClick: () => setModal(null) }, "\u5173\u95ED")
          )
        )
      ) : null,
      modal === "modules" ? h(
        "div",
        {
          className: "aimrule-overlay",
          "data-dragging": Boolean(draggingModule),
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) setModal(null);
          }
        },
        h(
          "div",
          { className: "aimrule-modal", style: { width: "min(820px, 100%)" } },
          h(
            "div",
            { className: "aimrule-modal-head" },
            h("h2", null, "\u8DE8\u6D41\u7A0B\u56FE\u6A21\u5757\u5E93"),
            h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModal(null) }, "\u2715")
          ),
          h(
            "div",
            { className: "aimrule-modal-body" },
            h(
              "div",
              { className: "aimrule-hint" },
              "\u6C47\u603B\u5F53\u524D\u5DE5\u4F5C\u533A\u6240\u6709\u6D41\u7A0B\u56FE\u91CC\u7684\u6A21\u5757\uFF0C\u7528\u4E8E\u7BA1\u7406\u548C AI \u68C0\u6D4B\u590D\u7528\u3002\u63D2\u5165\u8BF7\u7528\u9876\u680F\u7684\u300C\u6A21\u5757\u300D\u5FEB\u901F\u9009\u62E9\u5668\uFF1A\u53EF\u70B9\u51FB\u653E\u5230\u4E2D\u592E\uFF0C\u4E5F\u53EF\u62D6\u5230\u753B\u5E03\u843D\u70B9\u3002"
            ),
            h(
              "div",
              { className: "aimrule-detect" },
              h(
                "button",
                {
                  className: "aimrule-btn",
                  "data-kind": "primary",
                  onClick: detectModules,
                  disabled: detectBusy
                },
                detectBusy ? "\u68C0\u6D4B\u4E2D\u2026" : "\u2726 AI \u68C0\u6D4B\u590D\u7528"
              ),
              h("span", { className: "aimrule-hint" }, "\u626B\u63CF\u5DE5\u4F5C\u533A\u6240\u6709\u6D41\u7A0B\u56FE\uFF0C\u627E\u51FA\u91CD\u590D\u51FA\u73B0\u7684\u5B50\u56FE\u5E76\u62BD\u6210\u6A21\u5757")
            ),
            candidates.length > 0 ? h(
              "div",
              { className: "aimrule-candidates" },
              ...candidates.map(
                (candidate, index) => h(
                  "div",
                  { key: `${candidate.name}-${index}`, className: "aimrule-candidate" },
                  h(
                    "div",
                    { className: "aimrule-candidate-head" },
                    h("b", null, candidate.name),
                    candidate.reason ? h("span", null, candidate.reason) : null
                  ),
                  ...candidate.occurrences.map(
                    (occurrence) => h(
                      "div",
                      {
                        key: `${occurrence.flowId}:${occurrence.nodeIds.join(",")}`,
                        className: "aimrule-candidate-occ"
                      },
                      h("span", null, `${occurrence.flowName} \xB7 ${occurrence.nodeIds.length} \u8282\u70B9`),
                      h(
                        "button",
                        {
                          className: "aimrule-btn",
                          onClick: () => extractCandidate(candidate, occurrence),
                          disabled: Boolean(extractBusy)
                        },
                        extractBusy === `${occurrence.flowId}:${candidate.name}` ? "\u62BD\u53D6\u4E2D\u2026" : "\u62BD\u4E3A\u6A21\u5757"
                      )
                    )
                  )
                )
              )
            ) : null,
            h("div", { className: "aimrule-modal-sep" }, "\u5DF2\u6709\u6A21\u5757"),
            modulesLoading ? h("p", { className: "aimrule-hint" }, "\u6B63\u5728\u626B\u63CF\u6D41\u7A0B\u56FE\u2026") : modules.length === 0 ? h("p", { className: "aimrule-hint" }, "\u5F53\u524D\u5DE5\u4F5C\u533A\u8FD8\u6CA1\u6709\u6A21\u5757\u3002\u5148\u5728\u4E00\u4E2A\u6D41\u7A0B\u56FE\u91CC\u6846\u9009\u8282\u70B9\u5E76\u300C\u5C01\u88C5\u300D\u6210\u6A21\u5757\u3002") : [...modules].sort((a, b) => String(a.flowName).localeCompare(String(b.flowName)) || String(a.name).localeCompare(String(b.name))).map(
              (entry) => h(
                "div",
                { key: entry.key, className: "aimrule-module-row" },
                h(
                  "div",
                  { className: "aimrule-module-info" },
                  h("b", null, entry.name),
                  h("span", null, `${entry.flowName} \xB7 ${entry.nodeCount} \u4E2A\u8282\u70B9`)
                )
              )
            )
          ),
          h(
            "div",
            { className: "aimrule-modal-foot" },
            h(
              "span",
              { className: "aimrule-hint", style: { marginRight: "auto" } },
              `${modules.length} \u4E2A\u6A21\u5757 \xB7 \u6765\u81EA ${new Set(modules.map((item) => item.flowId)).size} \u4E2A\u6D41\u7A0B\u56FE`
            ),
            h("button", { className: "aimrule-btn", onClick: () => setModal(null) }, "\u5173\u95ED")
          )
        )
      ) : null,
      modal === "overview" ? h(
        "div",
        { className: "aimrule-overlay", onMouseDown: (event) => {
          if (event.target === event.currentTarget) setModal(null);
        } },
        h(
          "div",
          { className: "aimrule-modal" },
          h(
            "div",
            { className: "aimrule-modal-head" },
            h("h2", null, "\u753B\u5E03\u6982\u89C8"),
            h("button", { className: "aimrule-btn", "data-kind": "ghost", onClick: () => setModal(null) }, "\u2715")
          ),
          h(
            "div",
            { className: "aimrule-modal-body" },
            h(
              "div",
              { className: "aimrule-overview-grid" },
              h("div", { className: "aimrule-stat" }, h("b", null, current.nodes.length), h("span", null, "\u8282\u70B9")),
              h("div", { className: "aimrule-stat" }, h("b", null, current.edges.length), h("span", null, "\u8FDE\u7EBF")),
              h("div", { className: "aimrule-stat" }, h("b", null, current.nodes.filter((node) => node.type === "module").length), h("span", null, "\u6A21\u5757"))
            ),
            h("div", { className: "aimrule-muted" }, `\u5F53\u524D\u5DE5\u4F5C\u533A\u5171 ${flows.length} \u4E2A\u6D41\u7A0B\u56FE\uFF1B\u5DE5\u5177\u680F\u4E0E\u68C0\u67E5\u5668\u53EA\u4F5C\u7528\u4E8E\u5F53\u524D\u6D41\u7A0B\u56FE\u3002`),
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 8 } },
              h("h3", { className: "aimrule-field-label", style: { margin: 0 } }, "\u8282\u70B9\u7C7B\u578B"),
              h(
                "div",
                { className: "aimrule-legend" },
                ...TYPE_ORDER.map(
                  (type) => h(
                    "div",
                    { key: type, className: "aimrule-legend-row" },
                    h("span", { className: "aimrule-legend-dot", style: { background: TYPE_META[type].color } }),
                    h("span", null, `${TYPE_META[type].label} \xB7 ${TYPE_META[type].hint}`)
                  )
                )
              )
            ),
            current.sources.length > 0 ? h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 8 } },
              h("h3", { className: "aimrule-field-label", style: { margin: 0 } }, "\u8F93\u5165\u6765\u6E90"),
              ...current.sources.slice(-6).reverse().map(
                (source) => h(
                  "div",
                  { key: source.id, className: "aimrule-source" },
                  h("b", null, source.title || "\u672A\u547D\u540D\u6765\u6E90"),
                  h("span", null, source.text || "")
                )
              )
            ) : null,
            h(
              "div",
              { style: { display: "flex", flexDirection: "column", gap: 8 } },
              h("h3", { className: "aimrule-field-label", style: { margin: 0 } }, "\u64CD\u4F5C"),
              h(
                "div",
                { className: "aimrule-shortcuts" },
                ...[
                  ["\u62D6\u52A8\u7A7A\u767D\u5904", "\u6846\u9009\u4E00\u7EC4\u8282\u70B9"],
                  ["\u53CC\u51FB\u7A7A\u767D\u5904", "\u6DFB\u52A0\u8282\u70B9"],
                  ["\u53CC\u51FB\u6A21\u5757", "\u8FDB\u5165\u6A21\u5757\u5185\u90E8"],
                  ["\u6EDA\u8F6E / \u89E6\u63A7\u677F", "\u5E73\u79FB\u753B\u5E03"],
                  ["\u2318 / Ctrl + \u6EDA\u8F6E", "\u7F29\u653E\u753B\u5E03"],
                  ["\u2318Z / \u21E7\u2318Z", "\u64A4\u9500 / \u91CD\u505A"]
                ].map(
                  ([keys, label]) => h(
                    "div",
                    { key: keys, style: { display: "flex", alignItems: "center", gap: 9 } },
                    h("span", { className: "aimrule-kbd" }, keys),
                    h("span", null, label)
                  )
                )
              )
            )
          ),
          h(
            "div",
            { className: "aimrule-modal-foot" },
            h(
              "button",
              {
                className: "aimrule-btn",
                "data-kind": "danger",
                style: { marginRight: "auto" },
                onClick: () => {
                  setModal(null);
                  deleteFlow();
                },
                disabled: flows.length <= 1
              },
              "\u5220\u9664\u5F53\u524D\u6D41\u7A0B\u56FE"
            ),
            h("button", { className: "aimrule-btn", onClick: () => setModal(null) }, "\u5173\u95ED")
          )
        )
      ) : null,
      error && modal === null ? h("div", { className: "aimrule-toast", "data-tone": "error" }, error) : null
    );
  }
  function AimRuleLauncher(props) {
    const [open, setOpen] = useState(false);
    const sessionId = props && typeof props.sessionId === "string" ? props.sessionId : "";
    const workspaceItems = (props && typeof props.useWorkspaces === "function" ? props.useWorkspaces((snapshot) => snapshot.items) : null) || [];
    const sessions = (props && typeof props.useSessions === "function" ? props.useSessions((snapshot) => snapshot.byId) : null) || {};
    const session = sessions[sessionId] || null;
    const workspace = (workspaceItems || []).find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId));
    const projectPath = workspace && workspace.path || session && session.cwd || "";
    const workspaceLabel = workspace ? workspace.title || baseName(workspace.path) : projectPath ? baseName(projectPath) : "\u672A\u7ED1\u5B9A\u5DE5\u4F5C\u533A";
    const overlay = open && typeof document !== "undefined" ? createPortal(
      h(
        "div",
        {
          className: "aimrule-launcher-mask",
          onMouseDown: (event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }
        },
        h(
          "div",
          { className: "aimrule-launcher", role: "dialog", "aria-modal": "true", "aria-label": "AimRule \u6D41\u7A0B\u56FE\u8BBE\u8BA1" },
          h(
            "div",
            { className: "aimrule-launcher-head" },
            h("span", { className: "aimrule-launcher-mark" }, h(AimRuleIcon, { size: 20 })),
            h(
              "div",
              { className: "aimrule-launcher-heading" },
              h("b", null, "\u6D41\u7A0B\u56FE\u8BBE\u8BA1"),
              h("span", { title: projectPath || "" }, workspaceLabel, sessionId ? " \xB7 \u5F53\u524D\u4F1A\u8BDD" : "")
            ),
            h("span", { className: "aimrule-launcher-spacer" }),
            h(
              "button",
              { type: "button", className: "aimrule-launcher-close", title: "\u5173\u95ED\u6D41\u7A0B\u56FE\u8BBE\u8BA1", onClick: () => setOpen(false) },
              "\u2715"
            )
          ),
          h(
            "div",
            { className: "aimrule-launcher-body" },
            h(AimRulePage, {
              useSessions: props.useSessions,
              useWorkspaces: props.useWorkspaces,
              sessionId,
              readCurrentSession: () => sessionId,
              defaultProject: projectPath
            })
          )
        )
      ),
      document.body
    ) : null;
    return h(
      "div",
      { className: "aimrule-launcher-root" },
      h(
        "button",
        {
          type: "button",
          className: "aimrule-launch-button",
          title: "\u6253\u5F00\u6D41\u7A0B\u56FE\u8BBE\u8BA1",
          "aria-label": "\u6253\u5F00\u6D41\u7A0B\u56FE\u8BBE\u8BA1",
          onClick: () => setOpen(true)
        },
        h(AimRuleIcon, { size: 22 })
      ),
      overlay
    );
  }
  function createPlugin() {
    return {
      inject: ["slots"],
      apply(ctx) {
        ctx.slots.inject(
          "main",
          () => ctx.slots.register(
            {
              name: "main",
              key: "aimrule"
            },
            (pageProps) => h(AimRulePage, {
              ...pageProps,
              readCurrentSession: () => {
                try {
                  const reference = ctx.get("uiWorkspace") && ctx.get("uiWorkspace").mainReference;
                  return reference && typeof reference.sessionId === "string" ? reference.sessionId : "";
                } catch {
                  return "";
                }
              }
            })
          )
        );
        ctx.slots.inject(
          "sidebar.panellist",
          () => ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: "aimrule",
              order: 30,
              label: "AimRule"
            },
            AimRuleSidebarIcon
          )
        );
        ctx.slots.inject(
          "conversation.input.left",
          () => ctx.slots.register(
            {
              name: "conversation.input.left",
              id: "aimrule-designer",
              order: 40
            },
            AimRuleLauncher
          )
        );
      }
    };
  }

  // src/entry.jsx
  window.__ModuleLoader__.load({
    id: "@aimrule/dsh-plugin-flow",
    factory(require2) {
      const React = require2("react");
      setReact(React);
      setReactDOM(require2("react-dom"));
      if (typeof document !== "undefined") {
        let style = document.querySelector('style[data-plugin="aimrule"]');
        if (!style) {
          style = document.createElement("style");
          style.dataset.plugin = "aimrule";
          document.head.appendChild(style);
        }
        style.textContent = CSS;
      }
      return createPlugin();
    }
  });
})();
