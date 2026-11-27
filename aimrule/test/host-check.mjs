/**
 * Host check: mount the AimRule host half against a stubbed context and
 * exercise the conversation transcript, workspace flow storage, and module
 * catalog.
 *
 * Run: node test/host-check.mjs
 */

import { strict as assert } from 'node:assert'
import { mkdtemp, mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'
import { apply, findCycle, graphIssues } from '../index.js'

let route
let llmEnabled = true
const llmResponses = []
const llm = {
  stream() {
    const text = llmResponses.shift() || ''
    return (async function* () {
      yield { type: 'text-delta', text }
      yield { type: 'finish', reason: { kind: 'stop' } }
    })()
  },
}
const ctx = {
  get(service) {
    if (service === 'llm') return llmEnabled ? llm : undefined
    if (service === 'agentDefaultModel') return { currentSelection: () => ({ provider: 'mock', model: 'mock' }) }
    if (service === 'workingDirectory') {
      return { defaultDirectory: '/tmp', get: () => '/tmp' }
    }
    if (service === 'sessionQuery') {
      return {
        readSession: async (id) => {
          assert.equal(id, 'live-session')
          return {
            events: [
              { type: 'user/message', data: { source: { kind: 'runtime-context' }, content: [{ type: 'text', text: 'runtime noise' }] } },
              { type: 'user/message', data: { source: { kind: 'user' }, content: [{ type: 'text', text: '状态为例外时转人工复核' }] } },
              { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '明白，会保留例外分支。' }, { type: 'reasoning', text: 'ignore me' }] } } },
              { type: 'tool/result', data: { message: { content: [{ type: 'text', text: 'tool noise' }] } } },
            ],
          }
        },
      }
    }
    return undefined
  },
  webServer: {
    register(registered) {
      route = registered
      return { dispose() {} }
    },
  },
  effect(callback) {
    return callback()
  },
  tools: { register() {} },
}

apply(ctx, { stateDir: '/tmp/aimrule-host-check' })
assert.ok(route, 'the API route is registered')
assert.equal(route.path, '/aimrule/api')

function fakeRequest(body, url, method = 'POST') {
  const request = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  request.method = method
  request.url = url
  request.headers = { host: '127.0.0.1:59999', origin: 'http://127.0.0.1:59999' }
  return request
}

function fakeResponse() {
  return {
    status: 0,
    body: '',
    writeHead(status) {
      this.status = status
    },
    end(body) {
      this.body = body
    },
  }
}

async function call(body, url, method = 'POST') {
  const response = fakeResponse()
  await route.handler(fakeRequest(body, url, method), response)
  return { status: response.status, data: JSON.parse(response.body) }
}

function canvas(name, extraNodes = [], extraEdges = []) {
  return {
    version: 1,
    project: { name, description: '' },
    nodes: [
      { id: 'n1', type: 'start', pos: { x: 0, y: 0 }, data: { label: '开始' } },
      { id: 'n2', type: 'end', pos: { x: 320, y: 0 }, data: { label: '结束' } },
      ...extraNodes,
    ],
    edges: [{ id: 'e1', source: 'n1', target: 'n2', label: '' }, ...extraEdges],
    templates: [],
    sources: [],
  }
}

/* --------------------------------------------------------- transcript */

const transcript = await call({ sessionId: 'live-session', maxChars: 4000 }, '/aimrule/api/transcript')
assert.equal(transcript.status, 200)
assert.match(transcript.data.text, /状态为例外时转人工复核/)
assert.match(transcript.data.text, /明白，会保留例外分支/)
assert.doesNotMatch(transcript.data.text, /runtime noise|tool noise|ignore me/)
assert.equal(transcript.data.messages, 2)
console.log('PASS transcript keeps user/assistant text and drops system noise')

/* ---------------------------------------------------------- cycle check */

const cycleNodes = [
  { id: 's', type: 'start', data: { label: '开始' } },
  { id: 'a', type: 'action', data: { label: '处理' } },
  { id: 'b', type: 'action', data: { label: '回退' } },
]
const cycleEdges = [
  { id: 'e1', source: 's', target: 'a' },
  { id: 'e2', source: 'a', target: 'b' },
  { id: 'e3', source: 'b', target: 'a' },
]
const cycle = findCycle(cycleNodes, cycleEdges)
assert.ok(cycle && cycle.includes('a') && cycle.includes('b'))
assert.ok(!graphIssues(cycleNodes, cycleEdges).some((issue) => issue.includes('循环')))
console.log('PASS cycle graphs pass structural validation')

/* --------------------------------------------------------- llm endpoints */

const llmWorkspace = await mkdtemp(join(tmpdir(), 'aimrule-llm-'))
const llmQuery = `?project=${encodeURIComponent(llmWorkspace)}`
const llmFlow = (await call({ project: llmWorkspace, name: 'LLM 测试' }, '/aimrule/api/flows')).data.flow
const aiDoc = {
  version: 1,
  project: { name: 'AI 测试' },
  nodes: [
    { id: 's', type: 'start', pos: { x: 0, y: 0 }, data: { label: '开始' } },
    { id: 'j', type: 'judge', pos: { x: 320, y: 0 }, data: { label: '是否例外', condition: '状态 == "例外"' } },
    { id: 'a', type: 'action', pos: { x: 640, y: 0 }, data: { label: '复核' } },
  ],
  edges: [
    { id: 'e1', source: 's', target: 'j' },
    { id: 'e2', source: 'j', target: 'a', label: '是' },
  ],
}
llmResponses.push(JSON.stringify({
  defaults: { 基数: 100 },
  cases: [
    { id: 'c1', name: '例外', rule: 'j', inputs: { 状态: '例外', bad: { x: 1 } }, expect: { 指标: 30 } },
    { id: 'c2', name: '未知规则', rule: 'missing', inputs: {}, expect: {} },
  ],
  notes: ['模型备注'],
}))
const aiTests = await call({ project: llmWorkspace, flow: llmFlow, doc: aiDoc }, '/aimrule/api/tests/generate')
assert.equal(aiTests.status, 200)
assert.equal(aiTests.data.cases.length, 2)
assert.equal(aiTests.data.cases[0].rule, 'j')
assert.equal(aiTests.data.cases[0].inputs.bad, undefined)
assert.equal(aiTests.data.cases[1].rule, '')
assert.equal(aiTests.data.defaults.基数, 100)
assert.deepEqual(aiTests.data.notes, ['模型备注'])
console.log('PASS LLM test generation sanitizes cases and rule ids')

llmResponses.push(JSON.stringify({
  project: { name: '循环流程' },
  nodes: [
    { id: 'n1', type: 'start', data: { label: '开始' } },
    { id: 'n2', type: 'action', data: { label: '处理' } },
    { id: 'n3', type: 'action', data: { label: '回退' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n2' },
  ],
}))
const generated = await call({ text: '状态为例外时循环复核，直到通过为止。', project: llmWorkspace, flow: llmFlow }, '/aimrule/api/generate')
assert.equal(generated.status, 200)
assert.ok(generated.data.notes.some((note) => note.includes('循环流程')))
const generatedState = (await call(undefined, `/aimrule/api/state${llmQuery}&flow=${llmFlow}`, 'GET')).data.state
assert.equal(generatedState.project.name, '循环流程')
assert.equal(generatedState.nodes.length, 3)
console.log('PASS LLM extraction accepts cycles and notes them')

llmResponses.push('not json', JSON.stringify({ cases: [{ id: 'retry', name: '重试用例', rule: 's', inputs: {}, expect: {} }], defaults: {} }))
const retried = await call({ project: llmWorkspace, flow: llmFlow, doc: aiDoc }, '/aimrule/api/tests/generate')
assert.equal(retried.status, 200)
assert.equal(retried.data.attempts, 2)
assert.equal(retried.data.cases[0].name, '重试用例')
console.log('PASS LLM retries after invalid JSON')

llmResponses.push('not json', 'not json', 'not json')
const exhausted = await call({ project: llmWorkspace, flow: llmFlow, doc: aiDoc }, '/aimrule/api/tests/generate')
assert.equal(exhausted.status, 500)
assert.match(exhausted.data.error, /连续 3 次/)
console.log('PASS LLM reports exhausted repairs')

llmEnabled = false
const unavailable = await call({ project: llmWorkspace, flow: llmFlow, doc: aiDoc }, '/aimrule/api/tests/generate')
assert.equal(unavailable.status, 503)
assert.equal(unavailable.data.code, 'llm_unavailable')
llmEnabled = true
console.log('PASS LLM reports an unavailable model')

/* ------------------------------------------------------------- ingest */

const markdown = Buffer.from('# 审批规则\n状态为例外的，转人工复核。', 'utf8').toString('base64')
const ingestedText = await call({ files: [{ name: 'policy.md', data: markdown }] }, '/aimrule/api/ingest')
assert.equal(ingestedText.status, 200)
assert.match(ingestedText.data.text, /转人工复核/)
assert.equal(ingestedText.data.files[0].chars > 0, true)

const docxDir = await mkdtemp(join(tmpdir(), 'aimrule-docx-'))
await mkdir(join(docxDir, 'word'), { recursive: true })
await writeFile(
  join(docxDir, 'word', 'document.xml'),
  '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>例外转人工复核</w:t></w:r></w:p></w:body></w:document>',
  'utf8',
)
execFileSync('/usr/bin/zip', ['-X', '-q', 'policy.docx', 'word/document.xml'], { cwd: docxDir })
const docx = (await readFile(join(docxDir, 'policy.docx'))).toString('base64')
const ingestedDocx = await call({ files: [{ name: 'policy.docx', data: docx }] }, '/aimrule/api/ingest')
assert.equal(ingestedDocx.status, 200)
assert.match(ingestedDocx.data.text, /例外转人工复核/)

const pdfSource = [
  '%PDF-1.4',
  '1 0 obj << /Type /Catalog >> endobj',
  '4 0 obj << /Length 54 >>',
  'stream',
  'BT /F1 12 Tf 20 100 Td (PDF policy text) Tj ET',
  'endstream',
  'endobj',
  'trailer << /Root 1 0 R >>',
  '%%EOF',
].join('\n')
const ingestedPdf = await call({ files: [{ name: 'policy.pdf', data: Buffer.from(pdfSource, 'latin1').toString('base64') }] }, '/aimrule/api/ingest')
assert.equal(ingestedPdf.status, 200)
assert.match(ingestedPdf.data.text, /PDF policy text/)
console.log('PASS ingest extracts text, DOCX and PDF uploads')

/* ------------------------------------------------------------- flows */

const workspace = await mkdtemp(join(tmpdir(), 'aimrule-ws-'))
const q = `?project=${encodeURIComponent(workspace)}`

/* ------------------------------------------------- workspace files */

await mkdir(join(workspace, 'docs'), { recursive: true })
await writeFile(join(workspace, 'docs', 'policy.md'), '# 审批规则\n状态为例外的，转人工复核。', 'utf8')
const tree = await call(undefined, `/aimrule/api/workspace/tree${q}`, 'GET')
assert.equal(tree.status, 200)
assert.ok(tree.data.entries.some((entry) => entry.path === 'docs' && entry.type === 'dir'))
assert.ok(tree.data.entries.some((entry) => entry.path === 'docs/policy.md' && entry.type === 'file'))
const byPath = await call({ project: workspace, paths: ['docs'] }, '/aimrule/api/ingest')
assert.equal(byPath.status, 200)
assert.match(byPath.data.text, /转人工复核/)
const escaped = await call({ project: workspace, paths: ['../outside.txt'] }, '/aimrule/api/ingest')
assert.equal(escaped.status, 200)
assert.ok(escaped.data.files.some((entry) => entry.error === '路径超出工作区'))
console.log('PASS workspace tree lists files and path ingestion stays inside the workspace')


const createdA = await call({ project: workspace, name: '流程 A' }, '/aimrule/api/flows')
assert.equal(createdA.status, 200)
const flowA = createdA.data.flow
assert.ok(flowA)
const createdB = await call({ project: workspace, name: '流程 B' }, '/aimrule/api/flows')
const flowB = createdB.data.flow
assert.notEqual(flowA, flowB)

const saveA = await call(
  { state: canvas('流程 A', [{ id: 'n3', type: 'module', pos: { x: 0, y: 200 }, data: { label: '模块 A' } }]) },
  `/aimrule/api/state${q}&flow=${flowA}`,
  'PUT',
)
assert.equal(saveA.status, 200)
const saveB = await call(
  {
    state: canvas(
      '流程 B',
      [
        { id: 'm1', type: 'module', pos: { x: 0, y: 200 }, data: { label: '例外处理' } },
        { id: 'c1', type: 'calc', parentId: 'm1', pos: { x: 0, y: 80 }, data: { label: '指标', expr: '指标 = 基数 * 系数' } },
      ],
      [{ id: 'e2', source: 'm1', target: 'c1', label: '' }],
    ),
  },
  `/aimrule/api/state${q}&flow=${flowB}`,
  'PUT',
)
assert.equal(saveB.status, 200)

const listed = await call(undefined, `/aimrule/api/flows${q}`, 'GET')
assert.equal(listed.status, 200)
assert.equal(listed.data.flows.length, 2)
assert.deepEqual(listed.data.flows.map((item) => item.name).sort(), ['流程 A', '流程 B'])

const readA = await call(undefined, `/aimrule/api/state${q}&flow=${flowA}`, 'GET')
assert.equal(readA.data.state.project.name, '流程 A')
assert.equal(readA.data.state.nodes.length, 3)
const readB = await call(undefined, `/aimrule/api/state${q}&flow=${flowB}`, 'GET')
assert.equal(readB.data.state.project.name, '流程 B')
assert.equal(readB.data.state.nodes.length, 4)

const files = await readdir(join(workspace, '.aimrule', 'flows'))
assert.equal(files.filter((name) => name.endsWith('.md')).length, 2)
assert.equal(files.filter((name) => name.endsWith('.json') && !name.endsWith('.json.bak')).length, 0)
const markdownA = await readFile(join(workspace, '.aimrule', 'flows', `${flowA}.md`), 'utf8')
assert.match(markdownA, /^---\n/)
assert.match(markdownA, /# 流程 A/)
assert.match(markdownA, /## 节点/)
assert.match(markdownA, /## 连线/)
assert.match(markdownA, /```aimrule/)
assert.match(markdownA, /"name": "流程 A"/)
console.log('PASS each workspace flow is Markdown with readable sections and an aimrule fence')

const modules = await call(undefined, `/aimrule/api/modules${q}`, 'GET')
assert.equal(modules.status, 200)
const catalog = modules.data.modules
assert.equal(catalog.length, 2)
const exceptionModule = catalog.find((item) => item.name === '例外处理')
assert.ok(exceptionModule)
assert.equal(exceptionModule.flowId, flowB)
assert.equal(exceptionModule.nodeCount, 2)
assert.equal(exceptionModule.nodes.length, 2)
assert.equal(exceptionModule.edges.length, 1)
console.log('PASS module catalog spans every flow in the workspace')

const deleted = await call({ project: workspace, flow: flowA }, '/aimrule/api/flows/delete')
assert.equal(deleted.status, 200)
assert.equal(deleted.data.flows.length, 1)
const lastDelete = await call({ project: workspace, flow: flowB }, '/aimrule/api/flows/delete')
assert.equal(lastDelete.status, 500)
console.log('PASS flows can be deleted but the last one is kept')

const flowC = (await call({ project: workspace, name: '流程 C' }, '/aimrule/api/flows')).data.flow
const chain = {
  version: 1,
  project: { name: '流程 C', description: '' },
  nodes: [
    { id: 'n1', type: 'start', pos: { x: 0, y: 0 }, data: { label: '开始' } },
    { id: 'n2', type: 'action', pos: { x: 320, y: 0 }, data: { label: '转人工复核', action: 'ESCALATE' } },
    { id: 'n3', type: 'end', pos: { x: 640, y: 0 }, data: { label: '结束' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2', label: '' },
    { id: 'e2', source: 'n2', target: 'n3', label: '' },
  ],
  templates: [],
  sources: [],
}
await call({ state: chain }, `/aimrule/api/state${q}&flow=${flowC}`, 'PUT')
const extracted = await call(
  { project: workspace, flowId: flowC, nodeIds: ['n1', 'n2'], name: '开始段', reason: '测试抽取' },
  '/aimrule/api/modules/extract',
)
assert.equal(extracted.status, 200)
const readC = await call(undefined, `/aimrule/api/state${q}&flow=${flowC}`, 'GET')
const readCState = readC.data.state
const extractedModule = readCState.nodes.find((node) => node.type === 'module' && node.data.label === '开始段')
assert.ok(extractedModule)
assert.equal(readCState.nodes.find((node) => node.id === 'n1').parentId, extractedModule.id)
assert.equal(readCState.nodes.find((node) => node.id === 'n2').parentId, extractedModule.id)
assert.ok(readCState.edges.some((edge) => edge.source === extractedModule.id && edge.target === 'n3'))
assert.ok(readCState.edges.some((edge) => edge.source === 'n1' && edge.target === 'n2'))
console.log('PASS extraction wraps a candidate into a module and rewires external edges')

/* ------------------------------------------------------------ legacy */

const legacyWs = await mkdtemp(join(tmpdir(), 'aimrule-legacy-'))
await mkdir(join(legacyWs, '.aimrule'), { recursive: true })
await writeFile(join(legacyWs, '.aimrule', 'state.json'), JSON.stringify(canvas('旧画布')), 'utf8')
const legacyQuery = `?project=${encodeURIComponent(legacyWs)}`
const legacyList = await call(undefined, `/aimrule/api/flows${legacyQuery}`, 'GET')
assert.equal(legacyList.data.flows.length, 1)
assert.equal(legacyList.data.flows[0].id, 'legacy')
const legacyRead = await call(undefined, `/aimrule/api/state${legacyQuery}&flow=legacy`, 'GET')
assert.equal(legacyRead.data.state.project.name, '旧画布')
const legacyFiles = await readdir(join(legacyWs, '.aimrule', 'flows'))
assert.ok(legacyFiles.includes('legacy.md'))
const legacyRaw = await readFile(join(legacyWs, '.aimrule', 'state.json'), 'utf8')
assert.match(legacyRaw, /旧画布/)
console.log('PASS legacy state.json is imported as Markdown without deleting the backup')

const migrationWs = await mkdtemp(join(tmpdir(), 'aimrule-migrate-'))
await mkdir(join(migrationWs, '.aimrule', 'flows'), { recursive: true })
await writeFile(join(migrationWs, '.aimrule', 'flows', 'old.json'), JSON.stringify(canvas('旧流程')), 'utf8')
const migrationQuery = `?project=${encodeURIComponent(migrationWs)}`
const migrated = await call(undefined, `/aimrule/api/flows${migrationQuery}`, 'GET')
assert.equal(migrated.data.flows.length, 1)
assert.equal(migrated.data.flows[0].id, 'old')
const migratedFiles = await readdir(join(migrationWs, '.aimrule', 'flows'))
assert.ok(migratedFiles.includes('old.md'))
assert.ok(migratedFiles.includes('old.json.bak'))
assert.ok(!migratedFiles.includes('old.json'))
const migratedRead = await call(undefined, `/aimrule/api/state${migrationQuery}&flow=old`, 'GET')
assert.equal(migratedRead.data.state.project.name, '旧流程')
console.log('PASS legacy flow JSON migrates to Markdown with a backup')

await writeFile(join(migrationWs, '.aimrule', 'flows', 'old.md'), '# 坏掉的 Markdown\n\n没有机器数据围栏。', 'utf8')
const recovered = await call(undefined, `/aimrule/api/state${migrationQuery}&flow=old`, 'GET')
assert.equal(recovered.status, 200)
assert.equal(recovered.data.state.project.name, '旧流程')
assert.match(recovered.data.warning || '', /回退到 JSON 备份/)
const recoveredFiles = await readdir(join(migrationWs, '.aimrule', 'flows'))
assert.ok(recoveredFiles.includes('old.md.corrupt'))
console.log('PASS malformed Markdown falls back to the JSON backup')
