/* LLM prompts, streaming JSON completion, and bounded repair retries. */

const MAX_OUTPUT_TOKENS = 32000

/* -------------------------------------------------------------------- llm */

export const EXTRACT_SYSTEM = `你是 AimRule 的业务规则建模引擎。把用户给出的政策条文/对话记录/业务描述提炼成可执行的业务规则图。

输出必须是一个 JSON 对象，不要输出任何解释、Markdown 代码块或前后缀文字。结构：
{
  "project": { "name": "不超过 20 字的业务名", "description": "一句话说明" },
  "nodes": [
    { "id": "n1", "type": "start|judge|calc|action|end|module", "parentId": null,
      "data": { "label": "节点名", "condition": "判断表达式", "action": "执行动作", "expr": "计算公式",
                "sourceRef": "对应原文的短句（必须逐字摘录，不超过 40 字）", "notes": "隐含前提或口径" } }
  ],
  "edges": [ { "id": "e1", "source": "n1", "target": "n2", "label": "是|否|其他分支名" } ],
  "notes": ["需要人工确认的歧义点"]
}

建模规则：
1. 只使用这 6 种 type。judge 必须给出可判定的 condition（用 ==、!=、>、<、AND、OR、IN 等），并显式分出“是/否”两条边；没有穷尽的分支要在 notes 里写明。
2. calc 必须给出 expr（四则运算、查表或函数调用）；查表要写出表名与键。
3. 每个节点都要有 sourceRef，逐字引用原文；原文没有明说的推导，sourceRef 写“推导”，并在 notes 说明依据。
4. 存在并列的子规则、多个条款、或可复用的一段逻辑时，用 module 节点承载：先建 module 节点，再把它内部节点以 parentId 指向该 module。模块内部同样需要 start 与 end。
5. 不要编造原文中不存在的阈值、比例、时限、名单；缺失就留空并在 notes 标记【待补充】。
6. 节点数量控制在 120 个以内；id 使用 n1、n2……，边使用 e1、e2……。
7. 返回严格合法的 JSON：不要注释、不要尾逗号、不要 Markdown。
8. 输出紧凑 JSON：不要缩进或多余空白，数组和对象尽量写成单行，以节省输出长度。\n9. 默认无环。只有原文明确要求返工、复核或回退循环时才允许闭环；闭环必须能从 judge 分支退出，不能形成没有结束节点的死循环。`

export const TEST_SYSTEM = `你是 AimRule 的测试用例生成器。给定业务规则图（节点、连线、判断条件、计算公式），生成可执行的测试用例。

只返回 JSON 对象，不要 Markdown：
{ "defaults": { "变量": 值 }, "cases": [ { "id": "case_1", "name": "用例名", "rule": "覆盖到的 judge 节点 id，没有就空字符串", "inputs": { "变量": 值 }, "expect": { "计算结果": 值 } } ], "notes": ["需要人工确认的点"] }

规则：
1. 生成 6-12 条用例，覆盖每个 judge 的是/否路径，并补边界值、缺失输入和模块分支。
2. inputs 的键只能来自条件或公式里的变量名；值只能是字符串、数字或布尔值。
3. expect 的键必须是 calc 公式的赋值目标；无法确定期望值时写 {}，让运行只检查跑通。
4. 不要写代码、函数、对象或数组作为输入/期望值。
5. 只返回紧凑 JSON，不要注释、尾逗号或 Markdown。`

export const MODIFY_SYSTEM = `你是 AimRule 的局部改造引擎。用户框选了画布上的一部分节点并给出自然语言指令，你只能修改这部分逻辑，返回一个补丁 JSON。

输出必须是 JSON 对象，不要输出任何解释或 Markdown。结构：
{
  "addNodes": [ { "id": "n_new_1", "type": "judge|calc|action|module|start|end", "parentId": null,
                  "data": { "label": "", "condition": "", "action": "", "expr": "", "sourceRef": "", "notes": "" } } ],
  "updateNodes": [ { "id": "已有节点 id", "data": { "label": "", "condition": "", "action": "", "expr": "", "sourceRef": "", "notes": "" } } ],
  "removeNodes": [ "已有节点 id" ],
  "addEdges": [ { "id": "e_new_1", "source": "节点 id", "target": "节点 id", "label": "是|否|" } ],
  "removeEdges": [ "已有边 id" ],
  "explanation": "一句话说明改了什么"
}

约束：
1. 未涉及语义的已有节点原样保留，不要重写全部图。
2. 新增节点的 id 必须以 n_new_ 开头并全局唯一；新增边以 e_new_ 开头。
3. updateNodes 只写需要变化的字段（data 下的键），不要清空未提供的字段。
4. 指令要求新增阻断/例外时，必须同时保证存在显式的“否”分支，不允许逻辑悬空。
5. sourceRef 引用原文；指令本身是新规则时写“用户指令”。
6. 指令里出现的每个动作（如“解除合同”“停发”“延后”）都必须由 action 或 calc 节点承载，不能只画判断。
7. 每个新增节点都必须接到图上（addEdges），不得悬空；新增 judge 必须有“是/否”两条出边。
8. 同一 judge 的同一分支标签只能有一条出边：新判断取代旧分支时，必须用 removeEdges 删除被取代的旧边。
9. 返回严格合法的 JSON，且使用紧凑格式（不要缩进或多余空白）。`

export const MODULE_DETECT_SYSTEM = `你是 AimRule 的复用模块检测器。输入是同一工作区多个流程图的 JSON 数组，每个元素包含 id、name、nodes、edges。
目标：找出在两个及以上流程图中重复出现（或同一流程图中重复出现）的可复用子图，建议抽成模块。

判断标准：
- 2-12 个节点，内部连通，且所有节点 parentId 相同（同一层级）。
- 语义相同的业务判断/动作/计算组合，措辞可以不同；不要只因为节点类型相同就报告。
- 只报告真正值得复用的逻辑，忽略一次性的细节。

输出严格 JSON：
{"candidates":[{"name":"不超过20字","reason":"一句话说明为什么可复用","occurrences":[{"flowId":"...","nodeIds":["..."]}]}]}

要求：
1. flowId 和 nodeIds 必须逐字来自输入，不能编造；每个 candidate 至少 2 个 occurrence，每个 occurrence 至少 2 个节点。
2. 优先跨不同流程图；找不到就返回 {"candidates":[]}。
3. 不要输出 Markdown、解释或前后缀文字。`

export class LlmUnavailable extends Error {}

function stripJson(text) {
  let body = String(text || '').trim()
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) body = fence[1].trim()
  const start = body.indexOf('{')
  const end = body.lastIndexOf('}')
  if (start >= 0 && end > start) body = body.slice(start, end + 1)
  return body
}

export async function completeJson(ctx, system, user, maxTokens = MAX_OUTPUT_TOKENS) {
  const llm = ctx.get('llm')
  if (!llm) throw new LlmUnavailable('LLM 服务未启用，无法调用模型')
  const selector = ctx.get('agentDefaultModel')
  const selection = selector && typeof selector.currentSelection === 'function' ? selector.currentSelection() : null
  const provider = selection && selection.provider
  const model = selection && selection.model
  if (!provider || !model) throw new LlmUnavailable('没有可用的默认模型，请先在 Harness 中设置模型')

  // DeepSeek defaults to `high` reasoning. For strict JSON extraction that
  // spends the output budget on hidden reasoning and can return no visible
  // text at all, so disable thinking for this structured call.
  const thinkingOff = typeof provider === 'string' && provider.includes('deepseek')

  const chunks = llm.stream({
    provider,
    model,
    system,
    messages: [{ role: 'user', content: [{ type: 'text', text: user }] }],
    temperature: 0.1,
    maxTokens,
    ...(thinkingOff ? { reasoningEffort: 'off' } : {}),
  })
  let text = ''
  let reasoningChars = 0
  let finish = ''
  let failure = null
  for await (const chunk of chunks) {
    if (chunk.type === 'text-delta') text += chunk.text
    else if (chunk.type === 'reasoning-delta') reasoningChars += (chunk.text || '').length
    else if (chunk.type === 'finish' && chunk.reason) {
      finish = chunk.reason.kind || ''
      if (chunk.reason.kind === 'error') failure = chunk.reason.failure
    }
  }
  if (failure) throw new Error(`模型调用失败：${failure.message}`)
  if (finish === 'length' && text.trim()) throw new Error('模型输出达到长度上限被截断，请缩小输入或减少节点后重试')
  if (!text.trim()) {
    const why = finish === 'length' ? '输出达到长度上限' : finish === 'aborted' ? '请求被中止' : '没有可见正文'
    throw new Error(`模型返回了空内容（${why}${reasoningChars > 0 ? `，隐藏在推理里的 ${reasoningChars} 字` : ''}）`)
  }
  return text
}

export async function generateWithRepair(ctx, system, user, validate, attempts = 3) {
  let lastError = ''
  let lastRaw = ''
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const suffix = attempt === 1 ? '' : `\n\n上一次输出未通过校验：${lastError}\n请修正后只返回完整 JSON。`
    let raw
    try {
      raw = await completeJson(ctx, system, user + suffix)
    } catch (error) {
      if (error instanceof LlmUnavailable) throw error
      lastError = error.message
      continue
    }
    lastRaw = raw
    let parsed
    try {
      parsed = JSON.parse(stripJson(raw))
    } catch (error) {
      lastError = `返回内容不是合法 JSON（${error.message}）`
      continue
    }
    const result = validate(parsed)
    if (result.issues.length === 0) return { value: result.value, attempts: attempt, raw }
    lastError = result.issues.slice(0, 6).join('；')
  }
  const error = new Error(`模型输出连续 ${attempts} 次未通过结构校验：${lastError}`)
  error.detail = { raw: lastRaw, lastError }
  throw error
}
