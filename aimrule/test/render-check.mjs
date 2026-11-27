/**
 * Render check: mount the real AimRule page in jsdom against a stubbed host,
 * then assert the canvas, nodes, edges, and side panels appear without a crash.
 *
 * Run: node test/render-check.mjs
 */

import { build } from '/Users/kuangjixiang/node_modules/esbuild/lib/main.js'
import { JSDOM } from '/Users/kuangjixiang/node_modules/jsdom/lib/api.js'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '.build')
mkdirSync(out, { recursive: true })

await build({
  entryPoints: [join(here, 'ssr-entry.jsx')],
  outfile: join(out, 'entry.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'transform',
  jsxFactory: 'h',
  logLevel: 'warning',
})

const demo = {
  version: 1,
  project: { name: '审批规则', description: '' },
  nodes: [
    { id: 'n1', type: 'start', pos: { x: 0, y: 0 }, data: { label: '流程入口' } },
    { id: 'n2', type: 'judge', pos: { x: 320, y: 0 }, data: { label: '是否命中例外', condition: '状态 == "例外"', sourceRef: '规则 1' } },
    { id: 'm1', type: 'module', pos: { x: 640, y: 0 }, data: { label: '例外处理' } },
    { id: 'n3', type: 'calc', parentId: 'm1', pos: { x: 0, y: 0 }, data: { label: '指标', expr: '指标 = 基数 * 系数' } },
    { id: 'n4', type: 'end', pos: { x: 960, y: 0 }, data: { label: '流程结束' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', label: '' },
    { id: 'e2', source: 'n2', target: 'm1', label: '否' },
    { id: 'e3', source: 'm1', target: 'n4', label: '' },
  ],
  templates: [{ id: 't1', name: '示例模板', nodes: [], edges: [] }],
  sources: [{ id: 's1', title: '规则样本', kind: 'text', text: '状态为例外的，转人工复核。' }],
  tests: [],
  testInputs: { 基数: 100, 系数: 0.3 },
}

const dom = new JSDOM('<!doctype html><div id="root"></div>', { url: 'http://127.0.0.1:58999/', pretendToBeVisual: true })
const { window } = dom
globalThis.window = window
globalThis.document = window.document
globalThis.HTMLElement = window.HTMLElement
globalThis.Element = window.Element
globalThis.Node = window.Node
globalThis.getComputedStyle = window.getComputedStyle
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const errors = []
const originalError = console.error
console.error = (...args) => {
  const line = args.map((item) => (item && item.stack) || String(item)).join(' ')
  if (!line.includes('not wrapped in act')) errors.push(line)
  originalError(...args)
}

const calls = []
const flowList = [
  { id: 'flow-1', name: '审批规则', description: '', updatedAt: '2026-11-25T12:00:00.000Z', nodes: 4, edges: 3, modules: 1 },
  { id: 'flow-2', name: '例外处理', description: '', updatedAt: '2026-11-24T12:00:00.000Z', nodes: 3, edges: 2, modules: 1 },
]
const moduleList = [
  {
    key: 'flow-2:m9',
    flowId: 'flow-2',
    flowName: '例外处理',
    moduleId: 'm9',
    name: '指标计算',
    nodeCount: 2,
    nodes: [
      { id: 'm9', type: 'module', parentId: null, pos: { x: 0, y: 0 }, data: { label: '指标计算' } },
      { id: 'c9', type: 'calc', parentId: 'm9', pos: { x: 0, y: 80 }, data: { label: '指标', expr: '指标 = 基数 * 系数' } },
    ],
    edges: [],
  },
]
window.fetch = async (path, options) => {
  const url = String(path)
  calls.push({ path: url, options })
  if (url.includes('/aimrule/api/flows/delete')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, flows: [flowList[0]] }) }
  }
  if (url.includes('/aimrule/api/flows') && options && options.method === 'POST') {
    return { ok: true, status: 200, json: async () => ({ ok: true, flow: 'flow-2', flows: flowList }) }
  }
  if (url.includes('/aimrule/api/flows')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, flows: flowList }) }
  }
  if (url.includes('/aimrule/api/modules/detect')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        candidates: [
          {
            name: '例外处理',
            reason: '两个流程图都出现同一组判断与例外动作',
            occurrences: [
              { flowId: 'flow-2', flowName: '例外处理', nodeIds: ['m9', 'c9'] },
              { flowId: 'flow-1', flowName: '审批规则', nodeIds: ['m1', 'n3'] },
            ],
          },
        ],
      }),
    }
  }
  if (url.includes('/aimrule/api/modules/extract')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, flowId: 'flow-2', moduleId: 'm_new' }) }
  }
  if (url.includes('/aimrule/api/modules')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, modules: moduleList }) }
  }
  if (url.includes('/aimrule/api/workspace/tree')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        entries: [
          { path: 'docs', name: 'docs', type: 'dir' },
          { path: 'docs/policy.md', name: 'policy.md', type: 'file', size: 128 },
        ],
      }),
    }
  }
  if (url.includes('/aimrule/api/tests/generate')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        cases: [{ id: 'ai_1', name: 'AI 生成用例', rule: 'n2', inputs: { 状态: '例外' }, expect: {} }],
        defaults: { 状态: '例外', 基数: 100, 系数: 0.3 },
        notes: [],
      }),
    }
  }
  if (url.includes('/aimrule/api/state') && (!options || options.method !== 'PUT')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, state: demo, flow: 'flow-1', flows: flowList }) }
  }
  if (url.includes('/aimrule/api/state')) {
    return { ok: true, status: 200, json: async () => ({ ok: true, flows: flowList }) }
  }
  if (url.includes('/aimrule/api/generate')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ ok: true, state: demo, flow: 'flow-1', flows: flowList, attempts: 1, notes: [] }),
    }
  }
  if (url.includes('/aimrule/api/transcript')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        text: '【用户】\n当状态为例外时转人工复核\n\n【助手】\n明白，会保留例外分支。',
        messages: 2,
        chars: 34,
        items: [
          { role: '用户', text: '当状态为例外时转人工复核', seq: 1, time: 1795581000000 },
          { role: '助手', text: '明白，会保留例外分支。', seq: 2, time: 1795581001000 },
        ],
      }),
    }
  }
  return { ok: true, status: 200, json: async () => ({ ok: true, sessionId: 'sess-1' }) }
}
globalThis.fetch = window.fetch

const React = (await import('/Users/kuangjixiang/node_modules/react/index.js')).default
const { createRoot } = await import('/Users/kuangjixiang/node_modules/react-dom/client.js')
const ReactDOM = (await import('/Users/kuangjixiang/node_modules/react-dom/index.js')).default
const { mount, mountLauncher } = await import(pathToFileURL(join(out, 'entry.mjs')).href)
const Page = mount(React)

const container = window.document.getElementById('root')
const root = createRoot(container)
const useSessions = (selector) =>
  selector({
    byId: {
      'sess-1': { id: 'sess-1', updatedAt: 200, cwd: '/tmp/proj', title: '审批规则会话', running: false },
      'sess-0': { id: 'sess-0', updatedAt: 100, cwd: '/tmp/old', running: false },
    },
  })
const useWorkspaces = (selector) =>
  selector({
    items: [
      { workspaceId: 'w-other', path: '/tmp/old', title: '旧项目' },
      { workspaceId: 'w-proj', path: '/tmp/proj', title: '审批项目' },
    ],
  })
await React.act(async () => {
  root.render(React.createElement(Page, { useSessions, useWorkspaces, readCurrentSession: () => 'sess-1' }))
})
await React.act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 120))
})

const html = container.innerHTML
const checks = [
  ['page root', html.includes('aimrule-root')],
  ['project title', html.includes('审批规则')],
  ['judge node', html.includes('是否命中例外')],
  ['module node', html.includes('例外处理')],
  ['edge labels', html.includes('aimrule-edge-label')],
  ['top toolbar', html.includes('aimrule-top-tools')],
  ['composer', html.includes('aimrule-composer')],
  ['flow switcher', html.includes('aimrule-title-more')],
  ['sync status', html.includes('已同步')],
  ['style tag', html.includes('aimrule-node{')],
]

let failed = 0

/* ----------------------------------------------------- project selection */

const projectTrigger = container.querySelector('.aimrule-workspace-trigger')
const projectValue = projectTrigger ? projectTrigger.textContent : ''
console.log(`${projectValue.includes('审批项目') ? 'PASS' : 'FAIL'} project defaults to the most recent session workspace`)
if (!projectValue.includes('审批项目')) failed += 1
const projectScopedCall = calls.some((call) => call.path.includes('/aimrule/api/state?project=' + encodeURIComponent('/tmp/proj')))
console.log(`${projectScopedCall ? 'PASS' : 'FAIL'} state is requested per project`)
if (!projectScopedCall) failed += 1

const findButton = (label) => [...container.querySelectorAll('button')].find((button) => (button.textContent || '').includes(label))

/* ------------------------------------------------- interaction: composer */

const composer = container.querySelector('.aimrule-composer')
console.log(`${composer ? 'PASS' : 'FAIL'} composer is present on the canvas`)
if (!composer) failed += 1

await React.act(async () => {
  const add = container.querySelector('.aimrule-composer-add')
  if (!add) throw new Error('composer add button missing')
  add.click()
})
await React.act(async () => {
  findButton('对话记录').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const checkedItems = () => [...container.querySelectorAll('.aimrule-picker-row-chat input')].filter((input) => input.checked).length
const convoItems = container.querySelectorAll('.aimrule-picker-row-chat').length
console.log(`${convoItems === 2 && checkedItems() === 2 ? 'PASS' : 'FAIL'} conversation references load and select all by default`)
if (!(convoItems === 2 && checkedItems() === 2)) failed += 1

const transcriptCall = calls.find((call) => call.path.includes('/aimrule/api/transcript'))
let transcriptPayload = null
try {
  transcriptPayload = transcriptCall ? JSON.parse(transcriptCall.options.body) : null
} catch {
  transcriptPayload = null
}
const transcriptScoped = Boolean(transcriptPayload && transcriptPayload.sessionId === 'sess-1')
console.log(`${transcriptScoped ? 'PASS' : 'FAIL'} transcript requests the open session`)
if (!transcriptScoped) failed += 1

await React.act(async () => {
  findButton('清空').click()
})
console.log(`${checkedItems() === 0 ? 'PASS' : 'FAIL'} conversation references can be cleared`)
if (checkedItems() !== 0) failed += 1
await React.act(async () => {
  findButton('全选').click()
})
console.log(`${checkedItems() === 2 ? 'PASS' : 'FAIL'} conversation references can select all`)
if (checkedItems() !== 2) failed += 1
await React.act(async () => {
  findButton('完成').click()
})
const chatChip = [...container.querySelectorAll('.aimrule-composer-chip')].some((chip) => (chip.textContent || '').includes('对话 2 条'))
console.log(`${chatChip ? 'PASS' : 'FAIL'} selected conversation becomes a composer chip`)
if (!chatChip) failed += 1

const composerInput = container.querySelector('.aimrule-composer-input')
const setValue = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
await React.act(async () => {
  setValue.call(composerInput, '只保留主流程')
  composerInput.dispatchEvent(new window.Event('input', { bubbles: true }))
})
await React.act(async () => {
  container.querySelector('.aimrule-composer-send').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const generateCall = calls.find((call) => call.path.includes('/aimrule/api/generate'))
let generatePayload = null
try {
  generatePayload = generateCall ? JSON.parse(generateCall.options.body) : null
} catch {
  generatePayload = null
}
const generated = Boolean(
  generatePayload &&
    generatePayload.text.includes('当状态为例外时转人工复核') &&
    generatePayload.instruction === '只保留主流程' &&
    generatePayload.mode === 'merge',
)
console.log(`${generated ? 'PASS' : 'FAIL'} composer sends chat source plus the typed requirement`)
if (!generated) failed += 1

/* ---------------------------------------------- composer node/file refs */

await React.act(async () => {
  container.querySelector('.aimrule-composer-add').click()
})
await React.act(async () => {
  findButton('流程图节点').click()
  await new Promise((resolve) => setTimeout(resolve, 20))
})
const nodeRows = container.querySelectorAll('.aimrule-picker-row').length
await React.act(async () => {
  container.querySelector('.aimrule-picker-row input').click()
})
await React.act(async () => {
  findButton('完成').click()
})
const nodeChip = [...container.querySelectorAll('.aimrule-composer-chip')].some((chip) => (chip.textContent || '').includes('@'))
console.log(`${nodeRows >= 4 && nodeChip ? 'PASS' : 'FAIL'} composer references flowchart nodes`)
if (!(nodeRows >= 4 && nodeChip)) failed += 1

await React.act(async () => {
  container.querySelector('.aimrule-composer-add').click()
})
await React.act(async () => {
  findButton('工作区文件').click()
  await new Promise((resolve) => setTimeout(resolve, 20))
})
const workspaceRows = container.querySelectorAll('.aimrule-tree-row').length
await React.act(async () => {
  const inputs = [...container.querySelectorAll('.aimrule-tree-row input')]
  if (inputs[1]) inputs[1].click()
})
await React.act(async () => {
  findButton('完成').click()
})
const pathChip = [...container.querySelectorAll('.aimrule-composer-chip')].some((chip) => (chip.textContent || '').includes('docs/policy.md'))
console.log(`${workspaceRows === 2 && pathChip ? 'PASS' : 'FAIL'} composer references workspace files`)
if (!(workspaceRows === 2 && pathChip)) failed += 1

await React.act(async () => {
  container.querySelector('.aimrule-composer-add').click()
})
await React.act(async () => {
  findButton('工作区文件').click()
  await new Promise((resolve) => setTimeout(resolve, 20))
})
await React.act(async () => {
  const folder = container.querySelector('.aimrule-tree-row input')
  if (folder) folder.click()
})
await React.act(async () => {
  findButton('完成').click()
})
const folderChip = [...container.querySelectorAll('.aimrule-composer-chip')].some((chip) => (chip.textContent || '').includes('docs'))
console.log(`${folderChip ? 'PASS' : 'FAIL'} composer references whole workspace folders`)
if (!folderChip) failed += 1

/* ---------------------------------------------------- canvas pan + menu */

const stage = container.querySelector('.aimrule-stage')
const worldTransform = () => container.querySelector('.aimrule-world').style.transform
await React.act(async () => {
  container.querySelector('.aimrule-tool-pan').click()
})
const beforePan = worldTransform()
await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
  window.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 60, clientY: 50 }))
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
})
const panned = beforePan !== worldTransform()
await React.act(async () => {
  container.querySelector('.aimrule-tool-pan').click()
})
console.log(`${panned ? 'PASS' : 'FAIL'} hand tool pans the canvas`)
if (!panned) failed += 1

await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 120, clientY: 120 }))
})
const canvasMenu = container.querySelector('.aimrule-canvas-menu')
const nodesBeforeAdd = container.querySelectorAll('[data-node-id]').length
await React.act(async () => {
  const action = [...(canvasMenu ? canvasMenu.querySelectorAll('button') : [])].find((button) => (button.textContent || '').trim() === '动作')
  if (action) action.click()
})
const addedNode = container.querySelectorAll('[data-node-id]').length === nodesBeforeAdd + 1 && !container.querySelector('.aimrule-canvas-menu')
console.log(`${canvasMenu && addedNode ? 'PASS' : 'FAIL'} blank context menu creates a node`)
if (!(canvasMenu && addedNode)) failed += 1

await React.act(async () => {
  const card = container.querySelector('[data-node-id="n1"]')
  card.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', metaKey: true, bubbles: true }))
})
await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 300, clientY: 300 }))
})
const nodesBeforePaste = container.querySelectorAll('[data-node-id]').length
await React.act(async () => {
  const paste = [...container.querySelectorAll('.aimrule-canvas-menu button')].find((button) => (button.textContent || '').includes('粘贴'))
  if (paste) paste.click()
})
const pastedNode = container.querySelectorAll('[data-node-id]').length === nodesBeforePaste + 1
console.log(`${pastedNode ? 'PASS' : 'FAIL'} copied nodes can be pasted from the blank menu`)
if (!pastedNode) failed += 1

/* ------------------------------------------------ selection + node menu */

await React.act(async () => {
  const card = container.querySelector('[data-node-id="n2"]')
  if (!card) throw new Error('judge card not found')
  card.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }))
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
})
const inspectorVisible = Boolean(container.querySelector('.aimrule-inspector'))
const composerVisible = Boolean(container.querySelector('.aimrule-composer'))
console.log(`${inspectorVisible && composerVisible ? 'PASS' : 'FAIL'} selecting a node keeps the composer and opens the inspector`)
if (!(inspectorVisible && composerVisible)) failed += 1

const nudgedBefore = parseFloat(container.querySelector('[data-node-id="n2"]').style.left)
await React.act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
})
const nudgedAfter = parseFloat(container.querySelector('[data-node-id="n2"]').style.left)
console.log(`${nudgedAfter === nudgedBefore + 1 ? 'PASS' : 'FAIL'} arrow keys nudge the selected node`)
if (nudgedAfter !== nudgedBefore + 1) failed += 1

await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 1200, clientY: 700 }))
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
})
await React.act(async () => {
  const card = container.querySelector('[data-node-id="n2"]')
  card.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 700, clientY: 300 }))
})
const nodeMenu = container.querySelector('.aimrule-node-menu')
const noInspector = !container.querySelector('.aimrule-inspector')
const menuText = nodeMenu ? nodeMenu.textContent || '' : ''
const hasMenuItems = ['复制', '添加到对话框', '合并模块'].every((label) => menuText.includes(label))
const mergeDisabled = Boolean(nodeMenu && [...nodeMenu.querySelectorAll('button')].find((button) => (button.textContent || '').includes('合并模块') || button.disabled))
await React.act(async () => {
  const add = nodeMenu ? [...nodeMenu.querySelectorAll('button')].find((button) => (button.textContent || '').includes('添加到对话框')) : null
  if (add) add.click()
})
const nodeToComposer = [...container.querySelectorAll('.aimrule-composer-chip')].some((chip) => (chip.textContent || '').includes('是否命中例外'))
console.log(`${nodeMenu && noInspector && hasMenuItems ? 'PASS' : 'FAIL'} node right-click shows copy/add/merge without node details`)
if (!(nodeMenu && noInspector && hasMenuItems)) failed += 1
console.log(`${nodeToComposer ? 'PASS' : 'FAIL'} node action adds the node to the composer`)
if (!nodeToComposer) failed += 1

await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 0, clientY: 0 }))
  window.dispatchEvent(new window.MouseEvent('mousemove', { bubbles: true, clientX: 1400, clientY: 400 }))
  window.dispatchEvent(new window.MouseEvent('mouseup', { bubbles: true }))
})
const marqueeSelected = container.querySelectorAll('.aimrule-node[data-selected="true"]').length
const inspectorCount = container.querySelector('.aimrule-inspector h3')
await React.act(async () => {
  const card = container.querySelector('[data-node-id="n2"]')
  card.dispatchEvent(new window.MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2, clientX: 700, clientY: 300 }))
})
const multiMenu = container.querySelector('.aimrule-node-menu')
const multiTitle = multiMenu ? multiMenu.querySelector('.aimrule-canvas-menu-title').textContent : ''
const mergeEnabled = Boolean(multiMenu && [...multiMenu.querySelectorAll('button')].find((button) => (button.textContent || '').includes('合并模块') && !button.disabled))

console.log(`${marqueeSelected >= 2 && inspectorCount && inspectorCount.textContent.includes('个节点') ? 'PASS' : 'FAIL'} marquee selects multiple nodes`)
if (!(marqueeSelected >= 2 && inspectorCount && inspectorCount.textContent.includes('个节点'))) failed += 1
console.log(`${multiTitle.includes('个节点') && mergeEnabled ? 'PASS' : 'FAIL'} multi-selection menu enables merge`)
if (!(multiTitle.includes('个节点') && mergeEnabled)) failed += 1

await React.act(async () => {
  const mask = container.querySelector('.aimrule-flow-mask')
  if (mask) mask.click()
})
await React.act(async () => {
  stage.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true, clientX: 900, clientY: 700 }))
})
const doubleClickMenu = container.querySelector('.aimrule-canvas-menu')
const doubleClickTitle = doubleClickMenu ? doubleClickMenu.querySelector('.aimrule-canvas-menu-title') : null
const doubleClickOpened = Boolean(doubleClickTitle && doubleClickTitle.textContent.includes('新建节点'))
await React.act(async () => {
  const mask = container.querySelector('.aimrule-flow-mask')
  if (mask) mask.click()
})
console.log(`${doubleClickOpened ? 'PASS' : 'FAIL'} double-clicking empty canvas opens the node menu`)
if (!doubleClickOpened) failed += 1
await React.act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})

for (const [name, ok] of checks) {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`)
}
console.log(`nodes rendered: ${(html.match(/data-node-id=/g) || []).length}`)
console.log(`edges rendered: ${(html.match(/data-edge-id=/g) || []).length}`)
if (errors.length > 0) {
  console.log('console.error output:')
  for (const line of errors.slice(0, 8)) console.log('  ' + line.slice(0, 400))
}

/* ---------------------------------------------------------- test cases */

await React.act(async () => {
  findButton('测试').click()
})
const testsModal = container.innerHTML.includes('测试验证')
console.log(`${testsModal ? 'PASS' : 'FAIL'} test modal opens`)
if (!testsModal) failed += 1

await React.act(async () => {
  findButton('✦ AI 生成').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const aiCases = container.querySelectorAll('.aimrule-case').length
const aiCall = calls.find((call) => call.path.includes('/aimrule/api/tests/generate'))
let aiPayload = null
try {
  aiPayload = aiCall ? JSON.parse(aiCall.options.body) : null
} catch {
  aiPayload = null
}
const aiGenerated = Boolean(aiCases === 1 && aiPayload && Array.isArray(aiPayload.doc && aiPayload.doc.nodes) && aiPayload.flow === 'flow-1')
console.log(`${aiGenerated ? 'PASS' : 'FAIL'} AI generates test cases from the current canvas`)
if (!aiGenerated) failed += 1

await React.act(async () => {
  findButton('从画布生成用例').click()
})
const caseCount = container.querySelectorAll('.aimrule-case').length
console.log(`${caseCount === 2 ? 'PASS' : 'FAIL'} generates one case pair (${caseCount})`)
if (caseCount !== 2) failed += 1

await React.act(async () => {
  findButton('全部运行').click()
  await new Promise((resolve) => setTimeout(resolve, 820))
})
const badges = [...container.querySelectorAll('.aimrule-badge')].map((node) => node.textContent)
console.log(`case statuses: ${JSON.stringify(badges)}`)
const ran = badges.length === 2 && badges.every((text) => text === '跑通')
console.log(`${ran ? 'PASS' : 'FAIL'} runs every generated case`)
if (!ran) failed += 1

const persisted = calls.some(
  (call) => call.options && call.options.method === 'PUT' && String(call.options.body).includes('"tests"'),
)
console.log(`${persisted ? 'PASS' : 'FAIL'} test cases persist into the document`)
if (!persisted) failed += 1

const casesBeforeDelete = container.querySelectorAll('.aimrule-case').length
await React.act(async () => {
  const remove = container.querySelector('.aimrule-case-delete')
  if (remove) remove.click()
})
const casesAfterDelete = container.querySelectorAll('.aimrule-case').length
console.log(`${casesBeforeDelete === 2 && casesAfterDelete === 1 ? 'PASS' : 'FAIL'} a test case can be deleted`)
if (!(casesBeforeDelete === 2 && casesAfterDelete === 1)) failed += 1

/* ------------------------------------------------- flows + module reuse */

const flowTrigger = container.querySelector('.aimrule-title-more')
await React.act(async () => {
  flowTrigger.click()
})
const flowNames = [...container.querySelectorAll('.aimrule-flow-option-name')].map((node) => node.textContent)
const activeFlow = container.querySelector('.aimrule-flow-option[data-active=true] .aimrule-flow-option-name')
const flowScopedCall = calls.some((call) => call.path.includes('/aimrule/api/state') && call.path.includes('flow=flow-1'))
console.log(`${flowNames.length === 2 && flowNames.includes('审批规则') && activeFlow && activeFlow.textContent === '审批规则' ? 'PASS' : 'FAIL'} flow menu lists the workspace flows`)
if (!(flowNames.length === 2 && flowNames.includes('审批规则') && activeFlow && activeFlow.textContent === '审批规则')) failed += 1
console.log(`${flowScopedCall ? 'PASS' : 'FAIL'} state is requested per flow`)
if (!flowScopedCall) failed += 1
await React.act(async () => {
  const mask = container.querySelector('.aimrule-flow-mask')
  if (mask) mask.click()
})

await React.act(async () => {
  findButton('⋯').click()
})
await React.act(async () => {
  findButton('模块库').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const moduleRows = container.querySelectorAll('.aimrule-module-row').length
const moduleRowButtons = container.querySelectorAll('.aimrule-module-row button').length
console.log(`${moduleRows === 1 && moduleRowButtons === 0 ? 'PASS' : 'FAIL'} full module library is management-only`)
if (!(moduleRows === 1 && moduleRowButtons === 0)) failed += 1
await React.act(async () => {
  const close = container.querySelector('.aimrule-modal-head .aimrule-btn')
  if (close) close.click()
})

/* ---------------------------------------------- quick module picker */

await React.act(async () => {
  container.querySelector('.aimrule-tool-modules').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const quickPanel = Boolean(container.querySelector('.aimrule-module-popover'))
const quickRows = container.querySelectorAll('.aimrule-module-pick').length
const quickDetail = container.querySelector('.aimrule-module-detail')
const quickPreview = Boolean(quickDetail && (quickDetail.textContent || '').includes('指标'))
const moduleSearch = container.querySelector('.aimrule-module-popover input')
const setSearchValue = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
await React.act(async () => {
  setSearchValue.call(moduleSearch, '基数')
  moduleSearch.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 20))
})
const contentRows = container.querySelectorAll('.aimrule-module-pick').length
const contentDetail = container.querySelector('.aimrule-module-detail')
const contentFound = contentRows === 1 && contentDetail && (contentDetail.textContent || '').includes('基数')
console.log(`${quickPreview && contentFound ? 'PASS' : 'FAIL'} module picker previews and searches node content`)
if (!(quickPreview && contentFound)) failed += 1
await React.act(async () => {
  setSearchValue.call(moduleSearch, '')
  moduleSearch.dispatchEvent(new window.Event('input', { bubbles: true }))
  await new Promise((resolve) => setTimeout(resolve, 20))
})
const nodesBeforeQuick = container.querySelectorAll('[data-node-id]').length
await React.act(async () => {
  const row = container.querySelector('.aimrule-module-pick')
  if (row) row.click()
  await new Promise((resolve) => setTimeout(resolve, 30))
})
const quickInserted = container.querySelectorAll('[data-node-id]').length === nodesBeforeQuick + 1 && Boolean(container.querySelector('.aimrule-module-popover'))
const recentGroup = [...container.querySelectorAll('.aimrule-module-group')].some((group) => (group.textContent || '').includes('最近使用'))
console.log(`${recentGroup ? 'PASS' : 'FAIL'} inserted module appears under recent`)
if (!recentGroup) failed += 1
const quickDragRow = container.querySelector('.aimrule-module-pick')
const quickDragData = { effectAllowed: '', dropEffect: '', setData() {}, getData: () => 'flow-2:m9' }
const quickDragStart = new window.Event('dragstart', { bubbles: true, cancelable: true })
Object.defineProperty(quickDragStart, 'dataTransfer', { value: quickDragData })
await React.act(async () => {
  quickDragRow.dispatchEvent(quickDragStart)
})
const nodesBeforeQuickDrag = container.querySelectorAll('[data-node-id]').length
await React.act(async () => {
  const drop = new window.MouseEvent('drop', { bubbles: true, cancelable: true, clientX: 600, clientY: 400 })
  Object.defineProperty(drop, 'dataTransfer', { value: quickDragData })
  stage.dispatchEvent(drop)
  await new Promise((resolve) => setTimeout(resolve, 30))
})
const quickDropped = container.querySelectorAll('[data-node-id]').length === nodesBeforeQuickDrag + 1 && Boolean(container.querySelector('.aimrule-module-popover'))
await React.act(async () => {
  const close = container.querySelector('.aimrule-module-popover-head .aimrule-btn')
  if (close) close.click()
})
const quickClosed = !container.querySelector('.aimrule-module-popover')
console.log(`${quickPanel && quickRows > 0 && quickInserted && quickDropped && quickClosed ? 'PASS' : 'FAIL'} quick module picker inserts and drops modules`)
if (!(quickPanel && quickRows > 0 && quickInserted && quickDropped && quickClosed)) failed += 1

/* ------------------------------------------- module breadcrumb + escape */

await React.act(async () => {
  const moduleCard = container.querySelector('[data-node-id="m1"]')
  moduleCard.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }))
})
const crumbs = Boolean(container.querySelector('.aimrule-canvas-crumbs'))
const home = container.querySelector('.aimrule-crumb-home')
await React.act(async () => {
  if (home) home.click()
})
const backAtRoot = !container.querySelector('.aimrule-canvas-crumbs')
console.log(`${crumbs && backAtRoot ? 'PASS' : 'FAIL'} breadcrumb returns from a module to the root canvas`)
if (!(crumbs && backAtRoot)) failed += 1

await React.act(async () => {
  const moduleCard = container.querySelector('[data-node-id="m1"]')
  moduleCard.dispatchEvent(new window.MouseEvent('dblclick', { bubbles: true }))
})
await React.act(async () => {
  window.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
const escapeAtRoot = !container.querySelector('.aimrule-canvas-crumbs')
console.log(`${escapeAtRoot ? 'PASS' : 'FAIL'} Escape goes up one module level`)
if (!escapeAtRoot) failed += 1

/* ---------------------------------------------- AI reuse detection */

await React.act(async () => {
  findButton('⋯').click()
})
await React.act(async () => {
  findButton('模块库').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
await React.act(async () => {
  findButton('AI 检测复用').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const candidateRows = container.querySelectorAll('.aimrule-candidate').length
console.log(`${candidateRows === 1 ? 'PASS' : 'FAIL'} AI detection lists reusable candidates`)
if (candidateRows !== 1) failed += 1

await React.act(async () => {
  findButton('抽为模块').click()
  await new Promise((resolve) => setTimeout(resolve, 40))
})
const extractCall = calls.find((call) => call.path.includes('/aimrule/api/modules/extract'))
let extractPayload = null
try {
  extractPayload = extractCall ? JSON.parse(extractCall.options.body) : null
} catch {
  extractPayload = null
}
const extracted = Boolean(extractPayload && extractPayload.flowId === 'flow-2' && extractPayload.nodeIds.length === 2 && extractPayload.name === '例外处理')
console.log(`${extracted ? 'PASS' : 'FAIL'} extraction posts the selected candidate nodes`)
if (!extracted) failed += 1
const candidatesLeft = container.querySelectorAll('.aimrule-candidate').length
console.log(`${candidatesLeft === 0 ? 'PASS' : 'FAIL'} extracted candidate leaves the list`)
if (candidatesLeft !== 0) failed += 1

/* ------------------------------------------------ composer launcher */

const Launcher = mountLauncher(React, ReactDOM)
const launcherContainer = window.document.createElement('div')
window.document.body.appendChild(launcherContainer)
const launcherRoot = createRoot(launcherContainer)
const useLauncherWorkspaces = (selector) =>
  selector({
    items: [{ workspaceId: 'w-proj', path: '/tmp/proj', title: '审批项目', sessionIds: ['sess-1'] }],
  })
await React.act(async () => {
  launcherRoot.render(
    React.createElement(Launcher, {
      sessionId: 'sess-1',
      useSessions,
      useWorkspaces: useLauncherWorkspaces,
    }),
  )
})
const launchButton = launcherContainer.querySelector('.aimrule-launch-button')
await React.act(async () => {
  if (launchButton) launchButton.click()
})
await React.act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 160))
})
const launcher = window.document.querySelector('.aimrule-launcher')
const launcherPage = launcher ? launcher.querySelector('.aimrule-root') : null
const launcherTitle = launcher ? launcher.querySelector('.aimrule-launcher-heading') : null
const launcherProjectCall = calls.some(
  (call) => call.path.includes('/aimrule/api/state') && call.path.includes('project=%2Ftmp%2Fproj'),
)
const launcherOpened = Boolean(
  launcher &&
    launcherPage &&
    launcherTitle &&
    launcherTitle.textContent.includes('流程图设计') &&
    launcherTitle.textContent.includes('审批项目') &&
    launcherProjectCall,
)
await React.act(async () => {
  const close = window.document.querySelector('.aimrule-launcher-close')
  if (close) close.click()
})
const launcherClosed = !window.document.querySelector('.aimrule-launcher')
console.log(`${launcherOpened && launcherClosed ? 'PASS' : 'FAIL'} composer launcher opens bound to the session workspace`)
if (!(launcherOpened && launcherClosed)) failed += 1
launcherRoot.unmount()
launcherContainer.remove()

root.unmount()
process.exit(failed === 0 && errors.length === 0 ? 0 : 1)
