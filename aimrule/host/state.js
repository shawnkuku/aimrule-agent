/* Canvas document normalization and small value helpers. */

export const TYPES = new Set(['start', 'judge', 'calc', 'action', 'end', 'module'])
export const MAX_NODES = 240
export function emptyState() {
  return {
    version: 1,
    project: { name: '未命名业务逻辑', description: '' },
    nodes: [],
    edges: [],
    templates: [],
    sources: [],
    tests: [],
    testInputs: {},
    updatedAt: new Date().toISOString(),
  }
}

export function str(value, fallback = '') {
  return typeof value === 'string' ? value : value === number(value) ? String(value) : fallback
}

export function number(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : NaN
}

export function cleanNode(raw, index) {
  if (!raw || typeof raw !== 'object') return null
  const type = TYPES.has(raw.type) ? raw.type : 'action'
  const id = str(raw.id).trim() || `n${index + 1}`
  const data = raw.data && typeof raw.data === 'object' ? raw.data : {}
  const pos = raw.pos && typeof raw.pos === 'object' ? raw.pos : raw.position
  const node = {
    id,
    type,
    parentId: raw.parentId ? String(raw.parentId) : null,
    data: {
      label: str(data.label !== undefined ? data.label : raw.label).slice(0, 200),
      condition: str(data.condition !== undefined ? data.condition : raw.condition).slice(0, 600),
      action: str(data.action !== undefined ? data.action : raw.action).slice(0, 600),
      expr: str(data.expr !== undefined ? data.expr : raw.expr).slice(0, 600),
      sourceRef: str(data.sourceRef !== undefined ? data.sourceRef : raw.sourceRef).slice(0, 400),
      notes: str(data.notes !== undefined ? data.notes : raw.notes).slice(0, 600),
      inputs: Array.isArray(data.inputs) ? data.inputs.map((item) => str(item)).filter(Boolean).slice(0, 24) : [],
      outputs: Array.isArray(data.outputs) ? data.outputs.map((item) => str(item)).filter(Boolean).slice(0, 24) : [],
    },
  }
  if (pos && Number.isFinite(number(pos.x)) && Number.isFinite(number(pos.y))) {
    node.pos = { x: number(pos.x), y: number(pos.y) }
  }
  return node
}

export function cleanEdge(raw, index, ids) {
  if (!raw || typeof raw !== 'object') return null
  const source = str(raw.source)
  const target = str(raw.target)
  if (!ids.has(source) || !ids.has(target) || source === target) return null
  return {
    id: str(raw.id).trim() || `e${index + 1}`,
    source,
    target,
    label: str(raw.label).slice(0, 40),
  }
}

/** Rebuild a safe canvas document from untrusted JSON (client save or model output). */
export function normalizeState(raw) {
  const base = emptyState()
  if (!raw || typeof raw !== 'object') return base
  const project = raw.project && typeof raw.project === 'object' ? raw.project : {}
  const nodes = []
  const seen = new Set()
  const rawNodes = Array.isArray(raw.nodes) ? raw.nodes.slice(0, MAX_NODES) : []
  rawNodes.forEach((item, index) => {
    const node = cleanNode(item, index)
    if (!node) return
    if (seen.has(node.id)) node.id = `${node.id}_${index}`
    seen.add(node.id)
    nodes.push(node)
  })
  const moduleIds = new Set(nodes.filter((node) => node.type === 'module').map((node) => node.id))
  for (const node of nodes) {
    if (node.parentId && !moduleIds.has(node.parentId)) node.parentId = null
  }
  // break parent cycles
  for (const node of nodes) {
    let cursor = node.parentId
    let hops = 0
    while (cursor && hops < 32) {
      if (cursor === node.id) {
        node.parentId = null
        break
      }
      const parent = nodes.find((item) => item.id === cursor)
      cursor = parent ? parent.parentId : null
      hops += 1
    }
  }
  const ids = new Set(nodes.map((node) => node.id))
  const edges = []
  const edgeIds = new Set()
  const rawEdges = Array.isArray(raw.edges) ? raw.edges.slice(0, MAX_NODES * 3) : []
  rawEdges.forEach((item, index) => {
    const edge = cleanEdge(item, index, ids)
    if (!edge) return
    if (edgeIds.has(edge.id)) edge.id = `${edge.id}_${index}`
    edgeIds.add(edge.id)
    edges.push(edge)
  })
  const sources = (Array.isArray(raw.sources) ? raw.sources : []).slice(0, 40).map((source, index) => ({
    id: str((source && source.id) || `src_${index + 1}`),
    title: str(source && source.title).slice(0, 200) || `来源 ${index + 1}`,
    kind: str(source && source.kind) || 'text',
    text: str(source && source.text).slice(0, 20000),
    addedAt: str(source && source.addedAt) || new Date().toISOString(),
  }))
  const templates = (Array.isArray(raw.templates) ? raw.templates : []).slice(0, 80).map((template, index) => {
    const templateNodes = (Array.isArray(template && template.nodes) ? template.nodes : [])
      .map((item, i) => cleanNode(item, i))
      .filter(Boolean)
    return {
      id: str((template && template.id) || `tpl_${index + 1}`),
      name: str(template && template.name).slice(0, 120) || `模板 ${index + 1}`,
      nodes: templateNodes,
      edges: (Array.isArray(template && template.edges) ? template.edges : [])
        .map((item, i) => cleanEdge(item, i, new Set(templateNodes.map((node) => node.id))))
        .filter(Boolean),
      createdAt: str(template && template.createdAt) || new Date().toISOString(),
    }
  })
  const plainObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {})
  const tests = (Array.isArray(raw.tests) ? raw.tests : []).slice(0, 200).map((item, index) => ({
    id: str(item && item.id) || `case_${index + 1}`,
    name: str(item && item.name).slice(0, 200) || `用例 ${index + 1}`,
    rule: str(item && item.rule),
    inputs: plainObject(item && item.inputs),
    expect: plainObject(item && item.expect),
  }))
  return {
    version: 1,
    project: {
      name: str(project.name).slice(0, 160) || base.project.name,
      description: str(project.description).slice(0, 600),
    },
    nodes,
    edges,
    templates,
    sources,
    tests,
    testInputs: plainObject(raw.testInputs),
    updatedAt: str(raw.updatedAt) || new Date().toISOString(),
  }
}
