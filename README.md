# AimRule

AimRule is a DeepSeek Harness plugin that turns policy text, chat logs, and
source files into an editable nested rule canvas — then exports Mermaid,
pseudocode, YAML, and test cases.

AimRule 是 DeepSeek Harness 的插件：把政策条文、对话记录和源码变成可编辑的
嵌套规则画布，并导出 Mermaid、伪代码、YAML 和测试用例。

[Full bilingual manual / 完整中英说明](aimrule/README.md) ·
[License / 许可](LICENSE) · [Trademark / 商标](aimrule/TRADEMARK.md)

## Repository / 仓库结构

| Path | What it is / 说明 |
| --- | --- |
| `aimrule/` | The DSH plugin package: host, built client, shared code, tests, docs. / 插件主体，可直接安装。 |
| `aimrule/README.md` | Full bilingual manual. / 完整中英使用说明。 |
| `scripts/release.mjs` | Development release tool: bump, build, test, pack, commit, tag. Not a runtime artifact. / 发布脚本，不是打包产物。 |
| `dist/` | Generated tarball/ZIP, local only, git-ignored. / 本地打包产物，不上传。 |
| `LICENSE` | GNU AGPL-3.0 text. / AGPL-3.0 许可全文。 |
| `aimrule/NOTICE`, `aimrule/TRADEMARK.md` | Copyright and trademark policy. / 版权与商标规则。 |

> `aimrule/client.js` is committed intentionally: DSH loads it as the built
> client bundle. The packaged artifacts are the tarball/ZIP under `dist/`,
> which are git-ignored.
>
> `aimrule/client.js` 是插件运行所需的构建产物，需要提交；真正的安装包
> tarball/ZIP 在 `dist/`，已被忽略，不会上传。

## Quick start / 快速开始

1. Install `dist/aimrule-dsh-plugin-flow-<version>.tgz` through DSH's plugin manager, or
   enable the `aimrule` bundle in your profile. Published package:
   `npm install @aimrule/dsh-plugin-flow`.
   / 把 tarball 交给 DSH 插件管理器，或在 profile 里启用 `aimrule`；发布后可直接
   `npm install @aimrule/dsh-plugin-flow`。
2. Click the AimRule icon in the chat composer. / 点聊天输入框里的 AimRule 图标。
3. Read the [full manual](aimrule/README.md) for the canvas, modules, tests,
   exports, and agent tools.
   / 画布、模块、测试、导出和 Agent 工具见完整说明。

## Development / 开发

```bash
cd aimrule
node build.mjs
node test/host-check.mjs
node test/render-check.mjs
node test/evaluate-check.mjs
```

Release from the repository root / 在仓库根目录发布：

```bash
node scripts/release.mjs patch
node scripts/release.mjs patch --push
```

## License / 许可

AGPL-3.0-or-later. The code is open source; the AimRule name and logo are
covered by a separate trademark policy, so modified public forks must rebrand.
Closed-source or commercial use needs a commercial license.

代码采用 AGPL-3.0-or-later 开源；AimRule 名称和图标另按商标规则，修改后的
公开分支必须换名换标；闭源或商业使用需单独商业许可。

See [LICENSE](LICENSE) and [TRADEMARK.md](aimrule/TRADEMARK.md).
Not legal advice. / 不构成法律意见。
