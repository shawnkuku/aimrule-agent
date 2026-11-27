/**
 * Evaluator checks: deterministic rule execution, missing input handling,
 * unsupported syntax, and the real generated canvas.
 *
 * Run: node test/evaluate-check.mjs
 */

import { runCase, generateCases, runSuite, splitAssignment, inputNames } from '../shared/evaluate.js'

let failed = 0
const check = (name, ok, detail) => {
  if (!ok) failed += 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${!ok && detail ? ` — ${detail}` : ''}`)
}

/* --------------------------------------------------------- a small canvas */

const demo = {
  nodes: [
    { id: 'n1', type: 'start', data: { label: '开始' } },
    { id: 'n2', type: 'calc', data: { label: '翻倍', expr: 'x = a * 2' } },
    { id: 'n3', type: 'judge', data: { label: '是否大于十', condition: 'x > 10' } },
    { id: 'n4', type: 'action', data: { label: '通过', action: 'APPROVE' } },
    { id: 'n5', type: 'end', data: { label: '通过' } },
    { id: 'n6', type: 'end', data: { label: '驳回' } },
  ],
  edges: [
    { id: 'e1', source: 'n1', target: 'n2' },
    { id: 'e2', source: 'n2', target: 'n3' },
    { id: 'e3', source: 'n3', target: 'n4', label: '是' },
    { id: 'e4', source: 'n3', target: 'n6', label: '否' },
    { id: 'e5', source: 'n4', target: 'n5' },
  ],
}

const pass = runCase(demo, { inputs: { a: 6 }, expect: {} })
check('arithmetic + judge picks the yes branch', pass.variables.x === 12 && pass.variables.__end === '通过', JSON.stringify(pass.variables))
check('status ok without expectations', pass.status === 'ok', pass.status)

const miss = runCase(demo, { inputs: { a: 3 }, expect: {} })
check('judge picks the no branch', miss.variables.__end === '驳回', miss.variables.__end)

const matched = runCase(demo, { inputs: { a: 6 }, expect: { x: 12 } })
check('matching expectation passes', matched.status === 'pass', matched.status)

const mismatched = runCase(demo, { inputs: { a: 6 }, expect: { x: 13 } })
check('mismatched expectation fails', mismatched.status === 'fail' && mismatched.mismatches.length === 1, mismatched.status)

const missing = runCase(demo, { inputs: {}, expect: {} })
check('missing input is an error naming the variable', missing.status === 'error' && missing.message.includes('缺少输入：a'), missing.message)

const unsupported = runCase(
  { nodes: [{ id: 'a', type: 'start', data: {} }, { id: 'b', type: 'judge', data: { condition: 'weird(a) > 1' } }], edges: [{ id: 'e', source: 'a', target: 'b' }] },
  { inputs: { a: 1 }, expect: {} },
)
check('unsupported function is inconclusive, not a pass', unsupported.status === 'inconclusive', unsupported.status)

check('splitAssignment ignores comparisons', JSON.stringify(splitAssignment('x == 1')) === 'null' && splitAssignment('指标 = 基数 * 系数')[0] === '指标')


const mismatchNode = runCase(demo, { inputs: { a: 6 }, expect: { x: 13 }, rule: 'n3' })
check('failed expectation reports the rule node', mismatchNode.nodeId === 'n3', String(mismatchNode.nodeId))
check('missing input reports the failing node', missing.nodeId === 'n2', String(missing.nodeId))

const logic = {
  nodes: [
    { id: 's', type: 'start', data: {} },
    { id: 'j', type: 'judge', data: { label: '组合条件', condition: 'a > 3 AND b == "x"' } },
    { id: 'y', type: 'end', data: { label: '命中' } },
    { id: 'n', type: 'end', data: { label: '未命中' } },
  ],
  edges: [
    { id: 'e1', source: 's', target: 'j' },
    { id: 'e2', source: 'j', target: 'y', label: '是' },
    { id: 'e3', source: 'j', target: 'n', label: '否' },
  ],
}
check('AND logic hits', runCase(logic, { inputs: { a: 5, b: 'x' }, expect: {} }).variables.__end === '命中')
check('AND logic misses on one clause', runCase(logic, { inputs: { a: 5, b: 'y' }, expect: {} }).variables.__end === '未命中')

const fn = {
  nodes: [
    { id: 's', type: 'start', data: {} },
    { id: 'c', type: 'calc', data: { expr: 'y = round(min(a, b) * 0.3, 2)' } },
    { id: 'e', type: 'end', data: {} },
  ],
  edges: [{ id: 'e1', source: 's', target: 'c' }, { id: 'e2', source: 'c', target: 'e' }],
}
check('functions evaluate', runCase(fn, { inputs: { a: 100, b: 50 }, expect: { y: 15 } }).status === 'pass')

/* ----------------------------------------------------------- cyclic graph */

const cyclic = {
  nodes: [
    { id: 's', type: 'start', data: { label: '开始' } },
    { id: 'a', type: 'action', data: { label: '处理' } },
    { id: 'b', type: 'action', data: { label: '回退' } },
  ],
  edges: [
    { id: 'e1', source: 's', target: 'a' },
    { id: 'e2', source: 'a', target: 'b' },
    { id: 'e3', source: 'b', target: 'a' },
  ],
}
const loop = runCase(cyclic, { inputs: {}, expect: {} })
check('cycles stop at the first repeated node', loop.status === 'ok' && loop.trace.some((item) => item.detail && item.detail.includes('汇合')), JSON.stringify(loop.trace.slice(-3)))

/* --------------------------------------------------- nested rule fixture */

const nested = {
  project: { name: '通用审批示例' },
  nodes: [
    { id: 's', type: 'start', data: { label: '流程入口' } },
    { id: 'j1', type: 'judge', data: { label: '是否例外', condition: '状态 == "例外"' } },
    { id: 'm1', type: 'module', data: { label: '例外处理' } },
    { id: 's1', type: 'start', parentId: 'm1', data: { label: '进入例外处理' } },
    { id: 'c1', type: 'calc', parentId: 'm1', data: { label: '结论', expr: '结论 = "例外"' } },
    { id: 'e1', type: 'end', parentId: 'm1', data: { label: '例外处理结束' } },
    { id: 'j2', type: 'judge', data: { label: '是否高优先', condition: '等级 == "高"' } },
    { id: 'm2', type: 'module', data: { label: '高优先处理' } },
    { id: 's2', type: 'start', parentId: 'm2', data: { label: '进入高优先处理' } },
    { id: 'c2', type: 'calc', parentId: 'm2', data: { label: '结论', expr: '结论 = "高"' } },
    { id: 'e2', type: 'end', parentId: 'm2', data: { label: '高优先处理结束' } },
    { id: 'j3', type: 'judge', data: { label: '是否低优先', condition: '等级 == "低"' } },
    { id: 'm3', type: 'module', data: { label: '低优先处理' } },
    { id: 's3', type: 'start', parentId: 'm3', data: { label: '进入低优先处理' } },
    { id: 'c3', type: 'calc', parentId: 'm3', data: { label: '结论', expr: '结论 = "低"' } },
    { id: 'e3', type: 'end', parentId: 'm3', data: { label: '低优先处理结束' } },
    { id: 'end', type: 'end', data: { label: '流程结束' } },
  ],
  edges: [
    { id: 'e_s1', source: 's', target: 'j1' },
    { id: 'e1y', source: 'j1', target: 'm1', label: '是' },
    { id: 'e1n', source: 'j1', target: 'j2', label: '否' },
    { id: 'e2y', source: 'j2', target: 'm2', label: '是' },
    { id: 'e2n', source: 'j2', target: 'j3', label: '否' },
    { id: 'e3y', source: 'j3', target: 'm3', label: '是' },
    { id: 'e3n', source: 'j3', target: 'end', label: '否' },
    { id: 'em1', source: 'm1', target: 'end' },
    { id: 'em2', source: 'm2', target: 'end' },
    { id: 'em3', source: 'm3', target: 'end' },
    { id: 'e_m1s', source: 's1', target: 'c1' },
    { id: 'e_m1e', source: 'c1', target: 'e1' },
    { id: 'e_m2s', source: 's2', target: 'c2' },
    { id: 'e_m2e', source: 'c2', target: 'e2' },
    { id: 'e_m3s', source: 's3', target: 'c3' },
    { id: 'e_m3e', source: 'c3', target: 'e3' },
  ],
}

const cases = generateCases(nested)
check('generates one case pair per root judge', cases.length === 6, String(cases.length))
const names = inputNames(nested)
check('derives inputs from conditions and formulas', names.includes('状态') && names.includes('等级'), JSON.stringify(names))
const suite = runSuite(
  nested,
  cases.map((testCase) => ({ ...testCase, inputs: { 状态: '其他', 等级: '高', ...testCase.inputs } })),
)
check('suite runs without errors', suite.summary.error === 0, JSON.stringify(suite.summary))
check('suite has 6 cases', suite.summary.total === 6, JSON.stringify(suite.summary))

const exception = runCase(nested, { inputs: { 状态: '例外', 等级: '高' }, expect: { 结论: '例外' } })
check('exception branch reaches its module end', exception.status === 'pass' && exception.trace.some((item) => item.detail && item.detail.includes('例外处理结束')), JSON.stringify(exception.trace.slice(-3)))
const high = runCase(nested, { inputs: { 状态: '其他', 等级: '高' }, expect: { 结论: '高' } })
check('high-priority branch reaches its module end', high.status === 'pass' && high.trace.some((item) => item.detail && item.detail.includes('高优先处理结束')), JSON.stringify(high.trace.slice(-3)))
const low = runCase(nested, { inputs: { 状态: '其他', 等级: '低' }, expect: { 结论: '低' } })
check('low-priority branch reaches its module end', low.status === 'pass' && low.trace.some((item) => item.detail && item.detail.includes('低优先处理结束')), JSON.stringify(low.trace.slice(-3)))

process.exit(failed === 0 ? 0 : 1)
