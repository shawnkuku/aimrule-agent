# AimRule

[English](#english) · [中文](#中文)

Turn policy text, chat logs, and source files into an editable nested rule
flowchart — then export it as engineering artifacts.

把政策条文、对话记录和源码变成可编辑的嵌套规则流程图，再导出为工程产物。

---

## English

### What it does

- Extracts a rule graph from text, chat records, workspace files/folders, or source code.
- Lets you refine it on a nested canvas: start, judge, calc, action, end, module.
- Tests the rules deterministically and exports Mermaid, pseudocode, YAML, and test cases.

### Open it

**Chat composer** — the AimRule icon next to `+` opens the full workbench in a
modal bound to the current session and workspace. The workspace is fixed and
shown as a locked label, so it cannot drift from the conversation; use the
flow switcher for canvases inside that workspace. AimRule no longer adds a
sidebar entry.

### Quick start

1. Open from the chat composer. The workspace is fixed to the current session.
2. Type a rule, or `+` to reference chat records, existing nodes/modules, workspace
   files/folders, or uploads.
3. Press Enter. Review the graph and any open points in the banner above it.
4. Refine nodes, run **测试** (Tests), and open **导出** (Export).

### Canvas basics

- Drag blank space to marquee-select; hand button or Space to pan; ⌘/Ctrl + wheel to zoom.
- Drag a node to move; drag its right handle to connect; double-click a module to enter it.
- Right-click a node: copy, add to composer, merge, delete.
- Right-click blank space: create a node, copy, or paste.
- Arrow keys nudge selected nodes by 1px (Shift = 10px).
- ⌘Z / ⇧⌘Z undo and redo; Esc closes an overlay, or goes up one module level.

The UI labels are Chinese; this guide keeps them so they are easy to match.

### Canvas history

The clock button next to **切换** opens **画布历史** (canvas history). It lists
every canvas in the workspace, most recently updated first, with time,
node/edge/module counts, and the current marker. From there you can open,
rename, delete, create a canvas, or export the current one.

### Modules

- **▦ 模块** opens a quick picker. It searches module names, source flows, and the
  labels / conditions / actions inside each module. Hovering previews the internal
  nodes; recently used modules are listed first.
- Click a module to insert it at the viewport centre and keep the picker open, or
  drag it onto the canvas to choose the drop point.
- **完整模块库** (under **⋯** → 模块库) is for management and **AI 检测复用** only:
  it scans flows for repeated subgraphs and can extract a selection into a module.

### Tests and export

- **测试** runs the canvas as a deterministic rule program. Generated cases cover
  each judge's hit/miss path; AI cases are suggestions and append by default.
- Failures report the key, expected value, and actual value, and can jump to the node.
- **导出** writes `flow.md`, `logic_pseudo.md`, `contract.yaml`, and `test_cases.yaml`
  into `aimrule-export/`, with copy/download in the panel.

### Agent tools

| Tool | Purpose |
| --- | --- |
| `aimrule_generate` | Policy text / chat log → nested rule graph. |
| `aimrule_parse_code` | Source file → recovered branches and calculations. |
| `aimrule_canvas` | Read the canvas, or replace it with a constructed graph. |
| `aimrule_test` | Generate or run the canvas test cases. |
| `aimrule_export` | Write the four engineering artifacts. |

### Storage

- Each flowchart is one Markdown file: `<workspace>/.aimrule/flows/<id>.md`.
- The file has a readable summary plus a fenced `aimrule` JSON block for the machine.
- Old `<id>.json` files are migrated to `<id>.json.bak`; a broken `.md` falls back to
  the JSON backup and keeps a `.md.corrupt` copy.
- Without a project, the Host's global workspace is used.

### Install

- Install the release tarball (`dist/aimrule-dsh-plugin-flow-<version>.tgz`) with the DSH
  plugin manager, or enable the `aimrule` bundle in your profile, then refresh.
- Published package: `npm install @aimrule/dsh-plugin-flow` (after the first npm release).
- LibreOffice is optional and only needed for PDF / legacy Office import.
  Scanned PDFs and images need OCR.

### Develop and release

```bash
cd aimrule
node build.mjs                 # rebuild client.js
node test/host-check.mjs
node test/render-check.mjs
node test/evaluate-check.mjs
```

From the repository root:

```bash
node scripts/release.mjs patch  # bump, build, test, pack, commit, tag
node scripts/release.mjs patch --push  # also push the commit and tag
```

The UI uses the Harness theme tokens, so it follows light and dark mode.

---

## 中文

### 它是什么

- 从条文、对话记录、工作区文件/文件夹或源码中提取规则图。
- 在嵌套画布上继续改：开始、判断、计算、动作、结束、模块。
- 用确定性规则跑测试，并导出 Mermaid、伪代码、YAML 和测试用例。

### 从哪里打开

**聊天输入框**：点 `+` 旁的 AimRule 图标，会在弹层里打开完整工作台，
自动绑定当前会话和会话所在的工作区。工作区以锁定标签展示、不可切换，
避免和会话上下文错位；要换画布用「切换」。AimRule 不再添加侧栏入口。

### 快速开始

1. 从聊天输入框打开，工作区固定为当前会话所在工作区。
2. 输入规则，或用 `+` 引用对话记录、画布节点/模块、工作区文件/文件夹、上传附件。
3. 按 Enter 生成。先看画布，再看顶部条幅里的待确认点。
4. 改节点，点 **测试** 跑用例，点 **导出** 拿工程产物。

### 画布操作

- 空白处拖拽框选；手形按钮或按住 Space 平移；⌘/Ctrl + 滚轮缩放。
- 拖节点移动；拖右侧端点连线；双击模块进入内部。
- 右键节点：复制、添加到对话框、合并模块、删除。
- 右键空白：新建节点、复制、粘贴。
- 方向键微调选中节点 1px（Shift = 10px）。
- ⌘Z / ⇧⌘Z 撤销重做；Esc 关闭浮层，或返回上一层模块。

### 画布历史

**切换** 旁的时钟按钮打开 **画布历史**：按更新时间列出工作区全部画布，显示
节点/连线/模块数量和当前标记；可以打开、重命名、删除、新建画布，或导出当前画布。

### 模块

- **▦ 模块** 打开快速选择器，可搜模块名、来源流程图，以及模块内部的
  节点名、条件、动作；悬停可预览内部节点，最近使用的排在最前。
- 点击模块插到画布中央，选择器不关闭；也可以直接拖到画布落点。
- **完整模块库**（**⋯** → 模块库）只做管理和 **AI 检测复用**：扫描多个
  流程图里重复出现的子图，并支持把选中的节点抽成模块。

### 测试与导出

- **测试** 把画布当确定性规则程序运行。生成的用例覆盖每个判断的是/否路径；
  AI 用例是建议，默认追加，不覆盖已有用例。
- 失败会给出字段、期望值、实际值，并支持定位到节点。
- **导出** 把 `flow.md`、`logic_pseudo.md`、`contract.yaml`、`test_cases.yaml`
  写入 `aimrule-export/`，面板里可复制和下载。

### Agent 工具

| 工具 | 作用 |
| --- | --- |
| `aimrule_generate` | 条文/对话 → 嵌套规则图。 |
| `aimrule_parse_code` | 源码 → 还原分支与计算。 |
| `aimrule_canvas` | 读取画布，或用构造好的图替换。 |
| `aimrule_test` | 生成或运行画布测试用例。 |
| `aimrule_export` | 写四类工程产物。 |

### 存储

- 每张流程图是一个 Markdown 文件：`<workspace>/.aimrule/flows/<id>.md`。
- 文件里有人类可读摘要，文末有 `aimrule` JSON 围栏供机器读取。
- 旧的 `<id>.json` 会迁移成 `<id>.json.bak`；`.md` 解析失败时回退到 JSON
  备份，并保留 `.md.corrupt`。
- 不传项目时，用 Host 的全局工作区。

### 安装

- 把发布 tarball（`dist/aimrule-dsh-plugin-flow-<version>.tgz`）交给 DSH 插件管理器，
  或在 profile 里启用 `aimrule` bundle，然后刷新页面。
- 发布到 npm 后可直接 `npm install @aimrule/dsh-plugin-flow`。
- LibreOffice 是可选的，只在导入 PDF / 旧版 Office 时需要。
  扫描版 PDF 和图片需要 OCR。

### 开发与发布

```bash
cd aimrule
node build.mjs                 # 重新构建 client.js
node test/host-check.mjs
node test/render-check.mjs
node test/evaluate-check.mjs
```

在仓库根目录发布：

```bash
node scripts/release.mjs patch  # 升版本、构建、测试、打包、提交、打 tag
node scripts/release.mjs patch --push  # 同时推送到远端
```

界面使用 Harness 的主题 token，自动跟随亮色/暗色主题。

---

## License / 许可

**Code:** [AGPL-3.0-or-later](LICENSE). Copyright (c) 2025-2026 AimRule contributors.

**代码：** [AGPL-3.0-or-later](LICENSE)，版权所有 (c) 2025-2026 AimRule contributors。

- You may use, modify, and distribute the code, and offer it over a network.
  If you distribute a modified version or make it available as a network
  service, you must offer the complete corresponding source under
  AGPL-3.0 and keep the copyright/license notices.
- AGPL is a strong open-source copyleft license, but it does **not** forbid
  copying. It forbids turning the code into a closed-source product without
  sharing the source.
- The AimRule name and logo are **not** covered by the code license. Modified
  public forks must use a different name and logo and must not imply
  endorsement. See [TRADEMARK.md](TRADEMARK.md).
- Closed-source or commercial use needs a separate commercial license; contact
  the maintainer through the repository.
- Your flow data and exported artifacts remain yours.
- By contributing, you agree to license your contribution under
  AGPL-3.0-or-later. Maintainers who plan to sell commercial exceptions should
  require a CLA from contributors.
- This is not legal advice; consult a lawyer for your situation.

- 你可以使用、修改、分发代码，也可以通过网络提供服务。修改后分发，或作为
  网络服务提供时，必须按 AGPL-3.0 提供完整对应源码，并保留版权/许可声明。
- AGPL 是强 copyleft 开源协议，但它**不禁止复制**；它禁止的是把代码改成
  闭源产品却不公开源码。
- AimRule 名称和图标**不在**代码许可范围内。修改后的公开分支必须换名换标，
  不得暗示官方认可。见 [TRADEMARK.md](TRADEMARK.md)。
- 闭源或商业使用需单独商业许可，请通过仓库联系维护者。
- 画布数据和导出产物归你所有。
- 提交贡献即表示同意按 AGPL-3.0-or-later 授权你的贡献。计划销售商业例外
  的维护者，应要求贡献者签署 CLA。
- 本节不构成法律意见，具体情况请咨询律师。
