/**
 * AimRule Host half.
 *
 * Owns the canvas document (a nested rule graph persisted under the workspace),
 * the LLM extraction/repair pipeline with structural validation and bounded
 * retries, the HTTP surface the browser panel talks to, and the agent tools.
 */

import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { inflateRawSync, inflateSync } from 'node:zlib'
import { join, resolve, sep } from 'node:path'
import { buildExports, summarize } from './shared/export.js'
import { generateCases, runCase } from './shared/evaluate.js'
import { MAX_NODES, TYPES, normalizeState, str } from './host/state.js'

export { normalizeState }
import { StoreManager } from './host/storage.js'
import { EXTRACT_SYSTEM, MODIFY_SYSTEM, MODULE_DETECT_SYSTEM, TEST_SYSTEM, LlmUnavailable, generateWithRepair } from './host/llm.js'

export const name = 'aimrule'
export const inject = ['tools', 'webServer']

const MAX_SOURCE_CHARS = 60000

/* -------------------------------------------------------------- validator */

export function graphIssues(nodes, edges) {
  const issues = []
  const ids = new Set()
  for (const node of nodes) {
    if (!node.id) issues.push('存在缺少 id 的节点')
    else if (ids.has(node.id)) issues.push(`节点 id 重复：${node.id}`)
    ids.add(node.id)
    if (!TYPES.has(node.type)) issues.push(`节点 ${node.id} 的 type 非法：${node.type}`)
    if (!str(node.data && node.data.label)) issues.push(`节点 ${node.id} 缺少 label`)
  }
  if (nodes.length === 0) issues.push('没有返回任何节点')
  if (nodes.length > MAX_NODES) issues.push(`节点数量超过上限 ${MAX_NODES}`)
  for (const node of nodes) {
    if (node.parentId && !ids.has(node.parentId)) issues.push(`节点 ${node.id} 的 parentId 不存在：${node.parentId}`)
    if (node.parentId) {
      const parent = nodes.find((item) => item.id === node.parentId)
      if (parent && parent.type !== 'module') issues.push(`节点 ${node.id} 的父节点不是 module`)
    }
  }
  for (const edge of edges) {
    if (!ids.has(edge.source)) issues.push(`连线 ${edge.id} 的 source 不存在：${edge.source}`)
    if (!ids.has(edge.target)) issues.push(`连线 ${edge.id} 的 target 不存在：${edge.target}`)
  }
  return issues
}

export function findCycle(nodes, edges) {
  const adj = new Map()
  for (const edge of edges) {
    if (!adj.has(edge.source)) adj.set(edge.source, [])
    adj.get(edge.source).push(edge.target)
  }
  const state = new Map()
  let cycle = null
  const visit = (id, stack) => {
    if (cycle) return
    if (state.get(id) === 1) {
      cycle = [...stack, id]
      return
    }
    if (state.get(id) === 2) return
    state.set(id, 1)
    for (const next of adj.get(id) || []) visit(next, [...stack, id])
    state.set(id, 2)
  }
  for (const node of nodes) visit(node.id, [])
  return cycle
}


function remapGraph(nodes, edges, prefix) {
  const map = new Map()
  for (const node of nodes) map.set(node.id, prefix + node.id)
  const mappedNodes = nodes.map((node) => ({
    ...node,
    id: map.get(node.id),
    parentId: node.parentId ? map.get(node.parentId) || null : null,
  }))
  const mappedEdges = edges
    .map((edge) => ({
      ...edge,
      id: prefix + edge.id,
      source: map.get(edge.source),
      target: map.get(edge.target),
    }))
    .filter((edge) => edge.source && edge.target)
  return { nodes: mappedNodes, edges: mappedEdges }
}

/* ------------------------------------------------------------------ store */

/* ------------------------------------------------------------------ http */

function sendJson(res, status, data) {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  })
  res.end(body)
}

function nodePos(node) {
  return node && node.pos && Number.isFinite(node.pos.x) && Number.isFinite(node.pos.y) ? node.pos : { x: 0, y: 0 }
}

function textContent(content) {
  if (!Array.isArray(content)) return ''
  return content
    .filter((block) => block && block.type === 'text' && typeof block.text === 'string')
    .map((block) => block.text)
    .join('\n')
    .trim()
}

const WORKSPACE_SKIP = new Set(['node_modules', '.git', '.aimrule', 'aimrule-export', 'dist', 'build', '.next', 'out', '.DS_Store'])

async function workspaceRoot(project, defaultDir) {
  const path = typeof project === 'string' ? project.trim() : ''
  const root = path || defaultDir
  const info = await stat(root).catch(() => null)
  if (!info || !info.isDirectory()) throw new Error(`工作区目录不存在：${root}`)
  return root
}

async function walkWorkspace(root, options = {}) {
  const max = options.max || 600
  const depth = options.depth || 5
  const entries = []
  async function walk(directory, prefix, level) {
    if (level > depth || entries.length >= max) return
    let list = []
    try {
      list = await readdir(directory, { withFileTypes: true })
    } catch {
      return
    }
    list.sort((a, b) => a.name.localeCompare(b.name))
    for (const item of list) {
      if (entries.length >= max) break
      if (item.name.startsWith('.') || WORKSPACE_SKIP.has(item.name)) continue
      const path = prefix ? `${prefix}/${item.name}` : item.name
      const full = join(directory, item.name)
      if (item.isDirectory()) {
        entries.push({ path, name: item.name, type: 'dir' })
        await walk(full, path, level + 1)
      } else if (item.isFile()) {
        const info = await stat(full).catch(() => null)
        if (info && info.size <= 20_000_000) entries.push({ path, name: item.name, type: 'file', size: info.size })
      }
    }
  }
  await walk(root, '', 0)
  return entries
}

function decodeXmlEntities(value) {
  return String(value)
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
}

function xmlToText(xml) {
  return decodeXmlEntities(String(xml))
    .replace(/<\/(?:w:p|a:p|text:p|w:tr|row|si|t)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Minimal ZIP reader for OOXML packages (stored or deflated entries). */
function zipEntries(buffer) {
  const EOCD = 0x06054b50
  let eocd = -1
  const floor = Math.max(0, buffer.length - 65558)
  for (let index = buffer.length - 22; index >= floor; index -= 1) {
    if (buffer.readUInt32LE(index) === EOCD) {
      eocd = index
      break
    }
  }
  if (eocd < 0) throw new Error('不是有效的 ZIP/OOXML 文件')
  const count = buffer.readUInt16LE(eocd + 10)
  let pointer = buffer.readUInt32LE(eocd + 16)
  const entries = []
  for (let index = 0; index < count; index += 1) {
    if (pointer + 46 > buffer.length || buffer.readUInt32LE(pointer) !== 0x02014b50) break
    const method = buffer.readUInt16LE(pointer + 10)
    const compressedSize = buffer.readUInt32LE(pointer + 20)
    const nameLength = buffer.readUInt16LE(pointer + 28)
    const extraLength = buffer.readUInt16LE(pointer + 30)
    const commentLength = buffer.readUInt16LE(pointer + 32)
    const localOffset = buffer.readUInt32LE(pointer + 42)
    const name = buffer.toString('utf8', pointer + 46, pointer + 46 + nameLength)
    if (localOffset + 30 > buffer.length || buffer.readUInt32LE(localOffset) !== 0x04034b50) {
      pointer += 46 + nameLength + extraLength + commentLength
      continue
    }
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    let data
    if (method === 0) data = raw
    else if (method === 8) data = inflateRawSync(raw)
    else data = Buffer.alloc(0)
    entries.push({ name, data })
    pointer += 46 + nameLength + extraLength + commentLength
  }
  return entries
}

function extractDocx(buffer) {
  const entry = zipEntries(buffer).find((item) => item.name === 'word/document.xml')
  return entry ? xmlToText(entry.data.toString('utf8')) : ''
}

function extractPptx(buffer) {
  const slides = zipEntries(buffer)
    .filter((item) => /^ppt\/slides\/slide\d+\.xml$/.test(item.name))
    .sort((a, b) => Number(a.name.match(/(\d+)\.xml$/)[1]) - Number(b.name.match(/(\d+)\.xml$/)[1]))
  return slides.map((slide) => xmlToText(slide.data.toString('utf8'))).filter(Boolean).join('\n\n')
}

function extractXlsx(buffer) {
  const entries = zipEntries(buffer)
  const sharedEntry = entries.find((item) => item.name === 'xl/sharedStrings.xml')
  const shared = sharedEntry
    ? [...sharedEntry.data.toString('utf8').matchAll(/<si[\s\S]*?<\/si>/g)].map((match) => xmlToText(match[0])).filter(Boolean)
    : []
  const lines = []
  for (const entry of entries.filter((item) => /^xl\/worksheets\/sheet\d+\.xml$/.test(item.name)).sort((a, b) => a.name.localeCompare(b.name))) {
    const rows = new Map()
    const xml = entry.data.toString('utf8')
    for (const cell of xml.matchAll(/<c[^>]*r="([A-Z]+)(\d+)"[^>]*?(?:t="([^"]*)")?[^>]*>([\s\S]*?)<\/c>/g)) {
      const row = Number(cell[2])
      const type = cell[3] || ''
      const inner = cell[4]
      const value = inner.match(/<v>([\s\S]*?)<\/v>/)
      const inline = inner.match(/<is>([\s\S]*?)<\/is>/)
      let text = ''
      if (type === 's' && value) text = shared[Number(value[1])] || ''
      else if (type === 'inlineStr' && inline) text = xmlToText(inline[1])
      else if (value) text = decodeXmlEntities(value[1])
      if (!rows.has(row)) rows.set(row, [])
      rows.get(row).push(text)
    }
    if (rows.size === 0) continue
    lines.push(`[${entry.name}]`)
    for (const row of [...rows.keys()].sort((a, b) => a - b)) {
      const values = rows.get(row).filter((text) => text !== '')
      if (values.length > 0) lines.push(values.join('\t'))
    }
  }
  return lines.join('\n')
}

function decodePdfLiteral(token) {
  const body = token.slice(1, -1)
  return body
    .replace(/\\([nrtbf()\\])/g, (_, flag) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '(': '(', ')': ')', '\\': '\\' })[flag] || flag)
    .replace(/\\([0-7]{1,3})/g, (_, octal) => String.fromCharCode(parseInt(octal, 8)))
}

/** Best-effort text extraction for text-based PDFs (no OCR). */
function extractPdf(buffer) {
  const source = buffer.toString('latin1')
  const pieces = []
  const streams = source.matchAll(/stream\r?\n([\s\S]*?)endstream/g)
  for (const stream of streams) {
    let content = Buffer.from(stream[1], 'latin1')
    try {
      content = inflateSync(content)
    } catch {
      /* uncompressed stream */
    }
    const text = content.toString('latin1')
    if (!/BT|Tj|TJ/.test(text)) continue
    for (const match of text.matchAll(/\((?:[^()\\]|\\.)*\)\s*Tj/g)) pieces.push(decodePdfLiteral(match[0].trim().slice(0, match[0].lastIndexOf(')') + 1)))
    for (const match of text.matchAll(/\[((?:[^\[\]\\]|\\.)*)\]\s*TJ/g)) {
      for (const literal of match[1].matchAll(/\((?:[^()\\]|\\.)*\)/g)) pieces.push(decodePdfLiteral(literal[0]))
    }
  }
  return pieces.join(' ').replace(/\s+/g, ' ').trim()
}

async function extractWithLibreOffice(name, buffer) {
  const binary = process.platform === 'darwin' ? '/Applications/LibreOffice.app/Contents/MacOS/soffice' : 'soffice'
  const info = await stat(binary).catch(() => null)
  if (!info) return ''
  const dir = await mkdtemp(join(tmpdir(), 'aimrule-ingest-'))
  try {
    const extension = String(name).split('.').pop().toLowerCase() || 'bin'
    const source = join(dir, `source.${extension}`)
    await writeFile(source, buffer)
    const profile = join(dir, 'profile')
    await new Promise((resolve, reject) => {
      execFile(
        binary,
        [`-env:UserInstallation=file://${profile}`, '--headless', '--convert-to', 'html', '--outdir', dir, source],
        { timeout: 30000 },
        (error) => (error ? reject(error) : resolve()),
      )
    })
    const html = (await readdir(dir)).find((file) => file.endsWith('.html'))
    if (!html) return ''
    const content = await readFile(join(dir, html), 'utf8')
    return decodeXmlEntities(content)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return ''
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}

async function extractFileTextAsync(name, buffer) {
  const extension = String(name).split('.').pop().toLowerCase()
  if (extension === 'pdf' || extension === 'doc' || extension === 'ppt' || extension === 'xls') {
    const converted = await extractWithLibreOffice(name, buffer)
    if (converted) return converted
    if (extension === 'pdf') return extractPdf(buffer)
    throw new Error('旧版 Office 二进制格式需要本机安装 LibreOffice 才能解析')
  }
  return extractFileText(name, buffer)
}

const TEXT_EXTENSIONS = new Set([
  'txt', 'md', 'markdown', 'mdx', 'csv', 'tsv', 'json', 'jsonl', 'yaml', 'yml', 'toml', 'ini', 'conf',
  'html', 'htm', 'xhtml', 'xml', 'svg', 'log', 'rtf', 'tex', 'js', 'jsx', 'ts', 'tsx', 'py', 'java',
  'go', 'rs', 'rb', 'php', 'c', 'h', 'cpp', 'hpp', 'cs', 'swift', 'kt', 'sql', 'sh', 'bash', 'zsh',
])

function extractFileText(name, buffer) {
  const extension = String(name).split('.').pop().toLowerCase()
  if (extension === 'docx') return extractDocx(buffer)
  if (extension === 'pptx') return extractPptx(buffer)
  if (extension === 'xlsx') return extractXlsx(buffer)
  if (extension === 'pdf') return extractPdf(buffer)
  if (extension === 'doc' || extension === 'ppt' || extension === 'xls') throw new Error('旧版 Office 二进制格式暂不支持，请另存为 docx/pptx/xlsx')
  if (TEXT_EXTENSIONS.has(extension)) {
    const text = buffer.toString('utf8')
    if (extension === 'rtf') {
      return text
        .replace(/\\'([0-9a-f]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\\[a-z]+-?\d* ?/gi, '')
        .replace(/[{}]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    }
    return text
  }
  const text = buffer.toString('utf8')
  const sample = text.slice(0, 4000)
  const printable = sample.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  return printable.length > sample.length * 0.9 ? text : ''
}

async function readJson(req, limit = 4_000_000) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > limit) throw new Error('请求体过大')
    chunks.push(chunk)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (!text.trim()) return {}
  return JSON.parse(text)
}

/* ------------------------------------------------------------------ tools */

/* ------------------------------------------------------------------- main */

export function apply(ctx, config = {}) {
  const defaultDir =
    (ctx.get('workingDirectory') && ctx.get('workingDirectory').defaultDirectory) || process.cwd()
  const globalDir = resolve(config.stateDir || join(defaultDir, '.aimrule'))
  const manager = new StoreManager(globalDir)
  const storeFor = (project, flow) => manager.workspace(project).then((workspace) => workspace.store(flow))

  const api = {
    async state({ project, flow } = {}) {
      const store = await storeFor(project, flow)
      const state = await store.read()
      return { ok: true, state, warning: store.warning || '', dir: store.dir, project: project || '', flow: store.id, flows: await store.workspace.list() }
    },
    async save(raw, project, flow) {
      const store = await storeFor(project, flow)
      const state = await store.write(raw)
      return { ok: true, state, summary: summarize(state), dir: store.dir, project: project || '', flow: store.id, flows: await store.workspace.list() }
    },
    async flows({ project } = {}) {
      const workspace = await manager.workspace(project)
      return { ok: true, flows: await workspace.list(), project: project || '' }
    },
    async createFlow({ project, name } = {}) {
      const workspace = await manager.workspace(project)
      const created = await workspace.create(name)
      return { ok: true, flow: created.id, state: created.state, flows: await workspace.list(), project: project || '' }
    },
    async deleteFlow({ project, flow } = {}) {
      const workspace = await manager.workspace(project)
      await workspace.remove(flow)
      return { ok: true, flows: await workspace.list(), project: project || '' }
    },
    async modules({ project } = {}) {
      const workspace = await manager.workspace(project)
      return { ok: true, modules: await workspace.modules(), project: project || '' }
    },
    async detectModules({ project } = {}) {
      const workspace = await manager.workspace(project)
      const rows = await workspace.list()
      const flows = []
      for (const row of rows) {
        const store = await workspace.store(row.id)
        const state = await store.read()
        if (state.nodes.length === 0) continue
        const visible = state.nodes.slice(0, 160)
        const visibleIds = new Set(visible.map((node) => node.id))
        flows.push({
          id: row.id,
          name: state.project.name || row.name,
          nodes: visible.map((node) => ({
            id: node.id,
            type: node.type,
            parentId: node.parentId || null,
            label: (node.data && node.data.label) || '',
            condition: (node.data && node.data.condition) || '',
            action: (node.data && node.data.action) || '',
            expr: (node.data && node.data.expr) || '',
          })),
          edges: state.edges
            .filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target))
            .slice(0, 400)
            .map((edge) => ({ source: edge.source, target: edge.target, label: edge.label || '' })),
        })
      }
      if (flows.length < 2) throw new Error('至少需要两个流程图才能检测复用模块')
      const chunks = []
      let size = 0
      for (const flow of flows) {
        const text = JSON.stringify(flow)
        if (size + text.length > 50000) break
        chunks.push(text)
        size += text.length + 1
      }
      const payload = `[${chunks.join(',')}]`
      const { value, attempts } = await generateWithRepair(ctx, MODULE_DETECT_SYSTEM, payload, (parsed) => {
        const issues = []
        const byFlow = new Map(flows.map((flow) => [flow.id, flow]))
        const candidates = []
        const raw = Array.isArray(parsed.candidates) ? parsed.candidates : []
        for (const item of raw) {
          if (!item || typeof item.name !== 'string') continue
          const name = item.name.trim().slice(0, 60) || '复用子图'
          const reason = typeof item.reason === 'string' ? item.reason.slice(0, 240) : ''
          const occurrences = []
          for (const occurrence of Array.isArray(item.occurrences) ? item.occurrences : []) {
            const flow = byFlow.get(String(occurrence && occurrence.flowId))
            if (!flow) {
              issues.push(`未知 flowId：${occurrence && occurrence.flowId}`)
              continue
            }
            const ids = Array.isArray(occurrence.nodeIds) ? [...new Set(occurrence.nodeIds.map(String))] : []
            if (ids.length < 2 || ids.length > 12) {
              issues.push(`${flow.id} 的候选子图需要 2-12 个节点`)
              continue
            }
            const map = new Map(flow.nodes.map((node) => [node.id, node]))
            if (!ids.every((id) => map.has(id))) {
              issues.push(`${flow.id} 的候选子图包含未知节点`)
              continue
            }
            const parents = new Set(ids.map((id) => map.get(id).parentId || null))
            if (parents.size !== 1) {
              issues.push(`${flow.id} 的候选节点跨层级`)
              continue
            }
            const internal = flow.edges.filter((edge) => ids.includes(edge.source) && ids.includes(edge.target))
            const seen = new Set([ids[0]])
            let grew = true
            while (grew) {
              grew = false
              for (const edge of internal) {
                if (seen.has(edge.source) && !seen.has(edge.target)) {
                  seen.add(edge.target)
                  grew = true
                } else if (seen.has(edge.target) && !seen.has(edge.source)) {
                  seen.add(edge.source)
                  grew = true
                }
              }
            }
            if (seen.size !== ids.length) {
              issues.push(`${flow.id} 的候选节点不连通`)
              continue
            }
            occurrences.push({ flowId: flow.id, flowName: flow.name, nodeIds: ids })
          }
          if (occurrences.length < 2) {
            issues.push(`候选「${name}」至少需要 2 个出现位置`)
            continue
          }
          candidates.push({ name, reason, occurrences })
        }
        return { value: { candidates }, issues }
      })
      return { ok: true, candidates: value.candidates, attempts, project: project || '' }
    },
    async extractModule({ project, flowId, nodeIds, name, reason } = {}) {
      const workspace = await manager.workspace(project)
      const store = await workspace.store(flowId)
      const state = await store.read()
      const ids = Array.isArray(nodeIds) ? [...new Set(nodeIds.map(String))] : []
      if (ids.length < 2) throw new Error('至少需要两个节点才能抽为模块')
      const map = new Map(state.nodes.map((node) => [node.id, node]))
      if (!ids.every((id) => map.has(id))) throw new Error('候选节点已变化，请重新检测')
      const parents = new Set(ids.map((id) => map.get(id).parentId || null))
      if (parents.size !== 1) throw new Error('候选节点跨层级，无法自动抽为模块')
      const scope = [...parents][0]
      const chosen = new Set(ids)
      const picked = state.nodes.filter((node) => chosen.has(node.id))
      const moduleId = `m_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const centerX = picked.reduce((sum, node) => sum + nodePos(node).x + 120, 0) / picked.length
      const centerY = picked.reduce((sum, node) => sum + nodePos(node).y + 48, 0) / picked.length
      const moduleX = Math.round(centerX - 120)
      const moduleY = Math.round(centerY - 48)
      const label = String(name || '复用模块').trim().slice(0, 60) || '复用模块'
      const moduleNode = {
        id: moduleId,
        type: 'module',
        parentId: scope,
        pos: { x: moduleX, y: moduleY },
        data: {
          label,
          condition: '',
          action: '',
          expr: '',
          sourceRef: '',
          notes: reason ? `AI 检测抽取：${String(reason).slice(0, 200)}` : 'AI 检测抽取',
        },
      }
      const nodes = state.nodes.map((node) =>
        chosen.has(node.id)
          ? { ...node, parentId: moduleId, pos: { x: Math.round(nodePos(node).x - moduleX), y: Math.round(nodePos(node).y - moduleY) } }
          : node,
      )
      nodes.push(moduleNode)
      const edges = state.edges.map((edge) => {
        const fromInside = chosen.has(edge.source)
        const toInside = chosen.has(edge.target)
        if (fromInside && toInside) return edge
        if (fromInside) return { ...edge, source: moduleId }
        if (toInside) return { ...edge, target: moduleId }
        return edge
      })
      const saved = await store.write({ ...state, nodes, edges })
      return { ok: true, flowId: store.id, flowName: saved.project.name, moduleId, project: project || '' }
    },
    async workspaceTree({ project } = {}) {
      const root = await workspaceRoot(project, defaultDir)
      const entries = await walkWorkspace(root)
      return { ok: true, root, entries }
    },
    async ingest({ files, project, paths } = {}) {
      if ((!Array.isArray(files) || files.length === 0) && (!Array.isArray(paths) || paths.length === 0)) {
        throw new Error('没有可读取的文件')
      }
      const blocks = []
      const report = []
      let total = 0
      const addBlock = (name, text, failure) => {
        const clipped = String(text || '').trim().slice(0, 20000)
        const block = `### 文件：${name}\n${failure ? `[解析失败：${failure}]` : clipped || '[未提取到可读文本]'}`
        if (total + block.length > 60000) {
          report.push({ name, chars: 0, error: '累计文本超过上限' })
          return false
        }
        blocks.push(block)
        total += block.length
        report.push({ name, chars: clipped.length, ...(failure ? { error: failure } : {}) })
        return true
      }
      const readOne = async (name, buffer) => {
        if (buffer.length === 0) {
          report.push({ name, chars: 0, error: '空文件' })
          return true
        }
        if (buffer.length > 20_000_000) {
          report.push({ name, chars: 0, error: '单个文件超过 20MB' })
          return true
        }
        let text = ''
        let failure = ''
        try {
          text = await extractFileTextAsync(name, buffer)
        } catch (error) {
          failure = error && error.message ? error.message : String(error)
        }
        return addBlock(name, text, failure)
      }
      for (const item of Array.isArray(files) ? files.slice(0, 200) : []) {
        const name = String((item && item.name) || 'file').slice(0, 300)
        const base64 = item && typeof item.data === 'string' ? item.data : ''
        const buffer = base64 ? Buffer.from(base64, 'base64') : Buffer.alloc(0)
        if (!(await readOne(name, buffer))) break
      }
      if (Array.isArray(paths) && paths.length > 0) {
        const root = await workspaceRoot(project, defaultDir)
        const collected = []
        for (const relative of paths.slice(0, 20)) {
          const input = String(relative || '').trim()
          if (!input) continue
          const full = resolve(root, input)
          if (full !== root && !full.startsWith(root + sep)) {
            report.push({ name: input, chars: 0, error: '路径超出工作区' })
            continue
          }
          const info = await stat(full).catch(() => null)
          if (!info) {
            report.push({ name: input, chars: 0, error: '路径不存在' })
            continue
          }
          if (info.isDirectory()) {
            const tree = await walkWorkspace(full, { max: 200 })
            for (const entry of tree) {
              if (entry.type !== 'file') continue
              collected.push({ name: `${input}/${entry.path}`, full: join(full, entry.path) })
            }
          } else if (info.isFile()) {
            collected.push({ name: input, full })
          }
        }
        for (const entry of collected.slice(0, 80)) {
          const info = await stat(entry.full).catch(() => null)
          if (!info || !info.isFile()) continue
          const buffer = await readFile(entry.full)
          if (!(await readOne(entry.name, buffer))) break
        }
      }
      const text = blocks.join('\n\n')
      return { ok: true, text, chars: text.length, files: report }
    },
    async generate({ text, instruction, mode, project, flow }) {
      const sourceText = String(text || '').slice(0, MAX_SOURCE_CHARS)
      if (sourceText.trim().length < 10) throw new Error('请提供至少 10 个字的规则文本')
      const prompt = [
        `业务目标：${instruction || '忠实还原给定材料中的业务规则'}`,
        '',
        '材料原文：',
        '"""',
        sourceText,
        '"""',
      ].join('\n')
      const { value, attempts } = await generateWithRepair(ctx, EXTRACT_SYSTEM, prompt, (parsed) => {
        const graph = {
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          edges: Array.isArray(parsed.edges) ? parsed.edges : [],
        }
        const issues = graphIssues(graph.nodes, graph.edges)
        return { value: { ...parsed, ...graph }, issues }
      })
      const normalized = normalizeState({
        project: value.project,
        nodes: value.nodes,
        edges: value.edges,
      })
      const cycle = findCycle(normalized.nodes, normalized.edges)
      const notes = Array.isArray(value.notes) ? [...value.notes] : []
      if (cycle) notes.push(`检测到循环流程：${cycle.slice(0, 8).join(' → ')}${cycle.length > 8 ? ' → …' : ''}；已保留该环路，测试执行遇到重复节点会停止。`)
      const store = await storeFor(project, flow)
      const previous = await store.read()
      const merging = mode === 'merge' && previous.nodes.length > 0
      const incoming = merging ? remapGraph(normalized.nodes, normalized.edges, `m${Date.now().toString(36)}_`) : normalized
      const next = {
        ...previous,
        project: {
          name: merging ? previous.project.name : normalized.project.name,
          description: normalized.project.description || previous.project.description,
        },
        nodes: merging ? [...previous.nodes, ...incoming.nodes] : normalized.nodes,
        edges: merging ? [...previous.edges, ...incoming.edges] : normalized.edges,
        sources: [
          ...previous.sources,
          { id: `src_${Date.now()}`, title: (value.project && value.project.name) || '导入文本', kind: 'text', text: sourceText.slice(0, 20000), addedAt: new Date().toISOString() },
        ].slice(-40),
      }
      const saved = await store.write(next)
      return { ok: true, state: saved, attempts, notes, dir: store.dir, project: project || '', flow: store.id, flows: await store.workspace.list() }
    },
    async generateTests({ project, flow, doc } = {}) {
      const store = await storeFor(project, flow)
      const current = doc && Array.isArray(doc.nodes) ? normalizeState(doc) : await store.read()
      if (current.nodes.length === 0) throw new Error('当前画布没有节点，无法生成测试用例')
      const cleanVars = (value) => {
        const out = {}
        if (!value || typeof value !== 'object' || Array.isArray(value)) return out
        for (const [key, item] of Object.entries(value)) {
          if (typeof item === 'string' || typeof item === 'boolean' || (typeof item === 'number' && Number.isFinite(item))) out[key] = item
        }
        return out
      }
      const nodeIds = new Set(current.nodes.map((node) => node.id))
      const graph = {
        project: current.project,
        nodes: current.nodes.map((node) => ({
          id: node.id,
          type: node.type,
          parentId: node.parentId,
          data: {
            label: node.data && node.data.label,
            condition: node.data && node.data.condition,
            action: node.data && node.data.action,
            expr: node.data && node.data.expr,
            sourceRef: node.data && node.data.sourceRef,
          },
        })),
        edges: current.edges.map((edge) => ({ source: edge.source, target: edge.target, label: edge.label })),
        testInputs: current.testInputs || {},
      }
      const sourceText = current.sources
        .slice(-2)
        .map((source) => `${source.title || source.id}\n${source.text.slice(0, 3000)}`)
        .join('\n\n')
        .slice(0, 8000)
      const prompt = [
        '业务规则图：',
        JSON.stringify(graph),
        sourceText ? `\n来源摘录：\n${sourceText}` : '',
      ].join('\n')
      const { value, attempts } = await generateWithRepair(ctx, TEST_SYSTEM, prompt, (parsed) => {
        const rawCases = Array.isArray(parsed && parsed.cases) ? parsed.cases : []
        const used = new Set()
        const cases = rawCases.slice(0, 20).map((item, index) => {
          const base = str(item && item.id).trim() || `ai_${index + 1}`
          let id = base
          let suffix = 2
          while (used.has(id)) {
            id = `${base}_${suffix}`
            suffix += 1
          }
          used.add(id)
          const rule = str(item && item.rule).trim()
          return {
            id,
            name: str(item && item.name).trim().slice(0, 120) || `AI 用例 ${index + 1}`,
            rule: nodeIds.has(rule) ? rule : '',
            inputs: cleanVars(item && item.inputs),
            expect: cleanVars(item && item.expect),
          }
        })
        const issues = []
        if (cases.length === 0) issues.push('没有返回任何 cases')
        const notes = Array.isArray(parsed && parsed.notes)
          ? parsed.notes.map((item) => str(item).slice(0, 200)).filter(Boolean).slice(0, 8)
          : []
        return { value: { cases, defaults: cleanVars(parsed && parsed.defaults), notes }, issues }
      })
      return { ok: true, cases: value.cases, defaults: value.defaults, notes: value.notes, attempts }
    },
    async modify({ instruction, scopeNodes, scopeEdges, selectedIds, sourceText }) {
      const nodes = Array.isArray(scopeNodes) ? scopeNodes : []
      const edges = Array.isArray(scopeEdges) ? scopeEdges : []
      const selected = new Set(Array.isArray(selectedIds) ? selectedIds : [])
      const focus = nodes.filter((node) => selected.has(node.id))
      if (focus.length === 0) throw new Error('请先框选要改造的节点')
      const prompt = [
        `改造指令：${instruction}`,
        '',
        '选中的节点（必须保留其业务含义，除非指令要求修改）：',
        JSON.stringify(focus.map(compactNode), null, 2),
        '',
        '当前作用域的全部节点（可作为连线目标，未选中的节点不可修改）：',
        JSON.stringify(nodes.map(compactNode), null, 2),
        '',
        '当前作用域的连线：',
        JSON.stringify(edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label || '' })), null, 2),
      ]
      if (sourceText) prompt.push('', '可引用的原文：', String(sourceText).slice(0, 8000))
      const { value, attempts } = await generateWithRepair(ctx, MODIFY_SYSTEM, prompt.join('\n'), (parsed) => {
        const issues = []
        const addNodes = Array.isArray(parsed.addNodes) ? parsed.addNodes : []
        const updateNodes = Array.isArray(parsed.updateNodes) ? parsed.updateNodes : []
        const removeNodes = Array.isArray(parsed.removeNodes) ? parsed.removeNodes : []
        const addEdges = Array.isArray(parsed.addEdges) ? parsed.addEdges : []
        const removeEdges = Array.isArray(parsed.removeEdges) ? parsed.removeEdges : []
        const known = new Set([...nodes.map((node) => node.id), ...addNodes.map((node) => String(node.id || ''))])
        if (known.size !== nodes.length + addNodes.length) issues.push('addNodes 的 id 与已有节点重复')
        for (const node of removeNodes) if (!nodes.some((item) => item.id === node)) issues.push(`removeNodes 中的 ${node} 不存在`)
        for (const patch of updateNodes) {
          if (!patch || !nodes.some((item) => item.id === String(patch.id || ''))) issues.push('updateNodes 中存在未知节点')
          if (patch && patch.id && !selected.has(String(patch.id))) issues.push(`updateNodes 只能修改选中节点，${patch.id} 未被框选`)
        }
        const anchor = new Set([...selected, ...addNodes.map((node) => String((node && node.id) || ''))])
        for (const edge of addEdges) {
          if (!edge || !known.has(String(edge.source)) || !known.has(String(edge.target))) issues.push(`addEdges 的端点不存在：${edge && edge.source} → ${edge && edge.target}`)
          if (edge && !anchor.has(String(edge.source)) && !anchor.has(String(edge.target))) issues.push('addEdges 必须至少连接一个选中节点或新增节点')
        }
        if (addNodes.length > 60) issues.push('单次新增节点过多（>60）')
        const removedEdges = new Set(removeEdges)
        const kept = edges.filter((edge) => !removedEdges.has(edge.id))
        const effective = [...kept, ...addEdges.filter((edge) => edge && edge.source && edge.target)]
        const outgoing = new Map()
        for (const edge of effective) {
          if (!outgoing.has(edge.source)) outgoing.set(edge.source, [])
          outgoing.get(edge.source).push(String(edge.label || ''))
        }
        for (const [id, labels] of outgoing) {
          const seen = new Set()
          for (const label of labels) {
            if (!label) continue
            if (seen.has(label)) {
              issues.push(`节点 ${id} 出现重复分支标签「${label}」，请用 removeEdges 删除被取代的旧边`)
              break
            }
            seen.add(label)
          }
        }
        const touched = new Set(effective.flatMap((edge) => [String(edge.source), String(edge.target)]))
        for (const node of addNodes) {
          if (!node || !node.id) continue
          if (!touched.has(String(node.id))) issues.push(`新增节点 ${node.id} 没有接线，不能悬空`)
          if (node.type === 'judge') {
            const labels = new Set((outgoing.get(String(node.id)) || []).filter(Boolean))
            if (labels.size < 2) issues.push(`新增判断节点 ${node.id} 必须分出“是/否”两条出边`)
          }
        }
        return {
          value: {
            addNodes: addNodes.map((node) => cleanNode(node, addNodes.indexOf(node))).filter(Boolean),
            updateNodes,
            removeNodes,
            addEdges,
            removeEdges,
            explanation: String(parsed.explanation || ''),
          },
          issues,
        }
      })
      return { ok: true, patch: value, attempts }
    },
    async transcript({ sessionId, maxChars } = {}) {
      const target = typeof sessionId === 'string' ? sessionId.trim() : ''
      if (!target) throw new Error('缺少目标会话')
      const query = ctx.get('sessionQuery')
      if (!query || typeof query.readSession !== 'function') throw new Error('会话查询服务不可用')
      const { events } = await query.readSession(target)
      const limit = Math.min(MAX_SOURCE_CHARS, Math.max(2000, Number(maxChars) || 24000))
      const messages = []
      for (const event of events || []) {
        if (!event || !event.data) continue
        if (event.type === 'user/message') {
          const source = event.data.source || {}
          if (source.kind !== 'user' && source.kind !== 'aimrule') continue
          const text = textContent(event.data.content)
          if (text) messages.push({ role: '用户', text, seq: event.seq, time: event.time })
        } else if (event.type === 'assistant/message') {
          const message = event.data.message || {}
          const text = textContent(message.content)
          if (text) messages.push({ role: '助手', text, seq: event.seq, time: event.time })
        }
      }
      const blocks = []
      let total = 0
      for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        const body = message.text.length > 6000 ? `${message.text.slice(0, 6000)}\n…（已截断）` : message.text
        const block = `【${message.role}】\n${body}`
        if (total + block.length + 2 > limit) {
          if (blocks.length === 0) blocks.unshift(block.slice(0, limit))
          break
        }
        blocks.unshift(block)
        total += block.length + 2
      }
      const text = blocks.join('\n\n')
      return {
        ok: true,
        sessionId: target,
        text,
        messages: blocks.length,
        chars: text.length,
        items: messages.slice(-80).map((item) => ({ role: item.role, text: item.text.slice(0, 4000), seq: item.seq, time: item.time })),
      }
    },
    async export({ project, flow } = {}) {
      const store = await storeFor(project, flow)
      const state = await store.read()
      return { ok: true, files: buildExports(state), summary: summarize(state), project: project || '', flow: store.id, dir: store.dir }
    },
  }

  const route = ctx.webServer.register({
    kind: 'prefix',
    path: '/aimrule/api',
    handler: async (req, res) => {
      try {
        const host = req.headers.host || '127.0.0.1'
        const url = new URL(req.url || '/', `http://${host}`)
        const origin = req.headers.origin
        if (req.method !== 'GET' && origin && origin !== url.origin) {
          sendJson(res, 403, { ok: false, error: '拒绝跨站写入' })
          return
        }
        const path = url.pathname.replace(/^\/aimrule\/api\/?/, '').replace(/\/$/, '')
        const project = url.searchParams.get('project') || ''
        const flow = url.searchParams.get('flow') || ''
        if (path === 'health' && req.method === 'GET') {
          sendJson(res, 200, { ok: true, name: 'aimrule', version: '0.9.15', dir: globalDir })
          return
        }
        if (path === 'state' && req.method === 'GET') {
          sendJson(res, 200, await api.state({ project, flow }))
          return
        }
        if (path === 'state' && (req.method === 'PUT' || req.method === 'POST')) {
          const body = await readJson(req)
          sendJson(res, 200, await api.save(body.state || body, project, body.flow || flow))
          return
        }
        if (path === 'ingest' && req.method === 'POST') {
          const body = await readJson(req, 60_000_000)
          sendJson(res, 200, await api.ingest(body))
          return
        }
        if (path === 'tests/generate' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.generateTests({ ...body, project: body.project || project, flow: body.flow || flow }))
          return
        }
        if (path === 'generate' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.generate({ ...body, project: body.project || project, flow: body.flow || flow }))
          return
        }
        if (path === 'flows' && req.method === 'GET') {
          sendJson(res, 200, await api.flows({ project }))
          return
        }
        if (path === 'flows' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.createFlow({ project: body.project || project, name: body.name }))
          return
        }
        if (path === 'flows/delete' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.deleteFlow({ project: body.project || project, flow: body.flow }))
          return
        }
        if (path === 'workspace/tree' && req.method === 'GET') {
          sendJson(res, 200, await api.workspaceTree({ project }))
          return
        }
        if (path === 'modules' && req.method === 'GET') {
          sendJson(res, 200, await api.modules({ project }))
          return
        }
        if (path === 'modules/detect' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.detectModules({ project: body.project || project }))
          return
        }
        if (path === 'modules/extract' && req.method === 'POST') {
          const body = await readJson(req)
          sendJson(res, 200, await api.extractModule({ ...body, project: body.project || project }))
          return
        }
        if (path === 'transcript' && req.method === 'POST') {
          sendJson(res, 200, await api.transcript(await readJson(req)))
          return
        }
        if (path === 'modify' && req.method === 'POST') {
          sendJson(res, 200, await api.modify(await readJson(req)))
          return
        }
        if (path === 'export' && req.method === 'GET') {
          sendJson(res, 200, await api.export({ project, flow }))
          return
        }
        sendJson(res, 404, { ok: false, error: `未知接口：${path || '/'}` })
      } catch (error) {
        const unavailable = error instanceof LlmUnavailable
        sendJson(res, unavailable ? 503 : 500, {
          ok: false,
          error: error && error.message ? error.message : String(error),
          code: unavailable ? 'llm_unavailable' : 'aimrule_error',
          detail: error && error.detail ? error.detail : undefined,
        })
      }
    },
  })
  ctx.effect(() => route, 'aimrule: http api')

  const sessionProject = (exec) => {
    const directory = ctx.get('workingDirectory')
    return exec && exec.agent && directory && typeof directory.get === 'function' ? directory.get(exec.agent.session) : defaultDir
  }

  ctx.tools.register({
    name: 'aimrule_generate',
    description:
      'Extract an executable business-rule graph from policy text, chat logs, or a business description and write it to the AimRule canvas. Returns node/edge counts; the user then refines it visually.',
    parameters: {
      source_text: { type: 'string', description: 'The material to model (policy clauses, chat log, business description).' },
      instruction: { type: 'string', description: 'Optional modelling goal, e.g. which part to focus on or the desired granularity.' },
      mode: { type: 'string', enum: ['replace', 'merge'], description: 'replace the canvas (default) or merge into it.' },
      flow: { type: 'string', description: 'Flowchart id inside the workspace; omit to use the most recently updated flowchart.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          nodes: { type: 'integer' },
          edges: { type: 'integer' },
          attempts: { type: 'integer' },
          project: { type: 'string' },
          notes: { type: 'array', items: { type: 'string' } },
        },
        required: ['ok', 'nodes', 'edges', 'attempts', 'project', 'notes'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `AimRule canvas updated: ${value.nodes} nodes, ${value.edges} edges (project “${value.project}”, ${value.attempts} model attempt(s)).${
            value.notes.length > 0 ? `\nOpen points:\n- ${value.notes.join('\n- ')}` : ''
          }\nThe AimRule panel in the sidebar shows the result.`,
        },
      ],
    },
    async execute(args, exec) {
      const result = await api.generate({ text: args.source_text, instruction: args.instruction, mode: args.mode, project: sessionProject(exec), flow: args.flow })
      return {
        ok: true,
        nodes: result.state.nodes.length,
        edges: result.state.edges.length,
        attempts: result.attempts,
        project: result.state.project.name,
        notes: result.notes,
      }
    },
  })

  ctx.tools.register({
    name: 'aimrule_parse_code',
    description:
      'Reverse-engineer business logic from an existing source file: reads the file from the calling session working directory and writes the recovered branches and calculations to the AimRule canvas.',
    parameters: {
      path: { type: 'string', description: 'Source file path, relative to the session working directory.' },
      mode: { type: 'string', enum: ['replace', 'merge'], description: 'replace the canvas (default) or merge into it.' },
      flow: { type: 'string', description: 'Flowchart id inside the workspace; omit to use the most recently updated flowchart.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          nodes: { type: 'integer' },
          edges: { type: 'integer' },
          attempts: { type: 'integer' },
          project: { type: 'string' },
          notes: { type: 'array', items: { type: 'string' } },
        },
        required: ['ok', 'nodes', 'edges', 'attempts', 'project', 'notes'],
      },
      render: (_args, value) => [
        {
          type: 'text',
          text: `Recovered ${value.nodes} nodes and ${value.edges} edges from source into “${value.project}” (${value.attempts} model attempt(s)).${
            value.notes.length > 0 ? `\nOpen points:\n- ${value.notes.join('\n- ')}` : ''
          }`,
        },
      ],
    },
    async execute(args, exec) {
      if (!args.path) throw new Error('path is required')
      const directory = ctx.get('workingDirectory')
      const baseDir =
        exec && exec.agent && directory && typeof directory.get === 'function' ? directory.get(exec.agent.session) : defaultDir
      const full = resolve(baseDir, args.path)
      const text = await readFile(full, 'utf8')
      if (text.trim().length < 20) throw new Error('源码内容过短，无法提炼')
      const result = await api.generate({
        text: text.slice(0, MAX_SOURCE_CHARS),
        instruction:
          '这是现有源代码。请逆向还原其中的业务判断、计算与查表逻辑；忽略日志、空值防御、框架样板等纯技术细节，保留业务分支与阈值。',
        mode: args.mode || 'replace',
        project: baseDir,
        flow: args.flow,
      })
      return {
        ok: true,
        nodes: result.state.nodes.length,
        edges: result.state.edges.length,
        attempts: result.attempts,
        project: result.state.project.name,
        notes: result.notes,
      }
    },
  })

  ctx.tools.register({
    name: 'aimrule_canvas',
    description: 'Read the current AimRule canvas graph (nested nodes and edges) or replace it with a graph you constructed.',
    parameters: {
      action: { type: 'string', enum: ['read', 'replace'], description: 'read the canvas, or replace it.' },
      graph: { type: 'object', description: 'Required for replace: { nodes: [...], edges: [...] } using the AimRule node shape.' },
      flow: { type: 'string', description: 'Flowchart id inside the workspace; omit to use the most recently updated flowchart.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          action: { type: 'string' },
          summary: { type: 'string' },
          nodes: { type: 'integer' },
          edges: { type: 'integer' },
          graph: { type: 'object' },
        },
        required: ['ok', 'action', 'summary'],
      },
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    async execute(args, exec) {
      const project = sessionProject(exec)
      if (args.action === 'read') {
        const { state } = await api.state({ project, flow: args.flow })
        return {
          ok: true,
          action: 'read',
          summary: `Canvas “${state.project.name}”: ${state.nodes.length} nodes, ${state.edges.length} edges.\n${JSON.stringify({ nodes: state.nodes, edges: state.edges })}`,
          nodes: state.nodes.length,
          edges: state.edges.length,
          graph: { nodes: state.nodes, edges: state.edges },
        }
      }
      const graph = args.graph || { nodes: [], edges: [] }
      const store = await storeFor(project, args.flow)
      const state = await store.read()
      const saved = await store.write({ ...state, nodes: graph.nodes || [], edges: graph.edges || [] })
      return {
        ok: true,
        action: 'replace',
        summary: `Canvas replaced: ${saved.nodes.length} nodes, ${saved.edges.length} edges.`,
        nodes: saved.nodes.length,
        edges: saved.edges.length,
      }
    },
  })

  ctx.tools.register({
    name: 'aimrule_test',
    description:
      'Generate or run the canvas test cases against the rule evaluator: each case supplies inputs, the canvas is executed, and every expectation mismatch is reported by key, expected value, and actual value.',
    parameters: {
      action: { type: 'string', enum: ['generate', 'run'], description: 'generate cases from the canvas, or run the saved cases.' },
      flow: { type: 'string', description: 'Flowchart id inside the workspace; omit to use the most recently updated flowchart.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          action: { type: 'string' },
          total: { type: 'integer' },
          pass: { type: 'integer' },
          fail: { type: 'integer' },
          error: { type: 'integer' },
          other: { type: 'integer' },
          failures: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['ok', 'action', 'total', 'pass', 'fail', 'error', 'other', 'failures', 'summary'],
      },
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    async execute(args, exec) {
      const project = sessionProject(exec)
      const store = await storeFor(project, args.flow)
      const state = await store.read()
      if (args.action === 'generate') {
        const cases = generateCases(state)
        if (cases.length === 0) throw new Error('画布还没有可生成用例的判断节点')
        const saved = await store.write({ ...state, tests: cases, testInputs: state.testInputs || {} })
        return {
          ok: true,
          action: 'generate',
          total: saved.tests.length,
          pass: 0,
          fail: 0,
          error: 0,
          other: 0,
          failures: [],
          summary: `Generated ${saved.tests.length} test cases into the canvas. Fill inputs and expectations in the AimRule panel, then run.`,
        }
      }
      const cases = Array.isArray(state.tests) ? state.tests : []
      if (cases.length === 0) throw new Error('画布还没有测试用例；先用 action=generate 生成')
      const defaults = state.testInputs || {}
      let pass = 0
      let fail = 0
      let error = 0
      let other = 0
      const failures = []
      for (const item of cases) {
        let outcome
        try {
          outcome = runCase(state, { ...item, inputs: { ...defaults, ...(item.inputs || {}) } })
        } catch (caught) {
          error += 1
          failures.push(`${item.name}: ${caught.message || caught}`)
          continue
        }
        if (outcome.status === 'pass') pass += 1
        else if (outcome.status === 'fail') {
          fail += 1
          const detail = (outcome.mismatches || [])
            .map((mismatch) => `${mismatch.key} 期望 ${JSON.stringify(mismatch.expected)} 实际 ${JSON.stringify(mismatch.actual)}`)
            .join('；')
          failures.push(`${item.name}: ${detail}`)
        } else if (outcome.status === 'error') {
          error += 1
          failures.push(`${item.name}: ${outcome.message}`)
        } else other += 1
      }
      return {
        ok: true,
        action: 'run',
        total: cases.length,
        pass,
        fail,
        error,
        other,
        failures: failures.slice(0, 20),
        summary: `Ran ${cases.length} cases: ${pass} passed, ${fail} failed, ${error} errored, ${other} without expectations.${failures.length > 0 ? `\n- ${failures.slice(0, 6).join('\n- ')}` : ''}`,
      }
    },
  })

  ctx.tools.register({
    name: 'aimrule_export',
    description: 'Export the AimRule canvas as engineering context: Mermaid flow, pseudo code, YAML contract, and test cases. Writes the files under aimrule-export in the calling session working directory and returns their paths.',
    parameters: {
      out_dir: { type: 'string', description: 'Optional output directory; defaults to <workspace>/aimrule-export.' },
      flow: { type: 'string', description: 'Flowchart id inside the workspace; omit to use the most recently updated flowchart.' },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          ok: { type: 'boolean' },
          dir: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          summary: { type: 'string' },
        },
        required: ['ok', 'dir', 'files', 'summary'],
      },
      render: (_args, value) => [{ type: 'text', text: value.summary }],
    },
    async execute(args, exec) {
      const baseDir = sessionProject(exec)
      const store = await storeFor(baseDir, args.flow)
      const state = await store.read()
      const files = buildExports(state)
      const outDir = resolve(args.out_dir || join(baseDir, 'aimrule-export'))
      await mkdir(outDir, { recursive: true })
      for (const [file, content] of Object.entries(files)) {
        await writeFile(join(outDir, file), content, 'utf8')
      }
      const info = summarize(state)
      return {
        ok: true,
        dir: outDir,
        files: Object.keys(files),
        summary: `Exported “${info.name}” (${info.nodes} nodes) to ${outDir}: ${Object.keys(files).join(', ')}.`,
      }
    },
  })
}

function compactNode(node) {
  const data = node.data || {}
  const out = { id: node.id, type: node.type }
  if (node.parentId) out.parentId = node.parentId
  for (const key of ['label', 'condition', 'action', 'expr', 'sourceRef', 'notes']) {
    if (data[key]) out[key] = data[key]
  }
  return out
}
