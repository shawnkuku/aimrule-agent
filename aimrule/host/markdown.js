/* Human-readable Markdown flow files with a machine JSON fence. */

import { mkdir, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { normalizeState } from './state.js'

function oneLine(value, max = 600) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, max)
}

function quoteMarkdown(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join('\n')
}

export function serializeStateMarkdown(id, state) {
  const name = oneLine(state.project && state.project.name, 160) || '未命名流程图'
  const description = oneLine(state.project && state.project.description, 600)
  const updatedAt = state.updatedAt || new Date().toISOString()
  const lines = []
  lines.push('---', 'aimrule: 1', `id: ${JSON.stringify(id)}`, `name: ${JSON.stringify(name)}`)
  lines.push(`description: ${JSON.stringify(description)}`, `updatedAt: ${JSON.stringify(updatedAt)}`, '---', '')
  lines.push(`# ${name}`, '')
  if (description) lines.push(`> ${description}`, '')
  lines.push('> 本文件由 AimRule 生成。上方是可读摘要，保存时会重写；机器数据在文末的 `aimrule` 围栏中。', '')
  lines.push('## 节点', '')
  if (state.nodes.length === 0) lines.push('_暂无节点。_', '')
  for (const node of state.nodes) {
    const data = node.data || {}
    const position = node.pos || { x: 0, y: 0 }
    lines.push(`### ${oneLine(data.label || node.id, 120)} · ${node.type} · \`${node.id}\``)
    lines.push('')
    lines.push(`- 类型：${node.type}`)
    if (node.parentId) lines.push(`- 父模块：\`${node.parentId}\``)
    lines.push(`- 位置：${Math.round(Number(position.x) || 0)}, ${Math.round(Number(position.y) || 0)}`)
    if (data.condition) lines.push(`- 条件：${oneLine(data.condition)}`)
    if (data.action) lines.push(`- 动作：${oneLine(data.action)}`)
    if (data.expr) lines.push(`- 公式：${oneLine(data.expr)}`)
    if (data.sourceRef) lines.push(`- 来源：${oneLine(data.sourceRef)}`)
    if (data.notes) lines.push(`- 备注：${oneLine(data.notes)}`)
    lines.push('')
  }
  lines.push('## 连线', '')
  if (state.edges.length === 0) lines.push('_暂无连线。_', '')
  for (const edge of state.edges) {
    lines.push(`- \`${edge.source}\` → \`${edge.target}\`${edge.label ? `（${oneLine(edge.label, 40)}）` : ''}`)
  }
  lines.push('')
  if (state.sources.length > 0) {
    lines.push('## 来源', '')
    for (const source of state.sources) {
      lines.push(`### ${oneLine(source.title || source.id, 200)}`, '')
      if (source.text) lines.push(quoteMarkdown(source.text.slice(0, 4000)), '')
    }
  }
  if (state.tests.length > 0 || Object.keys(state.testInputs || {}).length > 0) {
    lines.push('## 测试', '')
    if (Object.keys(state.testInputs || {}).length > 0) lines.push(`- 默认输入：\`${JSON.stringify(state.testInputs)}\``)
    for (const test of state.tests) {
      lines.push(`- ${oneLine(test.name || test.id)}${test.rule ? ` · 规则 \`${test.rule}\`` : ''}`)
      if (Object.keys(test.inputs || {}).length > 0) lines.push(`  - 输入：\`${JSON.stringify(test.inputs)}\``)
      if (Object.keys(test.expect || {}).length > 0) lines.push(`  - 期望：\`${JSON.stringify(test.expect)}\``)
    }
    lines.push('')
  }
  if (state.templates.length > 0) {
    lines.push('## 模板', '')
    for (const template of state.templates) {
      lines.push(`- ${oneLine(template.name || template.id)}（${template.nodes.length} 节点，${template.edges.length} 连线）`)
    }
    lines.push('')
  }
  lines.push('## 机器数据', '')
  lines.push('<!-- 保存时重写上方摘要；插件读取下面 aimrule 围栏中的 JSON。 -->')
  lines.push('```aimrule')
  lines.push(JSON.stringify(state, null, 2))
  lines.push('```', '')
  return lines.join('\n')
}

export function parseStateMarkdown(text) {
  const source = String(text || '')
  const pattern = /^```aimrule[^\n]*\r?\n([\s\S]*?)\r?\n```[ \t]*$/gm
  let match
  let last = null
  while ((match = pattern.exec(source))) last = match
  if (!last) throw new Error('缺少 aimrule 机器数据围栏')
  let raw
  try {
    raw = JSON.parse(last[1])
  } catch (error) {
    throw new Error(`aimrule 围栏 JSON 解析失败：${error.message}`)
  }
  return normalizeState(raw)
}

export async function writeStateMarkdown(file, id, state) {
  await mkdir(dirname(file), { recursive: true })
  const temp = `${file}.${process.pid}.${Date.now()}.tmp`
  await writeFile(temp, serializeStateMarkdown(id, state), 'utf8')
  await rename(temp, file)
}
