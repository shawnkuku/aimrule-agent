# AimRule

AimRule is a human-in-the-loop business-rule workbench for the DeepSeek Harness.
It turns linear policy text, chat logs, source code, and uploaded documents into
a nested, editable rule canvas, and turns that canvas back into engineering
context: Mermaid flow, pseudo code, a YAML contract, and a test-case list.

The bundle ships both halves:

- **Host half** (`index.js`) — owns one or more flow documents per workspace
  (`<project>/.aimrule/flows/<id>.md`; the legacy single-file
  `<project>/.aimrule/state.json` is imported as `legacy`), the workspace module
  catalog, the LLM extraction and local-edit pipeline (strict JSON, structural
  validation, up to three repair attempts), the HTTP API under `/aimrule/api`,
  and five agent tools.
- **Client half** (`client.js`) — a full-page canvas panel in the main column,
  a sidebar entry, and a chat-composer button that opens the designer in a
  modal bound to the current session. Built from `src/` with `node build.mjs`.

## Agent tools

| Tool | What it does |
| --- | --- |
| `aimrule_generate` | Policy text / chat log → nested rule graph on the canvas. |
| `aimrule_parse_code` | Source file → recovered branches and calculations. |
| `aimrule_canvas` | Read the current graph, or replace it with a graph the agent constructed. |
| `aimrule_test` | Generate test cases from the canvas judges, then run them against the rule evaluator. |
| `aimrule_export` | Write `flow.md`, `logic_pseudo.md`, `contract.yaml`, `test_cases.yaml` into `aimrule-export/`. |

## Canvas interaction

- The top bar holds the canvas tools (add node, hand/pan, undo/redo,
  auto-layout, zoom, module picker) next to **测试** and **⋯**. The chat composer
  toolbar adds an AimRule button; it opens the same designer in a modal bound to
  the current session and auto-selects the session workspace (falling back to
  the session cwd). The modal portals to `document.body`, so the composer's
  sticky/transform layer cannot clip it. Selecting something opens the right
  inspector; with nothing selected the canvas keeps the full width.
- Drag empty space to marquee-select with the normal pointer; click the hand
  button in the top toolbar (or hold Space) to pan; Shift + drag also
  marquee-selects. Drag a node to move it; drag the right handle to connect;
  double-click a module to enter it.
- Right-click a node for **复制 / 添加到对话框 / 合并模块 / 删除**. The menu does
  not open the property inspector; left-click still opens it for editing.
  Merge is enabled once at least two nodes are selected. Right-click empty
  space to create any node type at that point, copy the current selection, or
  paste copied nodes. ⌘/Ctrl + C / V also copy and paste; copying a selected
  module includes its subtree.
- Wheel pans, ⌘/Ctrl + wheel zooms, `⌘Z` / `⇧⌘Z` undo and redo.
- Arrow keys nudge selected nodes by 1px (Shift = 10px); double-click empty
  space opens the node menu at that point; while connecting, the target node
  highlights so the drop is unambiguous.
- Inside a module, a floating breadcrumb appears at the top-left: **← 根画布**
  returns to the root, and any ancestor label jumps to that level. When no
  overlay is open, Esc goes up one module level.
- The title's **切换 ▾** menu switches, creates, or deletes flowcharts; the
  title field renames the current one. The full-width **＋ 新建流程图** button
  in that menu creates a blank flowchart — the bottom composer is immediately
  ready. The workspace selector sits next to it. **概览与帮助** also offers
  deletion when more than one exists.
- The top bar **▦ 模块** button opens a quick picker that searches module names,
  source flows, and the labels/conditions/actions inside each module. Hovering
  a row previews its internal nodes; recently used modules are listed first.
  Click a row to insert it at the viewport centre and keep the picker open for
  more, or drag a row onto the canvas to place it at the drop point.
  **完整模块库** opens the full library for management and AI detection.
- The full **模块库** (under **⋯**) is management-only: it lists modules and
  hosts AI reuse detection. Insert modules through the top-bar **▦ 模块** quick
  picker: click a row for the viewport centre or drag it to a drop point. The
  source is recorded in each node's notes; external links are left for you.
- **AI 检测复用** scans all flowcharts, asks the model for subgraphs that recur
  across flows, validates every proposed node id and edge, then offers
  **抽为模块** per occurrence. Extraction wraps the selected nodes into a module
  in their source flowchart and rewires the external edges.
- The top bar groups the canvas tools (add node, hand/pan, undo/redo,
  auto-layout, zoom, module picker) next to **测试** and **⋯**. On narrow
  panels undo/redo/layout/zoom collapse into a **⚙ 更多画布工具** menu; below
  760px the sync text and module label become icons and the title/workspace are
  capped. Add, hand, module, **测试**, and **⋯** stay visible; templates, module library,
  export, and help live under **⋯**.
- An empty canvas shows a short hero plus the always-available bottom
  **composer**; **概览与帮助** under **⋯** holds the type legend, sources, and
  shortcuts.
- The composer is the single AI entry. Type a requirement or paste source text,
  then use **＋** to reference conversation records (individual checks, select
  all / clear), flowchart nodes or modules, workspace files or folders (the
  workspace picker is a tree and lets you select a whole folder), or upload
  attachments. Files can also be dropped onto the canvas/composer from the OS. References become chips; Enter generates, Shift+Enter
  inserts a newline, and the result is merged into the current canvas (an empty
  canvas is replaced). Conversation and file text are combined under the 60k
  source cap; the typed text becomes the extraction goal when references are
  present.
- File ingestion handles txt/md/csv/json/yaml/html/code, DOCX/PPTX/XLSX (native
  OOXML text), and PDF/legacy Office through the local LibreOffice when it is
  installed. Scanned PDFs and images still need OCR and are reported as
  unreadable rather than silently dropped.
- Composer import leaves open points reported by the model in the amber banner
  above the canvas.
- Cyclic rules (rework / review loops) are allowed: generation keeps the cycle
  and adds a note in the banner. Layout is cycle-safe, and the evaluator stops
  at the first repeated node, so running tests on a loop does not hang.
- **测试** opens the verification table. **从画布生成用例** derives a hit/miss
  pair per judge deterministically; **✦ AI 生成** asks the host model for 6–12
  cases from the graph, conditions, formulas, and source excerpts. Both fill
  shared defaults plus per-case expectations; run, then jump to the failing
  node. Each case has a delete **✕**, and **清空用例** removes the whole draft.
  **✦ AI 生成** appends by default (uncheck 追加 to replace); AI cases are
  suggestions — the deterministic runner is the judge.
- **导出** renders all four artifacts in-page, with copy and download.

## Theme

The panel reads the Harness theme tokens instead of hard-coding a palette:
`--dsw-alias-bg-base/layer-*`, `--dsw-alias-border-l3/l4`,
`--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-foreground`,
`--dsw-alias-state-business-primary`, and the `--dsw-static-*` swatches for node
types. Hairline `.5px` borders and the Harness radii (8/12/16) keep it aligned
with the surrounding client in both light and dark themes.

## Testing a canvas

`测试` runs the canvas as a deterministic rule program — no LLM, no `eval`:

- **Generated cases** take their input value from the literal in the judge
  condition (`状态 == "例外"` yields `状态 = 例外` and `= 其他`).
- **Default inputs** (one JSON object) merge under every case, so shared
  parameters are typed once.
- **Expectations** compare against the variables produced by `calc` nodes;
  an empty expectation only checks that the path executes.
- A run reports `通过` / `失败` / `出错` / `不确定` / `跑通`; failures name the key,
  the expected value, and the actual value, and `定位节点` jumps to the node.

The expression subset is comparisons (`==`, `!=`, `>`, `>=`, `<`, `<=`), boolean
logic (`AND`/`OR`/`NOT`, `&&`/`||`/`!`), arithmetic, and `min`, `max`, `abs`,
`round`, `floor`, `ceil`, `len`, `contains`, `lower`, `upper`, `number`, `text`.
Anything else (including an unknown function) is reported as `不确定`, never as
a pass.

## Generation reliability

Structured extraction is a strict-JSON call, not a chat turn. The host asks
DeepSeek for `reasoningEffort: 'off'` and a 32k output budget: the provider's
default `high` reasoning used to spend the whole 8k budget on hidden thinking,
so the model returned a truncated JSON or no visible text at all ("模型返回了
空内容"). The error now names the finish reason and, when present, the hidden
reasoning length. Responses are requested as compact JSON to keep large graphs
inside the budget.

## Canvas document

```json
{
  "project": { "name": "...", "description": "..." },
  "nodes": [
    { "id": "n1", "type": "judge", "parentId": null,
      "pos": { "x": 0, "y": 0 },
      "data": { "label": "...", "condition": "...", "action": "...",
                "expr": "...", "sourceRef": "...", "notes": "..." } }
  ],
  "edges": [{ "id": "e1", "source": "n1", "target": "n2", "label": "是" }],
  "templates": [],
  "sources": []
}
```

`type` is one of `start`, `judge`, `calc`, `action`, `end`, `module`. Nesting is
expressed by `parentId` pointing at a `module` node; positions are relative to
the node's own scope, so every module has its own coordinate space.

## HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/aimrule/api/state` | Load one flowchart (`?project=...&flow=...`). |
| `PUT`/`POST` | `/aimrule/api/state` | Save one flowchart (normalized on write). |
| `GET` | `/aimrule/api/flows` | List the flowcharts of a workspace. |
| `POST` | `/aimrule/api/flows` | Create a flowchart (`{ project, name }`). |
| `POST` | `/aimrule/api/flows/delete` | Delete a flowchart; the last one is kept. |
| `GET` | `/aimrule/api/modules` | List modules across every flowchart in the workspace, with their subtrees. |
| `POST` | `/aimrule/api/modules/detect` | Ask the model for subgraphs that recur across flowcharts; every proposed id and edge is validated. |
| `POST` | `/aimrule/api/modules/extract` | Wrap a candidate's nodes into a module in their source flowchart and rewire external edges. |
| `POST` | `/aimrule/api/generate` | Extract a graph from `text` (+ optional `instruction`, `mode`, `flow`). |
| `POST` | `/aimrule/api/tests/generate` | Ask the model for test cases (`{ project, flow, doc }`); returns `{ cases, defaults, notes }`, sanitized to primitive inputs/expectations. |
| `POST` | `/aimrule/api/modify` | Patch the selected nodes from a natural-language `instruction`. |
| `POST` | `/aimrule/api/transcript` | Read one session's recent messages (`sessionId`, optional `maxChars`) as text and structured `items` for checkbox selection; runtime context, tool output, and reasoning are dropped. |
| `GET` | `/aimrule/api/workspace/tree` | List files and folders of the current workspace for the composer's path picker. |
| `POST` | `/aimrule/api/ingest` | Extract text from uploaded files (`files: [{ name, data }]`, base64) or workspace paths (`paths: [...]`). Handles text, OOXML, PDF/legacy Office via LibreOffice; returns per-file character counts. |
| `GET` | `/aimrule/api/export` | Render the four artifacts without writing files. |

Every state/generate/export call accepts `?project=<absolute path>&flow=<flow id>`.
A workspace stores its flowcharts as Markdown in
`<path>/.aimrule/flows/<id>.md`, so each flow travels with the project and can be
reviewed in a normal diff. Each file has YAML frontmatter, readable sections for
nodes / edges / sources / tests, and one fenced `aimrule` block at the end. The
fence is the machine-readable graph; the readable sections are regenerated on
save, so the file is both documentation and storage. This follows the
fenced-diagram pattern used by
[dsh-chat-flow](https://dshhub.org/en/plugins/Kr-ATG/dsh-chat-flow/).

Old `flows/<id>.json` files are migrated to `<id>.md` on first access and kept
beside them as `<id>.json.bak`. If a Markdown file fails to parse, Host falls
back to the `.json`/`.json.bak` copy, keeps the broken file as
`<id>.md.corrupt`, and shows a warning in the panel. A legacy `<path>/.aimrule/state.json` is imported
as the `legacy` flow and the original stays as a backup. An unknown or
non-absolute path is rejected. Without `project`, the global workspace under the
Host default directory is used.

The panel's workspace selector lists registered workspaces, defaults to the
workspace of the most recently updated session, and remembers the choice. The
flow menu remembers the last flowchart per workspace. Agent tools use the
calling session's workspace and the most recently updated flowchart unless the
tool call passes `flow`. Cross-site writes are rejected by `Origin`.

## Development

```bash
node build.mjs                # rebuild client.js from src/
node test/render-check.mjs    # mount the real page in jsdom against a stubbed host
node test/evaluate-check.mjs  # rule evaluator, nested rules, cycles
node test/host-check.mjs      # flows, modules, extraction, legacy import, transcript
```

The render check also exercises workspace/flow selection, the conversation
loader, node selection, the test modal (including AI cases), the quick module
picker, drag/drop, breadcrumbs, and the AI detection panel. The host check
mounts the host half against a stubbed context and verifies Markdown flow
files, migration/fallback, the cross-flow module catalog, candidate extraction
with edge rewiring, and mocked LLM test/generation endpoints including
retry, exhausted repairs, and an unavailable model.

The client code is split into `src/app.jsx` (page/state/interactions),
`src/components.jsx` (icons, node card, workspace picker), `src/styles.js`
(theme CSS), and `src/flow-model.js` (pure graph, layout, tree, and node-text
helpers). The host half is split into `host/state.js` (document normalization),
`host/markdown.js` (readable flow files), `host/storage.js` (workspaces,
flows, module catalog), and `host/llm.js` (prompts, streaming JSON, bounded
repair); `index.js` keeps the HTTP API and tools.

`client.js` is the installable artifact; rebuild it after changing `src/`.

## Release

```bash
node release.mjs patch        # 0.9.x -> next patch
node release.mjs minor
node release.mjs 1.0.0        # explicit version
node release.mjs patch --push # also git push origin HEAD --tags
```

The release script updates `aimrule/package.json` and the host `version`,
rebuilds `client.js`, runs all three test suites, writes an npm tarball, a plugin
ZIP, and a `RELEASE-vX.Y.Z.md` note under `dist/`, then creates the git commit
and annotated tag. Use `--skip-tests` or `--no-commit` to opt out.
