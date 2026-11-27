/* Pure flow-model helpers and constants shared by the canvas UI. */

export const NODE_W = 240
export const NODE_H = 88
export const MIN_K = 0.25
export const MAX_K = 2.4

export const TYPE_META = {
  start: { label: '开始', glyph: '▶', color: 'var(--aimrule-start)', hint: '输入与入口' },
  judge: { label: '判断', glyph: '◆', color: 'var(--aimrule-judge)', hint: 'IF 条件分支' },
  calc: { label: '计算', glyph: '∑', color: 'var(--aimrule-calc)', hint: '公式与查表' },
  action: { label: '动作', glyph: '⚡', color: 'var(--aimrule-action)', hint: '执行与副作用' },
  end: { label: '结束', glyph: '■', color: 'var(--aimrule-end)', hint: '输出与结果' },
  module: { label: '模块', glyph: '▣', color: 'var(--aimrule-module)', hint: '可嵌套黑盒' },
}
export const TYPE_ORDER = ['start', 'judge', 'calc', 'action', 'end', 'module']


export function uid(prefix) {
  return prefix + Math.random().toString(36).slice(2, 8)
}

export function posOf(node) {
  return node && node.pos ? node.pos : { x: 0, y: 0 }
}

export function scopeOf(node) {
  return node.parentId || null
}

export function scopeNodes(doc, scope) {
  return doc.nodes.filter((node) => scopeOf(node) === (scope || null))
}

export function scopeEdges(doc, scope) {
  const ids = new Set(scopeNodes(doc, scope).map((node) => node.id))
  return doc.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
}

export function computeLayout(nodes, edges) {
  const indeg = new Map(nodes.map((node) => [node.id, 0]))
  for (const edge of edges) {
    if (indeg.has(edge.target)) indeg.set(edge.target, indeg.get(edge.target) + 1)
  }
  let roots = nodes.filter((node) => indeg.get(node.id) === 0)
  if (roots.length === 0) roots = nodes.slice(0, 1)
  const layer = new Map()
  const queue = roots.map((node) => ({ id: node.id, level: 0 }))
  let guard = 0
  while (queue.length > 0 && guard < 4000) {
    guard += 1
    const { id, level } = queue.shift()
    const known = layer.get(id)
    if (known !== undefined) continue
    layer.set(id, level)
    for (const edge of edges) if (edge.source === id) queue.push({ id: edge.target, level: level + 1 })
  }
  for (const node of nodes) if (!layer.has(node.id)) layer.set(node.id, 0)
  const columns = new Map()
  for (const node of nodes) {
    const level = layer.get(node.id)
    if (!columns.has(level)) columns.set(level, [])
    columns.get(level).push(node)
  }
  const result = new Map()
  for (const [level, list] of [...columns.entries()].sort((a, b) => a[0] - b[0])) {
    list.forEach((node, index) => result.set(node.id, { x: 80 + level * 320, y: 70 + index * 132 }))
  }
  return result
}

export function layoutState(doc) {
  const nodes = doc.nodes.map((node) => ({ ...node }))
  const scopes = [null, ...nodes.filter((node) => node.type === 'module').map((node) => node.id)]
  for (const scope of scopes) {
    const inScope = nodes.filter((node) => scopeOf(node) === scope)
    if (inScope.length === 0) continue
    const ids = new Set(inScope.map((node) => node.id))
    const edges = doc.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
    const positions = computeLayout(inScope, edges)
    for (const node of inScope) {
      const position = positions.get(node.id)
      if (position) node.pos = position
    }
  }
  return { ...doc, nodes }
}

export function hasMissingPositions(doc) {
  if (doc.nodes.length === 0) return false
  return doc.nodes.some((node) => !node.pos || !Number.isFinite(node.pos.x) || !Number.isFinite(node.pos.y))
}

export function pathOf(doc, id) {
  const map = new Map(doc.nodes.map((node) => [node.id, node]))
  const result = []
  let cursor = id
  let guard = 0
  while (cursor && guard < 32) {
    guard += 1
    const node = map.get(cursor)
    if (!node) break
    result.unshift(node)
    cursor = node.parentId || null
  }
  return result
}

export function edgePath(a, b) {
  const ax = a.x + NODE_W
  const ay = a.y + NODE_H / 2
  const bx = b.x
  const by = b.y + NODE_H / 2
  const distance = Math.abs(bx - ax)
  const curve = Math.max(48, Math.min(180, distance * 0.5))
  if (bx >= ax) return `M${ax},${ay} C${ax + curve},${ay} ${bx - curve},${by} ${bx},${by}`
  const lift = 60 + Math.min(120, Math.abs(by - ay) * 0.2)
  return `M${ax},${ay} C${ax + lift},${ay - lift} ${bx - lift},${by - lift} ${bx},${by}`
}

export function defaultData(type) {
  return {
    label: TYPE_META[type] ? TYPE_META[type].label : '节点',
    condition: type === 'judge' ? '条件待补充' : '',
    action: '',
    expr: '',
    sourceRef: '',
    notes: '',
  }
}

export function demoDoc() {
  const nodes = [
    { id: 'n_start', type: 'start', data: { label: '流程入口', sourceRef: '规则 1' } },
    { id: 'n_calc', type: 'calc', data: { label: '计算指标', expr: '指标 = 基数 * 系数', sourceRef: '规则 2' } },
    { id: 'n_judge', type: 'judge', data: { label: '是否命中例外', condition: '状态 == "例外"', sourceRef: '规则 3' } },
    { id: 'n_action', type: 'action', data: { label: '转人工复核', action: 'ESCALATE', sourceRef: '规则 3' } },
    { id: 'n_module', type: 'module', data: { label: '自动处理', sourceRef: '规则 4' }, pos: { x: 80, y: 470 } },
    { id: 'n_mod_start', type: 'start', parentId: 'n_module', data: { label: '进入自动处理' }, pos: { x: 80, y: 80 } },
    { id: 'n_mod_calc', type: 'calc', parentId: 'n_module', data: { label: '给出结论', expr: '结论 = "通过"', sourceRef: '规则 4' }, pos: { x: 400, y: 80 } },
    { id: 'n_mod_end', type: 'end', parentId: 'n_module', data: { label: '自动处理结束' }, pos: { x: 720, y: 80 } },
    { id: 'n_end', type: 'end', data: { label: '流程结束' } },
  ]
  const edges = [
    { id: 'e1', source: 'n_start', target: 'n_calc', label: '' },
    { id: 'e2', source: 'n_calc', target: 'n_judge', label: '' },
    { id: 'e3', source: 'n_judge', target: 'n_action', label: '是' },
    { id: 'e4', source: 'n_judge', target: 'n_module', label: '否' },
    { id: 'e5', source: 'n_action', target: 'n_end', label: '' },
    { id: 'e6', source: 'n_module', target: 'n_end', label: '' },
    { id: 'e7', source: 'n_mod_start', target: 'n_mod_calc', label: '' },
    { id: 'e8', source: 'n_mod_calc', target: 'n_mod_end', label: '' },
  ]
  return layoutState({
    version: 1,
    project: { name: '示例：通用审批规则', description: '示例：条件分支、计算与可嵌套子流程' },
    nodes,
    edges,
    templates: [],
    sources: [{ id: 'src_demo', title: '示例：规则节选', kind: 'text', text: '当状态为“例外”时转人工复核；否则进入自动处理。' }],
    updatedAt: new Date().toISOString(),
  })
}

export function formatBytes(bytes) {
  const value = Number(bytes) || 0
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / 1024 / 1024).toFixed(1)} MB`
}


export function buildWorkspaceTree(entries) {
  const root = { children: new Map() }
  for (const entry of Array.isArray(entries) ? entries : []) {
    const parts = String(entry.path || '').split('/').filter(Boolean)
    if (parts.length === 0) continue
    let cursor = root
    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index]
      const path = parts.slice(0, index + 1).join('/')
      if (!cursor.children.has(name)) cursor.children.set(name, { name, path, type: 'dir', children: new Map() })
      cursor = cursor.children.get(name)
      if (index === parts.length - 1) {
        cursor.type = entry.type === 'dir' ? 'dir' : 'file'
        cursor.size = entry.size
      }
    }
  }
  const convert = (node) => {
    const children = [...node.children.values()]
      .map(convert)
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name))
    return { name: node.name, path: node.path, type: node.type, size: node.size, children }
  }
  return [...root.children.values()]
    .map(convert)
    .sort((a, b) => (a.type === b.type ? 0 : a.type === 'dir' ? -1 : 1) || a.name.localeCompare(b.name))
}

export function filterWorkspaceTree(nodes, query) {
  const needle = String(query || '').trim().toLowerCase()
  if (!needle) return nodes
  const walk = (node) => {
    const children = node.children.map(walk).filter(Boolean)
    if (node.path.toLowerCase().includes(needle)) return { ...node, children: node.type === 'dir' ? node.children : [] }
    if (children.length > 0) return { ...node, children }
    return null
  }
  return nodes.map(walk).filter(Boolean)
}

export function countTreeFiles(node) {
  if (!node) return 0
  if (node.type !== 'dir') return 1
  return node.children.reduce((sum, child) => sum + countTreeFiles(child), 0)
}

export function nodeContextText(doc, ids) {
  if (!doc) return ''
  const map = new Map(doc.nodes.map((node) => [node.id, node]))
  const lines = []
  for (const id of ids) {
    const node = map.get(id)
    if (!node) continue
    const data = node.data || {}
    const parts = [`[${node.type}] ${data.label || id}`]
    if (data.condition) parts.push(`条件：${data.condition}`)
    if (data.action) parts.push(`动作：${data.action}`)
    if (data.expr) parts.push(`公式：${data.expr}`)
    if (node.type === 'module') {
      const children = doc.nodes.filter((item) => item.parentId === node.id)
      if (children.length > 0) parts.push(`包含 ${children.length} 个子节点：${children.map((item) => (item.data && item.data.label) || item.id).join('、')}`)
    }
    lines.push(`- ${parts.join('；')}`)
  }
  return lines.join('\n')
}


export function baseName(path) {
  return String(path || '').split('/').filter(Boolean).pop() || '项目'
}

