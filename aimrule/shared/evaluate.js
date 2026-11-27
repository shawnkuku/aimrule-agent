/**
 * AimRule rule evaluator.
 *
 * A small, deterministic expression language so a canvas can be executed
 * without `eval`: comparisons, boolean logic and arithmetic on strings and
 * numbers. Anything outside that subset is reported as inconclusive instead of
 * being silently mis-judged.
 */

export const STATUS = {
  pass: 'pass',
  fail: 'fail',
  ok: 'ok',
  inconclusive: 'inconclusive',
  error: 'error',
}

class EvalProblem extends Error {
  constructor(kind, message) {
    super(message)
    this.kind = kind
  }
}

/* --------------------------------------------------------------- tokenizer */

const IDENT_START = /[\p{L}_]/u
const IDENT_PART = /[\p{L}\p{N}_]/u
const WORD_OPERATORS = new Set(['AND', 'OR', 'NOT', 'TRUE', 'FALSE', 'NULL'])

function tokenize(source) {
  const tokens = []
  const text = String(source || '')
  let index = 0
  while (index < text.length) {
    const char = text[index]
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (char === '"' || char === "'") {
      const quote = char
      let value = ''
      index += 1
      while (index < text.length && text[index] !== quote) {
        if (text[index] === '\\' && index + 1 < text.length) {
          index += 1
          value += text[index]
        } else {
          value += text[index]
        }
        index += 1
      }
      if (index >= text.length) throw new EvalProblem('error', '字符串没有闭合')
      index += 1
      tokens.push({ type: 'literal', value })
      continue
    }
    if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(text[index + 1] || ''))) {
      let raw = ''
      while (index < text.length && /[0-9.]/.test(text[index])) {
        raw += text[index]
        index += 1
      }
      const value = Number(raw)
      if (!Number.isFinite(value)) throw new EvalProblem('error', `非法数字：${raw}`)
      tokens.push({ type: 'literal', value })
      continue
    }
    if (IDENT_START.test(char)) {
      let raw = ''
      while (index < text.length && IDENT_PART.test(text[index])) {
        raw += text[index]
        index += 1
      }
      const upper = raw.toUpperCase()
      if (WORD_OPERATORS.has(upper)) {
        if (upper === 'TRUE') tokens.push({ type: 'literal', value: true })
        else if (upper === 'FALSE') tokens.push({ type: 'literal', value: false })
        else if (upper === 'NULL') tokens.push({ type: 'literal', value: null })
        else tokens.push({ type: 'op', value: upper === 'AND' ? '&&' : upper === 'OR' ? '||' : '!' })
      } else {
        tokens.push({ type: 'ident', value: raw })
      }
      continue
    }
    const two = text.slice(index, index + 2)
    if (['==', '!=', '>=', '<=', '&&', '||'].includes(two)) {
      tokens.push({ type: 'op', value: two })
      index += 2
      continue
    }
    if ('><+-*/%!(),'.includes(char)) {
      tokens.push({ type: 'op', value: char })
      index += 1
      continue
    }
    throw new EvalProblem('error', `无法识别的字符：${char}`)
  }
  return tokens
}

/* ------------------------------------------------------------------ parser */

function parseExpression(source) {
  const tokens = tokenize(source)
  let cursor = 0
  const peek = () => tokens[cursor]
  const next = () => tokens[cursor++]
  const expectOp = (value) => {
    const token = next()
    if (!token || token.type !== 'op' || token.value !== value) throw new EvalProblem('error', `缺少 “${value}”`)
    return token
  }

  const parseOr = () => {
    let left = parseAnd()
    while (peek() && peek().type === 'op' && peek().value === '||') {
      next()
      left = { kind: 'binary', op: '||', left, right: parseAnd() }
    }
    return left
  }

  const parseAnd = () => {
    let left = parseCompare()
    while (peek() && peek().type === 'op' && peek().value === '&&') {
      next()
      left = { kind: 'binary', op: '&&', left, right: parseCompare() }
    }
    return left
  }

  const parseCompare = () => {
    const left = parseAdditive()
    const token = peek()
    if (token && token.type === 'op' && ['==', '!=', '>=', '<=', '>', '<'].includes(token.value)) {
      next()
      return { kind: 'binary', op: token.value, left, right: parseAdditive() }
    }
    return left
  }

  const parseAdditive = () => {
    let left = parseMultiplicative()
    while (peek() && peek().type === 'op' && ['+', '-'].includes(peek().value)) {
      const op = next().value
      left = { kind: 'binary', op, left, right: parseMultiplicative() }
    }
    return left
  }

  const parseMultiplicative = () => {
    let left = parseUnary()
    while (peek() && peek().type === 'op' && ['*', '/', '%'].includes(peek().value)) {
      const op = next().value
      left = { kind: 'binary', op, left, right: parseUnary() }
    }
    return left
  }

  const parseUnary = () => {
    const token = peek()
    if (token && token.type === 'op' && token.value === '!') {
      next()
      return { kind: 'unary', op: '!', value: parseUnary() }
    }
    if (token && token.type === 'op' && token.value === '-') {
      next()
      return { kind: 'unary', op: '-', value: parseUnary() }
    }
    return parsePrimary()
  }

  const parsePrimary = () => {
    const token = next()
    if (!token) throw new EvalProblem('error', '表达式不完整')
    if (token.type === 'literal') return { kind: 'literal', value: token.value }
    if (token.type === 'ident') {
      if (peek() && peek().type === 'op' && peek().value === '(') {
        next()
        const args = []
        if (peek() && peek().type === 'op' && peek().value === ')') next()
        else {
          args.push(parseOr())
          while (peek() && peek().type === 'op' && peek().value === ',') {
            next()
            args.push(parseOr())
          }
          expectOp(')')
        }
        return { kind: 'call', name: token.value, args }
      }
      return { kind: 'ident', name: token.value }
    }
    if (token.type === 'op' && token.value === '(') {
      const value = parseOr()
      expectOp(')')
      return value
    }
    throw new EvalProblem('error', `意外的符号：${token.value}`)
  }

  const ast = parseOr()
  if (cursor < tokens.length) throw new EvalProblem('error', `表达式尾部有多余内容：${tokens[cursor].value}`)
  return ast
}

/* ------------------------------------------------------------------ evaluator */

function toComparable(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (trimmed !== '' && Number.isFinite(Number(trimmed))) return Number(trimmed)
    return value
  }
  return value
}

function compare(op, left, right) {
  if (op === '==') return toComparable(left) === toComparable(right)
  if (op === '!=') return toComparable(left) !== toComparable(right)
  const a = toComparable(left)
  const b = toComparable(right)
  if (op === '>') return a > b
  if (op === '<') return a < b
  if (op === '>=') return a >= b
  if (op === '<=') return a <= b
  return false
}

const FUNCTIONS = {
  min: (...args) => Math.min(...args.map(Number)),
  max: (...args) => Math.max(...args.map(Number)),
  abs: (value) => Math.abs(Number(value)),
  round: (value, digits) => {
    const factor = 10 ** (digits === undefined ? 0 : Number(digits))
    return Math.round(Number(value) * factor) / factor
  },
  floor: (value) => Math.floor(Number(value)),
  ceil: (value) => Math.ceil(Number(value)),
  len: (value) => String(value).length,
  contains: (haystack, needle) => String(haystack).includes(String(needle)),
  lower: (value) => String(value).toLowerCase(),
  upper: (value) => String(value).toUpperCase(),
  number: (value) => Number(value),
  text: (value) => String(value),
}

function evaluateAst(ast, variables) {
  switch (ast.kind) {
    case 'literal':
      return ast.value
    case 'ident': {
      const value = variables.get(ast.name)
      if (!variables.has(ast.name) || value === null || value === undefined) {
        throw new EvalProblem('missing', `缺少输入：${ast.name}`)
      }
      return value
    }
    case 'unary': {
      const value = evaluateAst(ast.value, variables)
      return ast.op === '!' ? !truthy(value) : -Number(value)
    }
    case 'binary': {
      if (ast.op === '&&') return truthy(evaluateAst(ast.left, variables)) ? truthy(evaluateAst(ast.right, variables)) : false
      if (ast.op === '||') return truthy(evaluateAst(ast.left, variables)) ? true : truthy(evaluateAst(ast.right, variables))
      const left = evaluateAst(ast.left, variables)
      const right = evaluateAst(ast.right, variables)
      if (['==', '!=', '>', '<', '>=', '<='].includes(ast.op)) return compare(ast.op, left, right)
      if (ast.op === '+') {
        if (typeof left === 'string' || typeof right === 'string') return String(left) + String(right)
        return Number(left) + Number(right)
      }
      if (ast.op === '-') return Number(left) - Number(right)
      if (ast.op === '*') return Number(left) * Number(right)
      if (ast.op === '/') return Number(left) / Number(right)
      if (ast.op === '%') return Number(left) % Number(right)
      return null
    }
    case 'call': {
      const fn = FUNCTIONS[ast.name]
      if (!fn) throw new EvalProblem('inconclusive', `不支持的函数：${ast.name}`)
      return fn(...ast.args.map((arg) => evaluateAst(arg, variables)))
    }
    default:
      throw new EvalProblem('error', '未知表达式')
  }
}

function truthy(value) {
  if (typeof value === 'string') {
    const text = value.trim().toLowerCase()
    if (['false', 'no', '否', '0', ''].includes(text)) return false
    return text.length > 0
  }
  return Boolean(value)
}

/* ------------------------------------------------------------------ helpers */

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function childrenOf(nodes, parentId) {
  return nodes.filter((node) => (node.parentId || null) === (parentId || null))
}

function outgoing(edges, id) {
  return edges.filter((edge) => edge.source === id)
}

function labelKind(label) {
  const text = String(label || '').trim().toLowerCase()
  if (['是', '真', 'yes', 'true', 'y'].includes(text)) return 'yes'
  if (['否', '假', 'no', 'false', 'n', '其他'].includes(text)) return 'no'
  return ''
}

/** Split `name = expr` from a calc expression, ignoring comparisons. */
export function splitAssignment(expression) {
  const text = String(expression || '')
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== '=') continue
    const before = text[index - 1]
    const after = text[index + 1]
    if (['=', '!', '<', '>', ':'].includes(before) || after === '=') continue
    const target = text.slice(0, index).trim()
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(target)) return null
    return [target, text.slice(index + 1).trim()]
  }
  return null
}

/** Names assigned anywhere by calc nodes (so they are derived, not inputs). */
function nodeList(input) {
  if (Array.isArray(input)) return input
  return input && Array.isArray(input.nodes) ? input.nodes : []
}

export function assignedNames(input) {
  const nodes = nodeList(input)
  const names = new Set()
  for (const node of nodes) {
    if (node.type !== 'calc') continue
    const split = splitAssignment((node.data || {}).expr)
    if (split) names.add(split[0])
  }
  return names
}

/** Input names referenced by conditions, minus derived names. */
export function inputNames(input) {
  const nodes = nodeList(input)
  const assigned = assignedNames(nodes)
  const names = new Set()
  for (const node of nodes) {
    const data = node.data || {}
    const sources = [data.condition, node.type === 'calc' ? (splitAssignment(data.expr) || [])[1] : '']
    for (const source of sources) {
      if (!source) continue
      let tokens
      try {
        tokens = tokenize(source)
      } catch {
        continue
      }
      for (const token of tokens) {
        if (token.type !== 'ident') continue
        if (assigned.has(token.value)) continue
        if (Object.prototype.hasOwnProperty.call(FUNCTIONS, token.value)) continue
        names.add(token.value)
      }
    }
  }
  return [...names]
}

/* --------------------------------------------------------------- run a case */

/**
 * Execute one case against the canvas.
 * @param doc - the canvas document.
 * @param testCase - `{ inputs, expect }`.
 */
export function runCase(doc, testCase) {
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : []
  const edges = Array.isArray(doc.edges) ? doc.edges : []
  const variables = new Map()
  const inputs = isObject(testCase && testCase.inputs) ? testCase.inputs : {}
  for (const [key, value] of Object.entries(inputs)) variables.set(key, value)
  const trace = []
  const visited = new Set()
  let status = STATUS.ok
  let message = ''
  let currentNodeId = null

  const step = (node, detail) => {
    trace.push({ nodeId: node.id, kind: node.type, detail })
  }

  const walk = (scope, depth) => {
    if (depth > 24) throw new EvalProblem('inconclusive', '模块嵌套过深')
    const scopeNodes = childrenOf(nodes, scope)
    if (scopeNodes.length === 0) return
    const starts = scopeNodes.filter((node) => node.type === 'start')
    let node = starts[0] || scopeNodes[0]
    let steps = 0
    while (node && steps < 500) {
      steps += 1
      currentNodeId = node.id
      if (visited.has(node.id)) {
        step(node, '汇合，停止')
        return
      }
      visited.add(node.id)
      const data = node.data || {}

      if (node.type === 'judge') {
        const condition = String(data.condition || '').trim()
        if (!condition) throw new EvalProblem('error', `判断节点「${data.label || node.id}」缺少条件`)
        let result
        try {
          result = truthy(evaluateAst(parseExpression(condition), variables))
        } catch (error) {
          if (error instanceof EvalProblem) {
            if (error.kind === 'inconclusive') throw error
            throw new EvalProblem(error.kind, `判断「${data.label || node.id}」：${error.message}`)
          }
          throw error
        }
        step(node, `${condition} → ${result ? '是' : '否'}`)
        const outs = outgoing(edges, node.id)
        const want = result ? 'yes' : 'no'
        const picked =
          outs.find((edge) => labelKind(edge.label) === want) ||
          outs.find((edge) => !String(edge.label || '').trim()) ||
          outs[0]
        if (!picked) return
        node = nodes.find((item) => item.id === picked.target)
        continue
      }

      if (node.type === 'calc') {
        const expression = String(data.expr || '').trim()
        if (expression) {
          const split = splitAssignment(expression)
          try {
            if (split) {
              const value = evaluateAst(parseExpression(split[1]), variables)
              variables.set(split[0], value)
              step(node, `${split[0]} = ${JSON.stringify(value)}`)
            } else {
              evaluateAst(parseExpression(expression), variables)
              step(node, expression)
            }
          } catch (error) {
            if (error instanceof EvalProblem) {
              if (error.kind === 'inconclusive') throw error
              throw new EvalProblem(error.kind, `计算「${data.label || node.id}」：${error.message}`)
            }
            throw error
          }
        } else {
          step(node, '无公式')
        }
      } else if (node.type === 'module') {
        step(node, '进入模块')
        walk(node.id, depth + 1)
      } else if (node.type === 'end') {
        step(node, `返回：${data.label || node.id}`)
        variables.set('__end', data.label || node.id)
        return
      } else if (node.type === 'action') {
        step(node, data.action || data.label || '动作')
      } else {
        step(node, data.label || node.type)
      }

      const outs = outgoing(edges, node.id)
      if (node.type === 'judge') continue
      if (outs.length === 0) return
      node = nodes.find((item) => item.id === outs[0].target)
    }
  }

  try {
    walk(null, 0)
  } catch (error) {
    if (error instanceof EvalProblem) {
      return {
        status: error.kind === 'inconclusive' ? STATUS.inconclusive : STATUS.error,
        trace,
        variables: Object.fromEntries(variables),
        mismatches: [],
        message: error.message,
        nodeId: currentNodeId,
      }
    }
    return {
      status: STATUS.error,
      trace,
      variables: Object.fromEntries(variables),
      mismatches: [],
      message: error.message || String(error),
      nodeId: currentNodeId,
    }
  }

  const expect = isObject(testCase && testCase.expect) ? testCase.expect : {}
  const mismatches = []
  for (const [key, expected] of Object.entries(expect)) {
    if (expected === null || expected === undefined || expected === '') continue
    const actual = variables.has(key) ? variables.get(key) : undefined
    if (!compare('==', actual, expected)) mismatches.push({ key, expected, actual })
  }
  if (mismatches.length > 0) status = STATUS.fail
  else if (Object.keys(expect).length > 0) status = STATUS.pass

  return {
    status,
    trace,
    variables: Object.fromEntries(variables),
    mismatches,
    message: mismatches.length > 0 ? `${mismatches.length} 项期望值不一致` : '',
    nodeId: status === STATUS.fail ? (testCase && testCase.rule) || currentNodeId : null,
  }
}

/* ------------------------------------------------------------ case generator */

function literalOf(ast) {
  if (!ast) return null
  if (ast.kind === 'literal') return { value: ast.value }
  if (ast.kind === 'unary' && ast.op === '-' && ast.value && ast.value.kind === 'literal') return { value: -Number(ast.value.value) }
  return null
}

function altValue(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value + 1 : '其他'
  if (typeof value === 'boolean') return !value
  return '其他'
}

/**
 * Derive starter cases from the root-scope judges.
 * @param doc - the canvas document.
 */
export function generateCases(doc) {
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : []
  const rootJudges = nodes.filter((node) => node.type === 'judge' && !node.parentId)
  const cases = []
  let index = 0
  for (const judge of rootJudges) {
    index += 1
    const data = judge.data || {}
    let condition = null
    try {
      condition = parseExpression(String(data.condition || ''))
    } catch {
      condition = null
    }
    const equality =
      condition && condition.kind === 'binary' && (condition.op === '==' || condition.op === '!=')
        ? condition.left.kind === 'ident'
          ? { name: condition.left.name, literal: literalOf(condition.right), negate: condition.op === '!=' }
          : condition.right.kind === 'ident'
            ? { name: condition.right.name, literal: literalOf(condition.left), negate: condition.op === '!=' }
            : null
        : null

    if (equality && equality.literal) {
      const hit = equality.negate ? altValue(equality.literal.value) : equality.literal.value
      const miss = equality.negate ? equality.literal.value : altValue(equality.literal.value)
      cases.push({
        id: `case_${index}_true`,
        name: `「${data.label || judge.id}」命中`,
        inputs: { [equality.name]: hit },
        expect: {},
        rule: judge.id,
      })
      cases.push({
        id: `case_${index}_false`,
        name: `「${data.label || judge.id}」未命中`,
        inputs: { [equality.name]: miss },
        expect: {},
        rule: judge.id,
      })
    } else {
      cases.push({
        id: `case_${index}`,
        name: `「${data.label || judge.id}」路径`,
        inputs: {},
        expect: {},
        rule: judge.id,
      })
    }
  }
  if (cases.length === 0) {
    cases.push({ id: 'case_1', name: '默认跑通', inputs: {}, expect: {} })
  }
  return cases
}

/** Run every case and summarize. */
export function runSuite(doc, cases) {
  const list = Array.isArray(cases) ? cases : []
  const results = list.map((testCase) => {
    const outcome = runCase(doc, testCase)
    return {
      id: testCase.id,
      name: testCase.name,
      status: outcome.status,
      message: outcome.message,
      mismatches: outcome.mismatches,
    }
  })
  const summary = { total: results.length, pass: 0, fail: 0, error: 0, inconclusive: 0, ok: 0 }
  for (const result of results) summary[result.status] = (summary[result.status] || 0) + 1
  return { results, summary }
}
