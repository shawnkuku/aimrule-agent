import { h, useState, useEffect, useRef, useMemo } from './react.js'
import { TYPE_META, posOf, baseName } from './flow-model.js'

export function AimRuleIcon({ size = 16 }) {
  return h(
    'svg',
    { width: size, height: size, viewBox: '0 0 64 64', 'aria-hidden': true, style: { display: 'block' } },
    h('rect', { x: 2, y: 2, width: 60, height: 60, rx: 17, fill: 'currentColor', opacity: 0.12 }),
    h('circle', { cx: 32, cy: 12, r: 3.2, fill: 'currentColor' }),
    h('path', { d: 'M32 15.5V21', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round' }),
    h('path', {
      d: 'M32 21 L42 31 L32 41 L22 31 Z',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 3,
      strokeLinejoin: 'round',
      strokeLinecap: 'round',
    }),
    h('path', { d: 'M22 31 H15 V47', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.78 }),
    h('path', { d: 'M42 31 H49 V47', fill: 'none', stroke: 'currentColor', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round' }),
    h('circle', { cx: 15, cy: 50, r: 2.6, fill: 'currentColor', opacity: 0.78 }),
    h('circle', { cx: 49, cy: 50, r: 2.6, fill: 'currentColor' }),
  )
}

export function AimRuleSidebarIcon({ size = 20 }) {
  return AimRuleIcon({ size })
}

export function NodeCard({ node, selected, connectTarget, childCount, onMouseDown, onDoubleClick, onConnectStart, onConnectEnd }) {
  const meta = TYPE_META[node.type] || TYPE_META.action
  const data = node.data || {}
  return h(
    'div',
    {
      className: 'aimrule-node',
      'data-node-id': node.id,
      'data-selected': selected,
      'data-connect-target': Boolean(connectTarget),
      'data-module': node.type === 'module',
      'data-type': node.type,
      style: { left: posOf(node).x, top: posOf(node).y },
      onMouseDown,
      onDoubleClick,
      onMouseUp: (event) => onConnectEnd(event, node.id),
      title: node.type === 'module' ? '双击进入模块内部' : `${meta.label}：${data.label || node.id}`,
    },
    h(
      'div',
      { className: 'aimrule-node-head' },
      h('span', { className: 'aimrule-node-glyph', style: { color: meta.color } }, meta.glyph),
      h('span', { className: 'aimrule-node-title' }, data.label || node.id),
      node.type === 'module' ? h('span', { className: 'aimrule-node-badge' }, `${childCount} 项`) : null,
    ),
    node.type === 'judge' && data.condition ? h('div', { className: 'aimrule-node-line' }, 'IF ', h('b', null, data.condition)) : null,
    node.type === 'calc' && data.expr ? h('div', { className: 'aimrule-node-line' }, data.expr.includes('=') ? null : '= ', h('b', null, data.expr)) : null,
    node.type !== 'judge' && node.type !== 'calc' && data.action ? h('div', { className: 'aimrule-node-line' }, data.action) : null,
    data.sourceRef ? h('div', { className: 'aimrule-node-src' }, '§ ', data.sourceRef) : null,
    h('div', {
      className: 'aimrule-handle',
      'data-side': 'in',
      title: '输入端点',
      onMouseDown: (event) => event.stopPropagation(),
      onMouseUp: (event) => onConnectEnd(event, node.id),
    }),
    h('div', {
      className: 'aimrule-handle',
      'data-side': 'out',
      title: '拖拽以连接',
      onMouseDown: (event) => onConnectStart(event, node),
      onMouseUp: (event) => event.stopPropagation(),
    }),
  )
}

export function ProjectPicker({ useWorkspaces, useSessions, value, onChange }) {
  const items = useWorkspaces((snapshot) => snapshot.items)
  const byId = useSessions((snapshot) => snapshot.byId)
  const didDefault = useRef(false)
  const [open, setOpen] = useState(false)

  const options = useMemo(() => {
    const list = (items || []).map((workspace) => ({
      path: workspace.path,
      title: workspace.title || baseName(workspace.path),
    }))
    if (value && !list.some((item) => item.path === value)) list.unshift({ path: value, title: baseName(value) })
    return list
  }, [items, value])

  useEffect(() => {
    if (didDefault.current) return
    didDefault.current = true
    let chosen = null
    try {
      chosen = window.localStorage.getItem('aimrule.project.chosen')
    } catch {
      chosen = null
    }
    if (chosen === '1' || value) return
    const rows = Object.values(byId || {}).filter((row) => row && row.cwd && row.origin !== 'subagent')
    rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    const candidate = rows.length > 0 && options.some((item) => item.path === rows[0].cwd) ? rows[0].cwd : options.length > 0 ? options[0].path : ''
    if (candidate) onChange(candidate)
  }, [byId, onChange, options, value])

  const current = options.find((item) => item.path === (value || ''))

  return h(
    'div',
    { className: 'aimrule-workspace' },
    h(
      'button',
      {
        className: 'aimrule-btn aimrule-workspace-trigger',
        'data-kind': 'ghost',
        title: value ? `当前工作区：${value}` : '全局工作区',
        onClick: () => setOpen((current) => !current),
      },
      h(
        'svg',
        { width: 13, height: 13, viewBox: '0 0 16 16', 'aria-hidden': true, style: { flex: 'none' } },
        h('path', {
          d: 'M1.5 3.5h4.2l1.2 1.4h7.6v7.6H1.5z',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.2,
          strokeLinejoin: 'round',
        }),
      ),
      h('span', { className: 'aimrule-workspace-name' }, value ? (current ? current.title : baseName(value)) : '全局画布'),
      h('span', { style: { opacity: 0.6 } }, '▾'),
    ),
    open
      ? h(
          'div',
          { className: 'aimrule-flow-menu aimrule-workspace-menu' },
          h(
            'button',
            {
              className: 'aimrule-flow-option',
              'data-active': !value,
              onClick: () => {
                onChange('')
                setOpen(false)
              },
            },
            h('span', { className: 'aimrule-flow-option-name' }, '全局画布'),
          ),
          ...options.map((item) =>
            h(
              'button',
              {
                key: item.path,
                className: 'aimrule-flow-option',
                'data-active': item.path === value,
                title: item.path,
                onClick: () => {
                  onChange(item.path)
                  setOpen(false)
                },
              },
              h('span', { className: 'aimrule-flow-option-name' }, item.title),
              h('span', { className: 'aimrule-flow-option-meta' }, baseName(item.path)),
            ),
          ),
        )
      : null,
    open ? h('div', { className: 'aimrule-flow-mask', onClick: () => setOpen(false) }) : null,
  )
}

