/**
 * Shared export renderers for AimRule.
 *
 * Pure ES module with no runtime dependencies so the same code runs in the
 * Host (tool output) and in the browser bundle (export dialog).
 */

const PROSE = {
  start: '开始',
  end: '结束',
  judge: '判断',
  calc: '计算',
  action: '动作',
  module: '模块',
}

export function nodeTypeLabel(type) {
  return PROSE[type] || type || '节点'
}

function edgeLabel(edge) {
  return edge.label ? String(edge.label) : ''
}

/** Direct children of a scope; `null` is the root scope. */
export function childrenOf(state, parentId) {
  return (state.nodes || []).filter((node) => (node.parentId || null) === (parentId || null))
}

/** Edges whose both endpoints live directly in one scope. */
export function edgesIn(state, parentId) {
  const scope = parentId || null
  const byId = new Map((state.nodes || []).map((node) => [node.id, node]))
  return (state.edges || []).filter((edge) => {
    const source = byId.get(edge.source)
    const target = byId.get(edge.target)
    if (!source || !target) return false
    return (source.parentId || null) === scope && (target.parentId || null) === scope
  })
}

function byId(state) {
  return new Map((state.nodes || []).map((node) => [node.id, node]))
}

function escapeMermaid(text) {
  return String(text == null ? '' : text)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '<br/>')
}

function sanitizeId(id) {
  return String(id || 'n').replace(/[^A-Za-z0-9_]/g, '_')
}

function mermaidShape(node) {
  const label = `"${escapeMermaid(nodeLabel(node))}"`
  switch (node.type) {
    case 'start':
    case 'end':
      return `([${label}])`
    case 'judge':
      return `{${label}}`
    case 'calc':
      return `[(${label})]`
    case 'module':
      return `${label}`
    default:
      return `[${label}]`
  }
}

function nodeLabel(node) {
  const data = node.data || {}
  const base = data.label || node.id
  if (node.type === 'calc' && data.expr) return `${base}: ${data.expr}`
  return base
}

function nodeTitle(node) {
  const data = node.data || {}
  if (node.type === 'judge' && data.action) return `${nodeLabel(node)} / ${data.action}`
  return nodeLabel(node)
}

function mermaidEdges(state, parentId) {
  const lines = []
  for (const edge of edgesIn(state, parentId)) {
    const label = edgeLabel(edge)
    lines.push(`  ${sanitizeId(edge.source)} ${label ? `-->|${escapeMermaid(label)}|` : '-->'} ${sanitizeId(edge.target)}`)
  }
  return lines
}

function mermaidScope(state, parentId, indent) {
  const pad = '  '.repeat(indent)
  const lines = []
  for (const node of childrenOf(state, parentId)) {
    if (node.type === 'module') {
      lines.push(`${pad}subgraph ${sanitizeId(node.id)}["${escapeMermaid(nodeLabel(node))}"]`)
      const inner = mermaidScope(state, node.id, indent + 1)
      if (inner.length === 0) lines.push(`${pad}  ${sanitizeId(node.id)}_empty["空模块"]`)
      lines.push(...inner)
      lines.push(`${pad}end`)
    } else {
      lines.push(`${pad}${sanitizeId(node.id)}${mermaidShape(node)}`)
    }
  }
  const edges = mermaidEdges(state, parentId)
  for (const line of edges) lines.push(pad + line.trim())
  return lines
}

function describeNode(node) {
  const data = node.data || {}
  const parts = []
  if (data.label) parts.push(`**${data.label}**`)
  if (node.type === 'judge' && data.condition) parts.push(`条件：\`${data.condition}\``)
  if (node.type === 'calc' && data.expr) parts.push(`公式：\`${data.expr}\``)
  if (data.action) parts.push(`动作：${data.action}`)
  if (data.sourceRef) parts.push(`溯源：${data.sourceRef}`)
  if (data.notes) parts.push(`备注：${data.notes}`)
  return parts.join('；')
}

function walkScopes(state, parentId, visit) {
  for (const node of childrenOf(state, parentId)) {
    visit(node, parentId)
    if (node.type === 'module') walkScopes(state, node.id, visit)
  }
}

export function renderFlowMarkdown(state) {
  const project = state.project || {}
  const lines = []
  lines.push(`# ${project.name || '业务逻辑流程'}`)
  lines.push('')
  if (project.description) {
    lines.push(`> ${project.description}`)
    lines.push('')
  }
  lines.push('## 流程图')
  lines.push('')
  lines.push('```mermaid')
  lines.push('flowchart TD')
  const body = mermaidScope(state, null, 1)
  if (body.length === 0) lines.push('  empty["尚未生成节点"]')
  lines.push(...body)
  lines.push('```')
  lines.push('')
  lines.push('## 节点说明')
  lines.push('')
  let index = 0
  walkScopes(state, null, (node, parentId) => {
    index += 1
    const where = parentId ? `（位于模块 \`${parentId}\`）` : ''
    lines.push(`${index}. \`${node.id}\` · ${nodeTypeLabel(node.type)}${where}`)
    lines.push(`   - ${describeNode(node)}`)
    const out = edgesIn(state, parentId).filter((edge) => edge.source === node.id)
    for (const edge of out) {
      lines.push(`   - ${edgeLabel(edge) ? `分支「${edgeLabel(edge)}」` : '流向'} → \`${edge.target}\``)
    }
  })
  if (index === 0) lines.push('_暂无节点_')
  const sources = state.sources || []
  if (sources.length > 0) {
    lines.push('')
    lines.push('## 输入来源')
    lines.push('')
    for (const source of sources) {
      lines.push(`- **${source.title || '未命名来源'}**（${source.kind || 'text'}）`)
    }
  }
  lines.push('')
  return lines.join('\n')
}

function nextNodes(state, nodeId) {
  return (state.edges || []).filter((edge) => edge.source === nodeId)
}

function pseudoLines(state, parentId, indent, seen) {
  const pad = '  '.repeat(indent)
  const lines = []
  const nodes = childrenOf(state, parentId)
  if (nodes.length === 0) return lines
  const map = byId(state)
  const starts = nodes.filter((node) => node.type === 'start')
  const roots = starts.length > 0 ? starts : nodes.filter((node) => !(state.edges || []).some((edge) => edge.target === node.id))
  const queue = (roots.length > 0 ? roots : nodes.slice(0, 1)).map((node) => node.id)
  const visited = new Set()
  while (queue.length > 0) {
    const id = queue.shift()
    if (visited.has(id)) continue
    visited.add(id)
    const node = map.get(id)
    if (!node || (node.parentId || null) !== (parentId || null)) continue
    const data = node.data || {}
    if (node.type === 'start') {
      lines.push(`${pad}// 输入：${data.label || id}`)
    } else if (node.type === 'judge') {
      const outs = nextNodes(state, id).filter((edge) => map.has(edge.target))
      const yes = outs.filter((edge) => edge.label !== '否')
      const no = outs.filter((edge) => edge.label === '否')
      lines.push(`${pad}IF ${data.condition || '条件待补充'} THEN`)
      const body = []
      for (const edge of yes) body.push(...pseudoForTarget(state, edge, indent + 1, visited))
      lines.push(...(body.length > 0 ? body : [`${pad}  // 待补充命中分支`]))
      if (no.length > 0) {
        lines.push(`${pad}ELSE`)
        const alt = []
        for (const edge of no) alt.push(...pseudoForTarget(state, edge, indent + 1, visited))
        lines.push(...(alt.length > 0 ? alt : [`${pad}  // 待补充未命中分支`]))
      }
      lines.push(`${pad}END IF`)
    } else if (node.type === 'calc') {
      lines.push(`${pad}${calcLine(data)}`)
    } else if (node.type === 'action') {
      lines.push(`${pad}DO ${data.action || data.label || id}`)
    } else if (node.type === 'module') {
      lines.push(`${pad}CALL ${data.label || id}(...)   // 见下方模块`)
    } else if (node.type === 'end') {
      lines.push(`${pad}RETURN ${data.label || '结果'}`)
    }
    if (node.type !== 'judge') {
      for (const edge of nextNodes(state, id)) {
        const target = map.get(edge.target)
        if (!target) continue
        if ((target.parentId || null) !== (parentId || null)) continue
        if (!visited.has(target.id)) queue.push(target.id)
      }
    }
  }
  return lines
}


function calcLine(data) {
  const expr = String(data.expr || '').trim()
  const action = String(data.action || '').trim()
  if (expr) {
    const eq = expr.indexOf('=')
    const before = eq > 0 ? expr[eq - 1] : ''
    const after = eq > 0 ? expr[eq + 1] : ''
    const comparison = [':', '=', '!', '<', '>', '~'].includes(before) || after === '='
    if (eq > 0 && !comparison) return `${expr.slice(0, eq).trim()} := ${expr.slice(eq + 1).trim()}`
    if (eq === 0) return `${action || 'COMPUTE'} := ${expr}`
    return `${action || 'COMPUTE'} := ${expr}`
  }
  return `${action || 'COMPUTE'} := ${data.label || '待补充'}`
}

function pseudoForTarget(state, edge, indent, visited) {
  const map = byId(state)
  const node = map.get(edge.target)
  if (!node) return []
  const source = map.get(edge.source)
  if (source && (node.parentId || null) !== (source.parentId || null)) {
    return [`${'  '.repeat(indent)}CALL ${node.data && node.data.label ? node.data.label : node.id}(...)   // 跨模块调用`]
  }
  const pad = '  '.repeat(indent)
  if (visited.has(node.id)) return [`${pad}// 汇合至 ${node.data && node.data.label ? node.data.label : node.id}`]
  visited.add(node.id)
  if (node.type === 'judge') {
    return pseudoInlineJudge(state, node, indent, visited)
  }
  const data = node.data || {}
  const lines = []
  if (node.type === 'calc') lines.push(`${pad}${calcLine(data)}`)
  else if (node.type === 'action') lines.push(`${pad}DO ${data.action || data.label || node.id}`)
  else if (node.type === 'end') lines.push(`${pad}RETURN ${data.label || '结果'}`)
  else if (node.type === 'module') lines.push(`${pad}CALL ${data.label || node.id}(...)`)
  else lines.push(`${pad}// ${nodeTypeLabel(node.type)}：${data.label || node.id}`)
  for (const next of nextNodes(state, node.id)) {
    lines.push(...pseudoForTarget(state, next, indent, visited))
  }
  return lines
}

function pseudoInlineJudge(state, node, indent, visited) {
  const map = byId(state)
  const pad = '  '.repeat(indent)
  const outs = nextNodes(state, node.id).filter((edge) => map.has(edge.target))
  const yes = outs.filter((edge) => edge.label !== '否')
  const no = outs.filter((edge) => edge.label === '否')
  const lines = [`${pad}IF ${(node.data || {}).condition || '条件待补充'} THEN`]
  const hit = []
  for (const edge of yes) hit.push(...pseudoForTarget(state, edge, indent + 1, visited))
  lines.push(...(hit.length > 0 ? hit : [`${pad}  // 待补充`]))
  if (no.length > 0) {
    lines.push(`${pad}ELSE`)
    const miss = []
    for (const edge of no) miss.push(...pseudoForTarget(state, edge, indent + 1, visited))
    lines.push(...(miss.length > 0 ? miss : [`${pad}  // 待补充`]))
  }
  lines.push(`${pad}END IF`)
  return lines
}

export function renderPseudo(state) {
  const project = state.project || {}
  const lines = []
  lines.push(`// ${project.name || '业务逻辑'} —— 由 AimRule 画布生成`)
  lines.push('// 约定：IF 条件 THEN 动作；未覆盖的分支必须显式阻断或抛错。')
  lines.push('')
  lines.push('FUNCTION evaluate(input):')
  const rootLines = pseudoLines(state, null, 1, new Set())
  lines.push(...(rootLines.length > 0 ? rootLines : ['  // 画布为空']))
  const modules = []
  walkScopes(state, null, (node) => {
    if (node.type === 'module') modules.push(node)
  })
  for (const module of modules) {
    lines.push('')
    lines.push(`FUNCTION ${module.data && module.data.label ? module.data.label : module.id}(input):`)
    const inner = pseudoLines(state, module.id, 1, new Set())
    lines.push(...(inner.length > 0 ? inner : ['  // 空模块']))
  }
  lines.push('')
  return lines.join('\n')
}

function yamlScalar(value) {
  if (value === null || value === undefined) return 'null'
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const text = String(value)
  if (text === '') return '""'
  if (/^[A-Za-z0-9_\-./\u4e00-\u9fa5]+$/.test(text) && !/^(true|false|null|yes|no|on|off|\d+(\.\d+)?)$/i.test(text)) return text
  return JSON.stringify(text)
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function yamlLines(value, indent) {
  const pad = '  '.repeat(indent)
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`]
    const lines = []
    for (const item of value) {
      if (isObject(item)) {
        const child = yamlLines(item, indent + 1)
        const first = child[0].slice((indent + 1) * 2)
        lines.push(`${pad}- ${first}`)
        lines.push(...child.slice(1))
      } else {
        lines.push(`${pad}- ${yamlScalar(item)}`)
      }
    }
    return lines
  }
  if (isObject(value)) {
    const keys = Object.keys(value)
    if (keys.length === 0) return [`${pad}{}`]
    const lines = []
    for (const key of keys) {
      const item = value[key]
      if (item === undefined) continue
      if (Array.isArray(item) || isObject(item)) {
        const empty = Array.isArray(item) ? item.length === 0 : Object.keys(item).length === 0
        if (empty) lines.push(`${pad}${key}: ${Array.isArray(item) ? '[]' : '{}'}`)
        else {
          lines.push(`${pad}${key}:`)
          lines.push(...yamlLines(item, indent + 1))
        }
      } else {
        lines.push(`${pad}${key}: ${yamlScalar(item)}`)
      }
    }
    return lines
  }
  return [`${pad}${yamlScalar(value)}`]
}

export function toYaml(value) {
  return yamlLines(value, 0).join('\n')
}

function collectInterface(state) {
  const inputs = []
  const outputs = []
  const roots = (state.nodes || []).filter((node) => !node.parentId)
  roots.forEach((node) => {
    const data = node.data || {}
    if (node.type === 'start') {
      const list = data.outputs || data.inputs
      if (Array.isArray(list) && list.length > 0) list.forEach((item) => inputs.push({ name: String(item), type: 'string' }))
      else inputs.push({ name: data.label || node.id, type: 'string' })
    }
    if (node.type === 'end') {
      const list = data.inputs || data.outputs
      if (Array.isArray(list) && list.length > 0) list.forEach((item) => outputs.push({ name: String(item), type: 'string' }))
      else outputs.push({ name: data.label || node.id, type: 'string' })
    }
  })
  return { inputs, outputs }
}

export function renderContract(state) {
  const project = state.project || {}
  const iface = collectInterface(state)
  const rules = []
  walkScopes(state, null, (node) => {
    const data = node.data || {}
    if (node.type === 'judge' || node.type === 'calc' || node.type === 'action') {
      rules.push({
        id: node.id,
        kind: node.type,
        label: data.label || node.id,
        expression: node.type === 'judge' ? data.condition || '' : data.expr || '',
        action: data.action || '',
        source: data.sourceRef || '',
      })
    }
  })
  const doc = {
    version: 1,
    name: project.name || 'business-rule',
    entry: 'evaluate',
    inputs: iface.inputs.map((input) => ({ name: input.name, type: 'string', required: true })),
    outputs: iface.outputs.map((output) => ({ name: output.name, type: 'string' })),
    rules,
    sources: (state.sources || []).map((source) => ({ title: source.title || '', kind: source.kind || 'text' })),
  }
  return toYaml(doc)
}

export function renderTestCases(state) {
  const project = state.project || {}
  const stored = Array.isArray(state.tests) ? state.tests : []
  const cases = []
  if (stored.length > 0) {
    stored.forEach((testCase, index) => {
      const expect = testCase.expect && typeof testCase.expect === 'object' ? testCase.expect : {}
      cases.push({
        id: testCase.id || `case_${index + 1}`,
        name: testCase.name || `用例 ${index + 1}`,
        rule: testCase.rule || undefined,
        input: testCase.inputs || {},
        expect,
        note: Object.keys(expect).length === 0 ? '期望值待补充' : undefined,
      })
    })
  } else {
    let index = 0
    walkScopes(state, null, (node) => {
      const data = node.data || {}
      if (node.type !== 'judge') return
      index += 1
      cases.push({
        id: `case_${index}_true`,
        name: `${data.label || node.id} 命中`,
        rule: node.id,
        input: {},
        expect: {},
        note: '期望值待补充',
      })
      cases.push({
        id: `case_${index}_false`,
        name: `${data.label || node.id} 未命中`,
        rule: node.id,
        input: {},
        expect: {},
        note: '期望值待补充',
      })
    })
  }
  const doc = {
    version: 1,
    suite: project.name || 'business-rule',
    defaults: state.testInputs && Object.keys(state.testInputs).length > 0 ? state.testInputs : undefined,
    cases,
  }
  return toYaml(doc)
}

export function buildExports(state) {
  return {
    'flow.md': renderFlowMarkdown(state),
    'logic_pseudo.md': renderPseudo(state),
    'contract.yaml': renderContract(state),
    'test_cases.yaml': renderTestCases(state),
  }
}

export function summarize(state) {
  const nodes = state.nodes || []
  return {
    name: (state.project || {}).name || '未命名逻辑',
    nodes: nodes.length,
    edges: (state.edges || []).length,
    modules: nodes.filter((node) => node.type === 'module').length,
    templates: (state.templates || []).length,
    sources: (state.sources || []).length,
  }
}
