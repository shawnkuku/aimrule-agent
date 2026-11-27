import { h, useState, useEffect, useRef, useCallback, useMemo, createPortal } from './react.js'
import { buildExports } from '../shared/export.js'
import { generateCases, runCase } from '../shared/evaluate.js'
import { NODE_W, NODE_H, MIN_K, MAX_K, TYPE_META, TYPE_ORDER, uid, posOf, scopeOf, scopeNodes, layoutState, hasMissingPositions, pathOf, edgePath, defaultData, demoDoc, formatBytes, buildWorkspaceTree, filterWorkspaceTree, countTreeFiles, nodeContextText, baseName } from './flow-model.js'
import { CSS } from './styles.js'
import { AimRuleIcon, AimRuleSidebarIcon, NodeCard, ProjectPicker } from './components.jsx'
export { AimRuleSidebarIcon } from './components.jsx'

/* ------------------------------------------------------------------ utils */

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : '')
    }
    reader.onerror = () => reject(reader.error || new Error('读取文件失败'))
    reader.readAsDataURL(file)
  })
}

async function request(path, options) {
  const response = await fetch(path, {
    headers: { 'content-type': 'application/json' },
    ...options,
  })
  let data = null
  try {
    data = await response.json()
  } catch {
    data = { ok: false, error: `接口返回异常（HTTP ${response.status}）` }
  }
  if (!response.ok || !data || data.ok === false) {
    const error = new Error((data && data.error) || `请求失败（HTTP ${response.status}）`)
    error.detail = data && data.detail
    error.code = data && data.code
    throw error
  }
  return data
}

/* -------------------------------------------------------------- components */

/* ------------------------------------------------------------------- page */

function pickCurrentSession(state) {
  const rows = Object.values((state && state.byId) || {})
  const retained = rows.find((row) => row && row.retainedBy && row.retainedBy.mainView > 0)
  if (retained && retained.id) return retained.id
  let best = ''
  let bestAt = -Infinity
  for (const row of rows) {
    if (!row || !row.id || row.subagent || row.blank) continue
    const at = Number(row.updatedAt) || 0
    if (at > bestAt) {
      bestAt = at
      best = row.id
    }
  }
  return best
}

function SessionWatcher({ useSessions, onResolve }) {
  const resolved = useSessions(pickCurrentSession)
  useEffect(() => {
    if (resolved) onResolve(resolved)
  }, [onResolve, resolved])
  return null
}

export default function AimRulePage(props) {
  const useSessions = props && typeof props.useSessions === 'function' ? props.useSessions : null
  const [sessionId, setSessionId] = useState(() => {
    const explicit = props && typeof props.sessionId === 'string' ? props.sessionId : ''
    if (explicit) return explicit
    try {
      return props && typeof props.readCurrentSession === 'function' ? props.readCurrentSession() || '' : ''
    } catch {
      return ''
    }
  })
  const projectHooks = props && typeof props.useWorkspaces === 'function' && typeof props.useSessions === 'function'
  const defaultProject = props && typeof props.defaultProject === 'string' ? props.defaultProject : ''
  const autoProjectRef = useRef('')
  const [project, setProject] = useState(() => {
    if (defaultProject) return defaultProject
    try {
      return window.localStorage.getItem('aimrule.project') || ''
    } catch {
      return ''
    }
  })
  const [flowId, setFlowId] = useState('')
  const [flows, setFlows] = useState([])
  const [flowsLoading, setFlowsLoading] = useState(true)
  const [flowMenu, setFlowMenu] = useState(false)
  const [moreMenu, setMoreMenu] = useState(false)
  const [addMenu, setAddMenu] = useState(false)
  const [modules, setModules] = useState([])
  const [draggingModule, setDraggingModule] = useState(null)
  const [modulePanel, setModulePanel] = useState(false)
  const [toolsMenu, setToolsMenu] = useState(false)
  const [moduleFilter, setModuleFilter] = useState('')
  const [modulePreviewKey, setModulePreviewKey] = useState('')
  const recentStorageKey = `aimrule.recentModules:${project || 'global'}`
  const [recentKeys, setRecentKeys] = useState(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(`aimrule.recentModules:${project || 'global'}`) || '[]')
      return Array.isArray(raw) ? raw.filter((key) => typeof key === 'string').slice(0, 6) : []
    } catch {
      return []
    }
  })
  const [modulesLoading, setModulesLoading] = useState(false)
  const [candidates, setCandidates] = useState([])
  const [detectBusy, setDetectBusy] = useState(false)
  const [extractBusy, setExtractBusy] = useState('')
  const [stateDir, setStateDir] = useState('')
  const [doc, setDoc] = useState(null)
  const [focusId, setFocusId] = useState(null)
  const [selection, setSelection] = useState([])
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [view, setView] = useState({ x: 60, y: 60, k: 1 })
  const [modal, setModal] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notes, setNotes] = useState([])
  const [toast, setToast] = useState(null)
  const [syncState, setSyncState] = useState('loading')
  const [marquee, setMarquee] = useState(null)
  const [pendingEdge, setPendingEdge] = useState(null)
  const [connectTarget, setConnectTarget] = useState(null)
  const [panning, setPanning] = useState(false)
  const [canvasMenu, setCanvasMenu] = useState(null)
  const [nodeMenu, setNodeMenu] = useState(null)
  const [canvasTool, setCanvasTool] = useState('select')
  const [exportTab, setExportTab] = useState('flow.md')
  const [genForm, setGenForm] = useState({ text: '' })
  const [composerMenu, setComposerMenu] = useState(false)
  const [composerPicker, setComposerPicker] = useState(null)
  const [refNodes, setRefNodes] = useState([])
  const [refPaths, setRefPaths] = useState([])
  const [nodeFilter, setNodeFilter] = useState('')
  const [workspaceEntries, setWorkspaceEntries] = useState([])
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  const [workspaceFilter, setWorkspaceFilter] = useState('')
  const [workspaceExpanded, setWorkspaceExpanded] = useState({})
  const [transcriptItems, setTranscriptItems] = useState([])
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [selectedMessages, setSelectedMessages] = useState([])
  const [uploads, setUploads] = useState([])
  const [templateName, setTemplateName] = useState('')
  const [testDrafts, setTestDrafts] = useState([])
  const [aiAppend, setAiAppend] = useState(true)
  const [testDefaults, setTestDefaults] = useState('{}')
  const [testResults, setTestResults] = useState({})

  const docRef = useRef(null)
  const viewRef = useRef(view)
  const stageRef = useRef(null)
  const pastRef = useRef([])
  const futureRef = useRef([])
  const spaceRef = useRef(false)
  const selectionRef = useRef(selection)
  const focusRef = useRef(focusId)
  const saveTimerRef = useRef(null)
  const savedDocRef = useRef(null)
  const loadedForRef = useRef(null)
  const flowsRef = useRef([])
  const filesInputRef = useRef(null)
  const composerRef = useRef(null)
  const folderInputRef = useRef(null)
  const nodeClipboardRef = useRef(null)
  const moduleWrapRef = useRef(null)
  const moduleDragRef = useRef(false)
  const moduleInsertOffsetRef = useRef(0)

  const ready = doc !== null

  useEffect(() => {
    docRef.current = doc
  }, [doc])
  useEffect(() => {
    viewRef.current = view
  }, [view])
  useEffect(() => {
    selectionRef.current = selection
  }, [selection])
  useEffect(() => {
    focusRef.current = focusId
  }, [focusId])

  const params = []
  if (project) params.push(`project=${encodeURIComponent(project)}`)
  if (flowId) params.push(`flow=${encodeURIComponent(flowId)}`)
  const flowQuery = params.length ? `?${params.join('&')}` : ''
  const workspaceQuery = project ? `?project=${encodeURIComponent(project)}` : ''
  const cacheKey = `aimrule.state:${project || 'global'}:${flowId || 'none'}`
  const flowKey = `${project || 'global'}::${flowId || 'none'}`

  useEffect(() => {
    flowsRef.current = flows
  }, [flows])

  useEffect(() => {
    if (!flowId) return
    try {
      window.localStorage.setItem(`aimrule.flow:${project || 'global'}`, flowId)
    } catch {
      /* ignore */
    }
  }, [flowId, project])

  const chooseProject = useCallback((path) => {
    const next = path || ''
    setProject(next)
    try {
      window.localStorage.setItem('aimrule.project', next)
      window.localStorage.setItem('aimrule.project.chosen', '1')
    } catch {
      /* ignore */
    }
  }, [])

  useEffect(() => {
    if (!defaultProject || autoProjectRef.current === defaultProject) return
    autoProjectRef.current = defaultProject
    chooseProject(defaultProject)
  }, [chooseProject, defaultProject])

  useEffect(() => {
    try {
      const raw = JSON.parse(window.localStorage.getItem(recentStorageKey) || '[]')
      setRecentKeys(Array.isArray(raw) ? raw.filter((key) => typeof key === 'string').slice(0, 6) : [])
    } catch {
      setRecentKeys([])
    }
  }, [recentStorageKey])

  const notify = useCallback((text, tone) => {
    setToast({ text, tone: tone || 'info', at: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timer = setTimeout(() => setToast(null), 4200)
    return () => clearTimeout(timer)
  }, [toast])

  /* ------------------------------------------------------------- load/save */

  useEffect(() => {
    let alive = true
    setFlowsLoading(true)
    setFlows([])
    setFlowId('')
    setFlowMenu(false)
    setCandidates([])
    setModules([])
    request(`/aimrule/api/flows${workspaceQuery}`, { method: 'GET' })
      .then(async (data) => {
        if (!alive) return
        let list = Array.isArray(data.flows) ? data.flows : []
        let chosen = ''
        try {
          chosen = window.localStorage.getItem(`aimrule.flow:${project || 'global'}`) || ''
        } catch {
          chosen = ''
        }
        if (!list.some((item) => item.id === chosen)) chosen = list.length > 0 ? list[0].id : ''
        if (!chosen) {
          const created = await request('/aimrule/api/flows', {
            method: 'POST',
            body: JSON.stringify({ project, name: '未命名流程图' }),
          })
          if (!alive) return
          list = Array.isArray(created.flows) ? created.flows : []
          chosen = created.flow || (list[0] ? list[0].id : '')
        }
        setFlows(list)
        setFlowId(chosen)
        setFlowsLoading(false)
      })
      .catch((caught) => {
        if (!alive) return
        setFlowsLoading(false)
        setError(caught.message || '流程图列表加载失败')
        if (project) {
          try {
            window.localStorage.removeItem('aimrule.project')
          } catch {
            /* ignore */
          }
          chooseProject('')
        }
      })
    return () => {
      alive = false
    }
  }, [chooseProject, project, workspaceQuery])

  useEffect(() => {
    if (!flowId || flowsLoading) return undefined
    if (!flowsRef.current.some((item) => item.id === flowId)) return undefined
    let alive = true
    loadedForRef.current = null
    setDoc(null)
    docRef.current = null
    setSyncState('loading')
    setSelection([])
    setFocusId(null)
    setSelectedEdge(null)
    const fallback = () => {
      try {
        const raw = window.localStorage.getItem(cacheKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && Array.isArray(parsed.nodes)) {
            const next = hasMissingPositions(parsed) ? layoutState(parsed) : parsed
            if (!alive) return
            loadedForRef.current = flowKey
            setDoc(next)
            docRef.current = next
            savedDocRef.current = next
            setSyncState('local')
            setTimeout(() => { if (alive) fitView({ minScale: 0.7 }) }, 60)
            return
          }
        }
      } catch {
        /* ignore */
      }
      if (!alive) return
      const empty = { version: 1, project: { name: '未命名业务逻辑', description: '' }, nodes: [], edges: [], templates: [], sources: [], updatedAt: new Date().toISOString() }
      loadedForRef.current = flowKey
      setDoc(empty)
      docRef.current = empty
      savedDocRef.current = empty
      setSyncState('local')
    }
    request(`/aimrule/api/state${flowQuery}`, { method: 'GET' })
      .then((data) => {
        if (!alive) return
        let next = data.state
        if (hasMissingPositions(next)) next = layoutState(next)
        loadedForRef.current = flowKey
        setStateDir(data.dir || '')
        if (data.warning) notify(data.warning, 'error')
        setDoc(next)
        docRef.current = next
        savedDocRef.current = next
        setSyncState('synced')
        setTimeout(() => { if (alive) fitView({ minScale: 0.7 }) }, 60)
      })
      .catch(() => fallback())
    return () => {
      alive = false
    }
  }, [cacheKey, flowId, flowKey, flowQuery, flowsLoading])

  useEffect(() => {
    if (!doc || !flowId) return undefined
    if (loadedForRef.current !== flowKey) return undefined
    if (savedDocRef.current === doc) return undefined
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(cacheKey, JSON.stringify(doc))
      } catch {
        /* quota */
      }
      request(`/aimrule/api/state${flowQuery}`, { method: 'PUT', body: JSON.stringify({ state: doc }) })
        .then((data) => {
          savedDocRef.current = doc
          setSyncState('synced')
          if (Array.isArray(data.flows)) setFlows(data.flows)
        })
        .catch(() => setSyncState('local'))
    }, 700)
    saveTimerRef.current = timer
    return () => clearTimeout(timer)
  }, [cacheKey, doc, flowId, flowKey, flowQuery])

  /* --------------------------------------------------------------- history */

  const applyDoc = useCallback((next, options) => {
    const previous = docRef.current
    if (!previous) {
      docRef.current = next
      setDoc(next)
      return
    }
    if (!options || options.history !== false) {
      pastRef.current.push(previous)
      if (pastRef.current.length > 80) pastRef.current.shift()
      futureRef.current = []
    }
    docRef.current = next
    setDoc(next)
  }, [])

  const mutate = useCallback(
    (fn, options) => {
      const current = docRef.current
      if (!current) return
      applyDoc(fn(current), options)
    },
    [applyDoc],
  )

  const undo = useCallback(() => {
    const previous = pastRef.current.pop()
    if (!previous) return
    futureRef.current.push(docRef.current)
    docRef.current = previous
    setDoc(previous)
    setSelection((current) => current.filter((id) => previous.nodes.some((node) => node.id === id)))
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(docRef.current)
    docRef.current = next
    setDoc(next)
  }, [])

  /* ------------------------------------------------------------ view tools */

  const toWorld = useCallback((clientX, clientY) => {
    const stage = stageRef.current
    const rect = stage ? stage.getBoundingClientRect() : { left: 0, top: 0 }
    const current = viewRef.current
    return { x: (clientX - rect.left - current.x) / current.k, y: (clientY - rect.top - current.y) / current.k }
  }, [])

  const viewportCenter = useCallback(() => {
    const stage = stageRef.current
    if (!stage) return { x: 200, y: 160 }
    const rect = stage.getBoundingClientRect()
    const current = viewRef.current
    return { x: (rect.width / 2 - current.x) / current.k, y: (rect.height / 2 - current.y) / current.k }
  }, [])

  const fitView = useCallback((options) => {
    const stage = stageRef.current
    const current = docRef.current
    if (!stage || !current) return
    const nodes = scopeNodes(current, focusRef.current)
    if (nodes.length === 0) {
      const next = { x: 60, y: 60, k: 1 }
      viewRef.current = next
      setView(next)
      return
    }
    const rect = stage.getBoundingClientRect()
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const node of nodes) {
      const position = posOf(node)
      minX = Math.min(minX, position.x)
      minY = Math.min(minY, position.y)
      maxX = Math.max(maxX, position.x + NODE_W)
      maxY = Math.max(maxY, position.y + NODE_H)
    }
    const padding = 60
    const fitted = Math.min(1.2, Math.max(MIN_K, Math.min((rect.width - padding * 2) / (maxX - minX), (rect.height - padding * 2) / (maxY - minY))))
    const floor = options && Number.isFinite(options.minScale) ? Math.max(MIN_K, options.minScale) : MIN_K
    const scale = Math.max(fitted, floor)
    const next = {
      k: scale,
      x: fitted < floor ? 48 - minX * scale : (rect.width - (maxX - minX) * scale) / 2 - minX * scale,
      y: 48 - minY * scale,
    }
    viewRef.current = next
    setView(next)
  }, [])

  const zoomBy = useCallback((factor) => {
    const stage = stageRef.current
    if (!stage) return
    const rect = stage.getBoundingClientRect()
    const current = viewRef.current
    const k = Math.min(MAX_K, Math.max(MIN_K, current.k * factor))
    const cx = rect.width / 2
    const cy = rect.height / 2
    const next = { k, x: cx - (cx - current.x) * (k / current.k), y: cy - (cy - current.y) * (k / current.k) }
    viewRef.current = next
    setView(next)
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const onWheel = (event) => {
      event.preventDefault()
      const current = viewRef.current
      if (event.ctrlKey || event.metaKey) {
        const rect = stage.getBoundingClientRect()
        const mx = event.clientX - rect.left
        const my = event.clientY - rect.top
        const k = Math.min(MAX_K, Math.max(MIN_K, current.k * Math.exp(-event.deltaY * 0.0022)))
        const next = { k, x: mx - (mx - current.x) * (k / current.k), y: my - (my - current.y) * (k / current.k) }
        viewRef.current = next
        setView(next)
      } else {
        const next = { ...current, x: current.x - event.deltaX, y: current.y - event.deltaY }
        viewRef.current = next
        setView(next)
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [ready])

  /* --------------------------------------------------------- canvas edits */

  const drill = useCallback((id) => {
    setFocusId(id)
    setSelection([])
    setSelectedEdge(null)
    const next = { x: 60, y: 60, k: 1 }
    viewRef.current = next
    setView(next)
  }, [])

  const addNode = useCallback(
    (type, at) => {
      const current = docRef.current
      if (!current) return
      const center = at || viewportCenter()
      const node = {
        id: uid('n_'),
        type,
        parentId: focusRef.current,
        pos: { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - NODE_H / 2) },
        data: defaultData(type),
      }
      let edges = current.edges
      const selected = selectionRef.current
      if (selected.length === 1) {
        const source = current.nodes.find((item) => item.id === selected[0])
        if (source) {
          const label = source.type === 'judge' ? (current.edges.some((edge) => edge.source === source.id && edge.label === '是') ? '否' : '是') : ''
          edges = [...edges, { id: uid('e_'), source: source.id, target: node.id, label }]
        }
      }
      applyDoc({ ...current, nodes: [...current.nodes, node], edges })
      setSelection([node.id])
      setSelectedEdge(null)
    },
    [applyDoc, viewportCenter],
  )

  const copySelection = useCallback((idsArg) => {
    const current = docRef.current
    if (!current) return false
    const ids = new Set(Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selectionRef.current)
    if (ids.size === 0) return false
    let changed = true
    while (changed) {
      changed = false
      for (const node of current.nodes) {
        if (node.parentId && ids.has(node.parentId) && !ids.has(node.id)) {
          ids.add(node.id)
          changed = true
        }
      }
    }
    const nodes = current.nodes
      .filter((node) => ids.has(node.id))
      .map((node) => ({ ...node, pos: { ...posOf(node) }, data: { ...node.data } }))
    const edges = current.edges
      .filter((edge) => ids.has(edge.source) && ids.has(edge.target))
      .map((edge) => ({ ...edge }))
    nodeClipboardRef.current = { nodes, edges }
    notify(`已复制 ${nodes.length} 个节点`)
    return true
  }, [notify])

  const pasteNodes = useCallback(
    (at) => {
      const current = docRef.current
      const clip = nodeClipboardRef.current
      if (!current || !clip || clip.nodes.length === 0) return false
      const idMap = new Map()
      for (const node of clip.nodes) idMap.set(node.id, uid('n_'))
      const minX = Math.min(...clip.nodes.map((node) => posOf(node).x))
      const minY = Math.min(...clip.nodes.map((node) => posOf(node).y))
      const origin = at ? { x: at.x, y: at.y } : { x: minX + 30, y: minY + 30 }
      const dx = origin.x - minX
      const dy = origin.y - minY
      const nodes = clip.nodes.map((node) => ({
        ...node,
        id: idMap.get(node.id),
        parentId: node.parentId && idMap.has(node.parentId) ? idMap.get(node.parentId) : focusRef.current,
        pos: { x: Math.round(posOf(node).x + dx), y: Math.round(posOf(node).y + dy) },
        data: { ...node.data },
      }))
      const edges = clip.edges
        .map((edge) => ({ ...edge, id: uid('e_'), source: idMap.get(edge.source), target: idMap.get(edge.target) }))
        .filter((edge) => edge.source && edge.target)
      applyDoc({ ...current, nodes: [...current.nodes, ...nodes], edges: [...current.edges, ...edges] })
      setSelection([...idMap.values()])
      setSelectedEdge(null)
      notify(`已粘贴 ${nodes.length} 个节点`)
      return true
    },
    [applyDoc, notify],
  )

  const addNodesToComposer = useCallback(
    (ids) => {
      const current = docRef.current
      const valid = (ids || []).filter((id) => current && current.nodes.some((node) => node.id === id))
      if (valid.length === 0) return
      setRefNodes((existing) => Array.from(new Set([...existing, ...valid])))
      setNodeMenu(null)
      setCanvasMenu(null)
      setComposerMenu(false)
      setComposerPicker(null)
      setTimeout(() => {
        if (composerRef.current) composerRef.current.focus()
      }, 30)
      notify(`已加入对话框 ${valid.length} 个节点`)
    },
    [notify],
  )

  const addEdge = useCallback(
    (source, target) => {
      const current = docRef.current
      if (!current || source === target) return
      if (current.edges.some((edge) => edge.source === source && edge.target === target)) return
      const sourceNode = current.nodes.find((node) => node.id === source)
      const label = sourceNode && sourceNode.type === 'judge' ? (current.edges.some((edge) => edge.source === source && edge.label === '是') ? '否' : '是') : ''
      applyDoc({ ...current, edges: [...current.edges, { id: uid('e_'), source, target, label }] })
    },
    [applyDoc],
  )

  const deleteSelection = useCallback(
    (idsArg) => {
      const current = docRef.current
      if (!current) return
      if (selectedEdge && (!Array.isArray(idsArg) || idsArg.length === 0)) {
        applyDoc({ ...current, edges: current.edges.filter((edge) => edge.id !== selectedEdge) })
        setSelectedEdge(null)
        return
      }
      const ids = Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selection
      if (ids.length === 0) return
      const doomed = new Set(ids)
    let changed = true
    while (changed) {
      changed = false
      for (const node of current.nodes) {
        if (node.parentId && doomed.has(node.parentId) && !doomed.has(node.id)) {
          doomed.add(node.id)
          changed = true
        }
      }
    }
      applyDoc({
        ...current,
        nodes: current.nodes.filter((node) => !doomed.has(node.id)),
        edges: current.edges.filter((edge) => !doomed.has(edge.source) && !doomed.has(edge.target)),
      })
      setSelection([])
    },
    [applyDoc, selection, selectedEdge],
  )

  const patchNode = useCallback(
    (id, patch) => {
      mutate((current) => ({
        ...current,
        nodes: current.nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node)),
      }), { history: false })
    },
    [mutate],
  )

  const pushHistoryOnce = useCallback(() => {
    const current = docRef.current
    if (!current) return
    pastRef.current.push(current)
    if (pastRef.current.length > 80) pastRef.current.shift()
    futureRef.current = []
  }, [])

  const moveNodes = useCallback((ids, deltaX, deltaY, origins) => {
    const current = docRef.current
    if (!current) return
    const set = new Set(ids)
    const next = {
      ...current,
      nodes: current.nodes.map((node) => {
        if (!set.has(node.id)) return node
        const origin = origins[node.id] || posOf(node)
        return { ...node, pos: { x: Math.round(origin.x + deltaX), y: Math.round(origin.y + deltaY) } }
      }),
    }
    docRef.current = next
    setDoc(next)
  }, [])

  const nudgeSelection = useCallback(
    (deltaX, deltaY) => {
      const current = docRef.current
      const ids = selectionRef.current
      if (!current || ids.length === 0) return
      pushHistoryOnce()
      const set = new Set(ids)
      const next = {
        ...current,
        nodes: current.nodes.map((node) => {
          if (!set.has(node.id)) return node
          const position = posOf(node)
          return { ...node, pos: { x: Math.round(position.x + deltaX), y: Math.round(position.y + deltaY) } }
        }),
      }
      docRef.current = next
      setDoc(next)
    },
    [pushHistoryOnce],
  )

  const beginNodeDrag = useCallback(
    (event, node) => {
      if (event.button !== 0) return
      event.stopPropagation()
      const current = docRef.current
      if (!current) return
      let ids = selectionRef.current
      if (!ids.includes(node.id)) {
        ids = event.shiftKey ? [...ids, node.id] : [node.id]
        setSelection(ids)
        selectionRef.current = ids
      }
      setSelectedEdge(null)
      const start = toWorld(event.clientX, event.clientY)
      const origins = {}
      for (const item of current.nodes) if (ids.includes(item.id)) origins[item.id] = { ...posOf(item) }
      let moved = false
      let pending = null
      let frame = 0
      const raf = typeof window.requestAnimationFrame === 'function' ? window.requestAnimationFrame.bind(window) : (callback) => setTimeout(callback, 16)
      const cancelRaf = typeof window.cancelAnimationFrame === 'function' ? window.cancelAnimationFrame.bind(window) : clearTimeout
      const flush = () => {
        if (!pending) return
        const next = pending
        pending = null
        moveNodes(ids, next.dx, next.dy, origins)
      }
      pushHistoryOnce()
      const onMove = (moveEvent) => {
        const point = toWorld(moveEvent.clientX, moveEvent.clientY)
        const dx = point.x - start.x
        const dy = point.y - start.y
        if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return
        moved = true
        pending = { dx, dy }
        if (!frame) {
          frame = raf(() => {
            frame = 0
            flush()
          })
        }
      }
      const onUp = () => {
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
        if (frame) cancelRaf(frame)
        frame = 0
        flush()
        if (!moved) {
          // no-op drag: remove the speculative history entry
          const previous = pastRef.current.pop()
          if (previous) futureRef.current = []
        }
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [moveNodes, pushHistoryOnce, toWorld],
  )

  const beginConnect = useCallback(
    (event, node) => {
      if (event.button !== 0) return
      event.stopPropagation()
      const position = posOf(node)
      const start = { x: position.x + NODE_W, y: position.y + NODE_H / 2 }
      setPendingEdge({ from: node.id, start, cursor: start })
      setConnectTarget(null)
      const onMove = (moveEvent) => {
        const point = toWorld(moveEvent.clientX, moveEvent.clientY)
        const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY)
        const host = element && element.closest ? element.closest('[data-node-id]') : null
        const target = host ? host.getAttribute('data-node-id') : ''
        setConnectTarget(target && target !== node.id ? target : null)
        setPendingEdge((previous) => (previous ? { ...previous, cursor: point } : previous))
      }
      const onUp = (upEvent) => {
        const element = document.elementFromPoint(upEvent.clientX, upEvent.clientY)
        const host = element && element.closest ? element.closest('[data-node-id]') : null
        if (host) {
          const target = host.getAttribute('data-node-id')
          if (target && target !== node.id) addEdge(node.id, target)
        }
        setConnectTarget(null)
        setPendingEdge(null)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [addEdge, toWorld],
  )

  const finishConnect = useCallback(
    (event, targetId) => {
      if (!pendingEdge) return
      event.stopPropagation()
      if (pendingEdge.from !== targetId) addEdge(pendingEdge.from, targetId)
      setPendingEdge(null)
      setConnectTarget(null)
    },
    [addEdge, pendingEdge],
  )

  const onStageDoubleClick = useCallback(
    (event) => {
      if (
        event.target.closest &&
        event.target.closest(
          '.aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes, [data-node-id], [data-edge-id]',
        )
      ) {
        return
      }
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      setCanvasMenu({
        x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
        y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 376)),
        world: toWorld(event.clientX, event.clientY),
      })
      setNodeMenu(null)
    },
    [toWorld],
  )

  const onStageMouseDown = useCallback(
    (event) => {
      if (event.button === 2) return
      if (event.target.closest && (event.target.closest('[data-node-id]') || event.target.closest('[data-edge-id]'))) return
      if (
        event.target.closest &&
        event.target.closest(
          '.aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes',
        )
      ) {
        return
      }
      const panRequested =
        event.button === 1 ||
        event.altKey ||
        spaceRef.current ||
        (event.button === 0 && canvasTool === 'hand' && !event.shiftKey)
      if (panRequested) {
        event.preventDefault()
        const origin = { ...viewRef.current }
        const startX = event.clientX
        const startY = event.clientY
        const clearOnClick = event.button === 0 && !event.altKey && !spaceRef.current
        let moved = false
        setPanning(true)
        const onMove = (moveEvent) => {
          if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 2) moved = true
          const next = { ...origin, x: origin.x + (moveEvent.clientX - startX), y: origin.y + (moveEvent.clientY - startY) }
          viewRef.current = next
          setView(next)
        }
        const onUp = () => {
          setPanning(false)
          if (clearOnClick && !moved) {
            setSelection([])
            selectionRef.current = []
            setSelectedEdge(null)
          }
          window.removeEventListener('mousemove', onMove)
          window.removeEventListener('mouseup', onUp)
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return
      }
      if (event.button !== 0) return
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const startScreen = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const startWorld = toWorld(event.clientX, event.clientY)
      const additive = event.shiftKey
      if (!additive) {
        setSelection([])
        selectionRef.current = []
      }
      setSelectedEdge(null)
      const baseSelection = additive ? selectionRef.current : []
      const onMove = (moveEvent) => {
        const currentX = moveEvent.clientX - rect.left
        const currentY = moveEvent.clientY - rect.top
        const box = {
          x: Math.min(currentX, startScreen.x),
          y: Math.min(currentY, startScreen.y),
          w: Math.abs(currentX - startScreen.x),
          h: Math.abs(currentY - startScreen.y),
        }
        setMarquee(box)
        if (box.w < 3 && box.h < 3) return
        const current = docRef.current
        if (!current) return
        const a = { x: Math.min(startWorld.x, (moveEvent.clientX - rect.left - viewRef.current.x) / viewRef.current.k), y: Math.min(startWorld.y, (moveEvent.clientY - rect.top - viewRef.current.y) / viewRef.current.k) }
        const b = { x: Math.max(startWorld.x, (moveEvent.clientX - rect.left - viewRef.current.x) / viewRef.current.k), y: Math.max(startWorld.y, (moveEvent.clientY - rect.top - viewRef.current.y) / viewRef.current.k) }
        const hits = scopeNodes(current, focusRef.current)
          .filter((node) => {
            const position = posOf(node)
            return position.x < b.x && position.x + NODE_W > a.x && position.y < b.y && position.y + NODE_H > a.y
          })
          .map((node) => node.id)
        const merged = additive ? Array.from(new Set([...baseSelection, ...hits])) : hits
        selectionRef.current = merged
        setSelection(merged)
      }
      const onUp = () => {
        setMarquee(null)
        window.removeEventListener('mousemove', onMove)
        window.removeEventListener('mouseup', onUp)
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseup', onUp)
    },
    [canvasTool, toWorld],
  )

  const onStageContextMenu = useCallback(
    (event) => {
      if (
        event.target.closest &&
        event.target.closest(
          '.aimrule-composer, .aimrule-canvas-bar, .aimrule-canvas-crumbs, .aimrule-dock, .aimrule-inspector, .aimrule-zoom, .aimrule-canvas-menu, .aimrule-flow-mask, .aimrule-modal, .aimrule-hero, .aimrule-toast, .aimrule-notes',
        )
      ) {
        return
      }
      const stage = stageRef.current
      if (!stage) return
      const rect = stage.getBoundingClientRect()
      const nodeHost = event.target.closest ? event.target.closest('[data-node-id]') : null
      if (nodeHost) {
        event.preventDefault()
        const id = nodeHost.getAttribute('data-node-id')
        const inSelection = selectionRef.current.includes(id)
        const ids = inSelection ? [...selectionRef.current] : [id]
        if (!inSelection && (selectionRef.current.length > 0 || selectedEdge)) {
          setSelection([])
          selectionRef.current = []
          setSelectedEdge(null)
        }
        setNodeMenu({
          x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
          y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 230)),
          ids,
        })
        setCanvasMenu(null)
        return
      }
      event.preventDefault()
      if (event.target.closest && event.target.closest('[data-edge-id]')) return
      setCanvasMenu({
        x: Math.max(8, Math.min(event.clientX - rect.left, rect.width - 222)),
        y: Math.max(8, Math.min(event.clientY - rect.top, rect.height - 376)),
        world: toWorld(event.clientX, event.clientY),
      })
      setNodeMenu(null)
    },
    [selectedEdge, toWorld],
  )

  const encapsulate = useCallback(
    (idsArg) => {
      const current = docRef.current
      const ids = Array.isArray(idsArg) && idsArg.length > 0 ? idsArg : selection
      if (!current || ids.length === 0) return
      const chosen = new Set(ids)
    const picked = current.nodes.filter((node) => chosen.has(node.id))
    if (picked.length === 0) return
    const moduleId = uid('m_')
    const centerX = picked.reduce((sum, node) => sum + posOf(node).x + NODE_W / 2, 0) / picked.length
    const centerY = picked.reduce((sum, node) => sum + posOf(node).y + NODE_H / 2, 0) / picked.length
    const moduleNode = {
      id: moduleId,
      type: 'module',
      parentId: focusRef.current,
      pos: { x: Math.round(centerX - NODE_W / 2), y: Math.round(centerY - NODE_H / 2) },
      data: { ...defaultData('module'), label: `模块 ${current.nodes.filter((node) => node.type === 'module').length + 1}` },
    }
    const nodes = current.nodes.map((node) => (chosen.has(node.id) ? { ...node, parentId: moduleId } : node))
    nodes.push(moduleNode)
    const edges = current.edges.map((edge) => {
      const fromInside = chosen.has(edge.source)
      const toInside = chosen.has(edge.target)
      if (fromInside && toInside) return edge
      if (fromInside) return { ...edge, source: moduleId }
      if (toInside) return { ...edge, target: moduleId }
      return edge
    })
      applyDoc({ ...current, nodes, edges })
      setSelection([moduleId])
    },
    [applyDoc, selection],
  )

  const ungroup = useCallback(
    (moduleId) => {
      const current = docRef.current
      if (!current) return
      const moduleNode = current.nodes.find((node) => node.id === moduleId)
      if (!moduleNode) return
      const parent = moduleNode.parentId || null
      const nodes = current.nodes
        .filter((node) => node.id !== moduleId)
        .map((node) => (node.parentId === moduleId ? { ...node, parentId: parent } : node))
      const edges = current.edges.filter((edge) => edge.source !== moduleId && edge.target !== moduleId)
      applyDoc({ ...current, nodes, edges })
      setSelection([])
      if (focusRef.current === moduleId) drill(parent)
    },
    [applyDoc, drill],
  )

  const saveTemplate = useCallback(() => {
    const current = docRef.current
    if (!current || selection.length === 0) return
    const chosen = new Set(selection)
    const picked = current.nodes.filter((node) => chosen.has(node.id))
    if (picked.length === 0) return
    const minX = Math.min(...picked.map((node) => posOf(node).x))
    const minY = Math.min(...picked.map((node) => posOf(node).y))
    const ids = new Set(picked.map((node) => node.id))
    const template = {
      id: uid('tpl_'),
      name: templateName.trim() || `模板 ${current.templates.length + 1}`,
      nodes: picked.map((node) => ({ ...node, parentId: node.parentId && ids.has(node.parentId) ? node.parentId : null, pos: { x: posOf(node).x - minX, y: posOf(node).y - minY } })),
      edges: current.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).map((edge) => ({ ...edge })),
      createdAt: new Date().toISOString(),
    }
    applyDoc({ ...current, templates: [template, ...current.templates].slice(0, 60) })
    setTemplateName('')
    notify(`已存为模板「${template.name}」`)
  }, [applyDoc, notify, selection, templateName])

  const insertTemplate = useCallback(
    (template) => {
      const current = docRef.current
      if (!current) return
      const center = at || viewportCenter()
      const map = new Map()
      for (const node of template.nodes) map.set(node.id, uid('n_'))
      const nodes = template.nodes.map((node) => ({
        ...node,
        id: map.get(node.id),
        parentId: node.parentId && map.has(node.parentId) ? map.get(node.parentId) : focusRef.current,
        pos: { x: Math.round(center.x - 100 + posOf(node).x), y: Math.round(center.y - 60 + posOf(node).y) },
        data: { ...node.data },
      }))
      const edges = template.edges
        .filter((edge) => map.has(edge.source) && map.has(edge.target))
        .map((edge) => ({ ...edge, id: uid('e_'), source: map.get(edge.source), target: map.get(edge.target) }))
      applyDoc({ ...current, nodes: [...current.nodes, ...nodes], edges: [...current.edges, ...edges] })
      setSelection(nodes.map((node) => node.id))
      setModal(null)
      notify(`已插入模板「${template.name}」`)
    },
    [applyDoc, notify, viewportCenter],
  )

  /* ------------------------------------------------------------------- ai */

  const addFiles = useCallback((fileList) => {
    const incoming = Array.from(fileList || [])
    if (incoming.length === 0) return
    const next = [...uploads]
    let total = next.reduce((sum, item) => sum + item.size, 0)
    let skipped = 0
    for (const file of incoming) {
      if (next.length >= 200) {
        skipped += 1
        continue
      }
      if (file.size > 20_000_000 || total + file.size > 30_000_000) {
        skipped += 1
        continue
      }
      const path = file.webkitRelativePath || file.name
      if (next.some((item) => item.path === path && item.size === file.size && item.lastModified === file.lastModified)) continue
      next.push({
        key: `${path}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2, 6)}`,
        name: file.name,
        path,
        size: file.size,
        lastModified: file.lastModified || 0,
        file,
      })
      total += file.size
    }
    setUploads(next)
    if (next.length > uploads.length) notify(`已添加 ${next.length - uploads.length} 个文件`)
    if (skipped > 0) notify(`${skipped} 个文件被跳过（单个 20MB / 总计 30MB / 最多 200 个）`, 'error')
  }, [notify, uploads])

  const removeFile = useCallback((key) => {
    setUploads((current) => current.filter((item) => item.key !== key))
  }, [])

  const toggleMessage = useCallback((index) => {
    setSelectedMessages((current) =>
      current.includes(index) ? current.filter((item) => item !== index) : [...current, index].sort((a, b) => a - b),
    )
  }, [])

  const selectAllMessages = useCallback(() => {
    setSelectedMessages(transcriptItems.map((_, index) => index))
  }, [transcriptItems])

  const clearMessages = useCallback(() => {
    setSelectedMessages([])
  }, [])

  const loadChatRefs = useCallback(async () => {
    if (transcriptLoading) return
    if (!sessionId) {
      setTranscriptItems([])
      setSelectedMessages([])
      return
    }
    setTranscriptLoading(true)
    setError('')
    try {
      const data = await request('/aimrule/api/transcript', {
        method: 'POST',
        body: JSON.stringify({ sessionId, maxChars: 24000 }),
      })
      const items = Array.isArray(data.items) ? data.items : []
      setTranscriptItems(items)
      setSelectedMessages(items.map((_, index) => index))
    } catch (caught) {
      setError(caught.message || '读取对话记录失败')
    } finally {
      setTranscriptLoading(false)
    }
  }, [sessionId, transcriptLoading])

  const loadWorkspaceRefs = useCallback(async () => {
    if (workspaceLoading) return
    setWorkspaceLoading(true)
    setError('')
    try {
      const data = await request(`/aimrule/api/workspace/tree${workspaceQuery}`, { method: 'GET' })
      const entries = Array.isArray(data.entries) ? data.entries : []
      setWorkspaceEntries(entries)
      const topLevel = {}
      for (const node of buildWorkspaceTree(entries)) if (node.type === 'dir') topLevel[node.path] = true
      setWorkspaceExpanded(topLevel)
    } catch (caught) {
      setError(caught.message || '读取工作区文件失败')
    } finally {
      setWorkspaceLoading(false)
    }
  }, [workspaceLoading, workspaceQuery])

  const openComposerPicker = useCallback((kind) => {
    setComposerMenu(false)
    setComposerPicker(kind)
    setNodeFilter('')
    setWorkspaceFilter('')
    if (kind === 'chat') loadChatRefs()
    if (kind === 'workspace') loadWorkspaceRefs()
  }, [loadChatRefs, loadWorkspaceRefs])

  const toggleNodeRef = useCallback((id) => {
    setRefNodes((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }, [])

  const togglePathRef = useCallback((entry) => {
    setRefPaths((current) => {
      if (current.some((item) => item.path === entry.path)) return current.filter((item) => item.path !== entry.path)
      const covered = current.some((item) => item.type === 'dir' && entry.path.startsWith(`${item.path}/`))
      if (covered) return current
      if (entry.type === 'dir') {
        return [...current.filter((item) => !item.path.startsWith(`${entry.path}/`)), { path: entry.path, type: 'dir' }]
      }
      return [...current, { path: entry.path, type: 'file' }]
    })
  }, [])

  const submitComposer = useCallback(async () => {
    if (busy) return
    const current = docRef.current
    if (!current) return
    const typed = genForm.text.trim()
    const hasRefs = refNodes.length > 0 || selectedMessages.length > 0 || refPaths.length > 0 || uploads.length > 0
    if (!typed && !hasRefs) {
      notify('请输入要求，或用 ＋ 引用节点、对话记录、工作区文件', 'error')
      return
    }
    setBusy('generate')
    setError('')
    try {
      const sections = []
      if (refNodes.length > 0) {
        const context = nodeContextText(current, refNodes)
        if (context) sections.push(`## 引用画布\n${context}`)
      }
      if (selectedMessages.length > 0) {
        const chat = [...selectedMessages]
          .sort((a, b) => a - b)
          .map((index) => transcriptItems[index])
          .filter(Boolean)
          .map((item) => `【${item.role}】\n${item.text}`)
          .join('\n\n')
        if (chat) sections.push(`## 对话记录\n${chat}`)
      }
      if (refPaths.length > 0) {
        const data = await request('/aimrule/api/ingest', {
          method: 'POST',
          body: JSON.stringify({ project, paths: refPaths.map((item) => item.path) }),
        })
        if (data.text) sections.push(`## 工作区文件\n${data.text}`)
      }
      if (uploads.length > 0) {
        const payload = []
        for (const item of uploads) {
          const data = await fileToBase64(item.file)
          if (data) payload.push({ name: item.path || item.name, data })
        }
        if (payload.length > 0) {
          const data = await request('/aimrule/api/ingest', {
            method: 'POST',
            body: JSON.stringify({ files: payload }),
          })
          if (data.text) sections.push(`## 上传附件\n${data.text}`)
        }
      }
      const source = sections.join('\n\n')
      const text = source || typed
      const instruction = source ? typed : ''
      if (text.trim().length < 10 && instruction.length < 1) throw new Error('请补充至少 10 个字的材料，或写清提炼要求')
      const data = await request('/aimrule/api/generate', {
        method: 'POST',
        body: JSON.stringify({
          text: text.length > 60000 ? text.slice(-60000) : text,
          instruction,
          mode: 'merge',
          project,
          flow: flowId,
        }),
      })
      let next = data.state
      if (hasMissingPositions(next)) next = layoutState(next)
      applyDoc(next)
      setFocusId(null)
      setSelection([])
      setTimeout(fitView, 40)
      setGenForm({ text: '' })
      setRefNodes([])
      setSelectedMessages([])
      setRefPaths([])
      setUploads([])
      setComposerPicker(null)
      setComposerMenu(false)
      notify(`已生成 ${next.nodes.length} 个节点、${next.edges.length} 条连线${data.attempts > 1 ? `（第 ${data.attempts} 次通过校验）` : ''}`)
      setNotes(Array.isArray(data.notes) ? data.notes : [])
      if (Array.isArray(data.flows)) setFlows(data.flows)
    } catch (caught) {
      setError(caught.message || '生成失败')
    } finally {
      setBusy('')
    }
  }, [applyDoc, busy, fitView, flowId, genForm, notify, project, refNodes, refPaths, selectedMessages, transcriptItems, uploads])

  useEffect(() => {
    if (selection.length > 0 || selectedEdge) {
      setComposerMenu(false)
      setComposerPicker(null)
    }
  }, [selection, selectedEdge])

  useEffect(() => {
    setRefNodes([])
    setRefPaths([])
    setGenForm({ text: '' })
    setComposerMenu(false)
    setComposerPicker(null)
  }, [flowId])

  const createFlow = useCallback(async () => {
    if (busy) return
    setBusy('flow')
    setError('')
    try {
      const data = await request('/aimrule/api/flows', {
        method: 'POST',
        body: JSON.stringify({ project, name: '未命名流程图' }),
      })
      if (Array.isArray(data.flows)) setFlows(data.flows)
      setFlowId(data.flow || '')
      notify('已新建空白流程图')
    } catch (caught) {
      setError(caught.message || '新建流程图失败')
    } finally {
      setBusy('')
    }
  }, [busy, notify, project])

  const deleteFlow = useCallback(async () => {
    if (busy) return
    if (flows.length <= 1) {
      notify('至少保留一个流程图', 'error')
      return
    }
    const name = (docRef.current && docRef.current.project.name) || '当前流程图'
    if (!window.confirm(`删除流程图「${name}」？此操作不可撤销。`)) return
    setBusy('flow')
    setError('')
    try {
      const data = await request('/aimrule/api/flows/delete', {
        method: 'POST',
        body: JSON.stringify({ project, flow: flowId }),
      })
      const list = Array.isArray(data.flows) ? data.flows : []
      setFlows(list)
      setFlowId(list.length > 0 ? list[0].id : '')
      notify('已删除流程图')
    } catch (caught) {
      setError(caught.message || '删除流程图失败')
    } finally {
      setBusy('')
    }
  }, [busy, flowId, flows.length, notify, project])

  const loadModules = useCallback(async (open) => {
    if (open) setModal('modules')
    setModulesLoading(true)
    setError('')
    try {
      const data = await request(`/aimrule/api/modules${workspaceQuery}`, { method: 'GET' })
      setModules(Array.isArray(data.modules) ? data.modules : [])
    } catch (caught) {
      setError(caught.message || '模块库加载失败')
    } finally {
      setModulesLoading(false)
    }
  }, [workspaceQuery])

  const openModules = useCallback(() => {
    loadModules(true)
  }, [loadModules])

  useEffect(() => {
    if (!modulePanel) return undefined
    const onDown = (event) => {
      if (moduleWrapRef.current && moduleWrapRef.current.contains(event.target)) return
      setModulePanel(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [modulePanel])

  const detectModules = useCallback(async () => {
    if (detectBusy) return
    setDetectBusy(true)
    setError('')
    try {
      const data = await request('/aimrule/api/modules/detect', {
        method: 'POST',
        body: JSON.stringify({ project }),
      })
      const list = Array.isArray(data.candidates) ? data.candidates : []
      setCandidates(list)
      notify(list.length > 0 ? `检测到 ${list.length} 个可复用候选` : '没有检测到跨流程图重复的子图')
    } catch (caught) {
      setError(caught.message || '复用检测失败')
    } finally {
      setDetectBusy(false)
    }
  }, [detectBusy, notify, project])

  const reloadCurrentFlow = useCallback(async () => {
    if (!flowId) return
    setError('')
    try {
      const data = await request(`/aimrule/api/state${flowQuery}`, { method: 'GET' })
      let next = data.state
      if (hasMissingPositions(next)) next = layoutState(next)
      loadedForRef.current = flowKey
      savedDocRef.current = next
      docRef.current = next
      setDoc(next)
      setSelection([])
      setSelectedEdge(null)
      setSyncState('synced')
    } catch (caught) {
      setError(caught.message || '重新加载流程图失败')
    }
  }, [flowId, flowKey, flowQuery])

  const extractCandidate = useCallback(async (candidate, occurrence) => {
    if (extractBusy) return
    const key = `${occurrence.flowId}:${candidate.name}`
    setExtractBusy(key)
    setError('')
    try {
      await request('/aimrule/api/modules/extract', {
        method: 'POST',
        body: JSON.stringify({
          project,
          flowId: occurrence.flowId,
          nodeIds: occurrence.nodeIds,
          name: candidate.name,
          reason: candidate.reason,
        }),
      })
      notify(`已在「${occurrence.flowName}」把「${candidate.name}」抽为模块`)
      setCandidates((list) =>
        list
          .map((item) =>
            item !== candidate
              ? item
              : {
                  ...item,
                  occurrences: item.occurrences.filter(
                    (entry) => !(entry.flowId === occurrence.flowId && entry.nodeIds.join(',') === occurrence.nodeIds.join(',')),
                  ),
                },
          )
          .filter((item) => item.occurrences.length >= 2),
      )
      await loadModules(false)
      request(`/aimrule/api/flows${workspaceQuery}`, { method: 'GET' })
        .then((data) => {
          if (Array.isArray(data.flows)) setFlows(data.flows)
        })
        .catch(() => {})
      if (occurrence.flowId === flowId) await reloadCurrentFlow()
    } catch (caught) {
      setError(caught.message || '抽取模块失败')
    } finally {
      setExtractBusy('')
    }
  }, [extractBusy, flowId, loadModules, notify, project, reloadCurrentFlow])

  const rememberModule = useCallback(
    (entry) => {
      if (!entry || !entry.key) return
      setRecentKeys((previous) => {
        const next = [entry.key, ...previous.filter((key) => key !== entry.key)].slice(0, 6)
        try {
          window.localStorage.setItem(recentStorageKey, JSON.stringify(next))
        } catch {
          /* ignore */
        }
        return next
      })
    },
    [recentStorageKey],
  )

  const insertModule = useCallback((entry, at) => {
    const current = docRef.current
    if (!current || !entry || !Array.isArray(entry.nodes) || entry.nodes.length === 0) return
    const remap = new Map()
    for (const node of entry.nodes) {
      remap.set(node.id, uid(node.id === entry.moduleId ? 'm_' : 'n_'))
    }
    const moduleId = remap.get(entry.moduleId)
    if (!moduleId) return
    const scope = focusRef.current
    const center = viewportCenter()
    const stamp = `复用自 ${entry.flowName} / ${entry.name}`
    const nodes = entry.nodes.map((node) => {
      const isRoot = node.id === entry.moduleId
      return {
        ...node,
        id: remap.get(node.id),
        parentId: isRoot ? scope : (node.parentId && remap.has(node.parentId) ? remap.get(node.parentId) : moduleId),
        pos: isRoot
          ? { x: Math.round(center.x - NODE_W / 2), y: Math.round(center.y - NODE_H / 2) }
          : { ...posOf(node) },
        data: {
          ...node.data,
          notes: [node.data && node.data.notes, stamp].filter(Boolean).join('；'),
        },
      }
    })
    const edges = entry.edges
      .filter((edge) => remap.has(edge.source) && remap.has(edge.target))
      .map((edge) => ({
        id: uid('e_'),
        source: remap.get(edge.source),
        target: remap.get(edge.target),
        label: edge.label || '',
      }))
    applyDoc({ ...current, nodes: [...current.nodes, ...nodes], edges: [...current.edges, ...edges] })
    setSelection([moduleId])
    setSelectedEdge(null)
    setModal(null)
    rememberModule(entry)
    notify(`已插入模块「${entry.name}」（${entry.flowName}）`)
  }, [applyDoc, notify, rememberModule])

  const insertModuleFromPanel = useCallback(
    (entry) => {
      const center = viewportCenter()
      const step = moduleInsertOffsetRef.current % 5
      moduleInsertOffsetRef.current += 1
      insertModule(entry, { x: center.x + step * 24, y: center.y + step * 24 })
    },
    [insertModule, viewportCenter],
  )
  const onStageDragOver = useCallback(
    (event) => {
      const types = Array.from((event.dataTransfer && event.dataTransfer.types) || [])
      if (types.includes('Files')) {
        event.preventDefault()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
        return
      }
      if (!draggingModule) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    },
    [draggingModule],
  )

  const onStageDrop = useCallback(
    (event) => {
      const files = event.dataTransfer && event.dataTransfer.files
      if (files && files.length > 0) {
        event.preventDefault()
        addFiles(files)
        return
      }
      if (!draggingModule) return
      event.preventDefault()
      const point = toWorld(event.clientX, event.clientY)
      const entry = draggingModule
      setDraggingModule(null)
      insertModule(entry, point)
    },
    [addFiles, draggingModule, insertModule, toWorld],
  )


  /* ---------------------------------------------------------------- tests */

  const parseObject = (text, label) => {
    let value
    try {
      value = JSON.parse(String(text || '{}'))
    } catch (caught) {
      throw new Error(`${label} 不是合法 JSON：${caught.message}`)
    }
    if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} 必须是 JSON 对象`)
    return value
  }

  const toDraft = (testCase) => ({
    id: testCase.id,
    name: testCase.name || testCase.id,
    rule: testCase.rule || '',
    inputs: JSON.stringify(testCase.inputs || {}),
    expect: JSON.stringify(testCase.expect || {}),
  })

  const openTests = useCallback(() => {
    const current = docRef.current
    if (!current) return
    setTestDrafts((current.tests || []).map(toDraft))
    setTestDefaults(JSON.stringify(current.testInputs || {}))
    setTestResults({})
    setError('')
    setModal('tests')
  }, [])

  const generateTests = useCallback(() => {
    const current = docRef.current
    if (!current) return
    const cases = generateCases(current)
    setTestDrafts(cases.map(toDraft))
    setTestResults({})
    notify(`已生成 ${cases.length} 条用例；请在默认输入里填公共入参，再补期望值`)
  }, [notify])

  const aiGenerateTests = useCallback(async () => {
    const current = docRef.current
    if (!current || busy) return
    setBusy('tests')
    setError('')
    try {
      const data = await request('/aimrule/api/tests/generate', {
        method: 'POST',
        body: JSON.stringify({ project, flow: flowId, doc: current }),
      })
      const cases = Array.isArray(data.cases) ? data.cases : []
      const generated = cases.map(toDraft)
      if (aiAppend) {
        const usedIds = new Set(testDrafts.map((draft) => draft.id))
        const usedNames = new Set(testDrafts.map((draft) => draft.name))
        const merged = [...testDrafts]
        for (const draft of generated) {
          let id = draft.id
          let suffix = 2
          while (usedIds.has(id)) {
            id = `${draft.id}_${suffix}`
            suffix += 1
          }
          usedIds.add(id)
          let name = draft.name
          let nameSuffix = 2
          while (usedNames.has(name)) {
            name = `${draft.name} ${nameSuffix}`
            nameSuffix += 1
          }
          usedNames.add(name)
          merged.push({ ...draft, id, name })
        }
        setTestDrafts(merged)
        let existingDefaults = {}
        try {
          existingDefaults = parseObject(testDefaults, '默认输入')
        } catch {
          existingDefaults = {}
        }
        setTestDefaults(JSON.stringify({ ...existingDefaults, ...(data.defaults || {}) }))
      } else {
        setTestDrafts(generated)
        setTestDefaults(JSON.stringify(data.defaults || {}))
        setTestResults({})
      }
      const note = Array.isArray(data.notes) && data.notes.length > 0 ? `；${data.notes[0]}` : ''
      notify(`AI ${aiAppend ? '追加' : '生成'} ${cases.length} 条用例${note}`)
    } catch (caught) {
      notify(caught.message || 'AI 生成测试用例失败', 'error')
    } finally {
      setBusy('')
    }
  }, [aiAppend, busy, flowId, notify, project, testDefaults, testDrafts])

  const collectTests = useCallback(() => {
    const defaults = parseObject(testDefaults, '默认输入')
    const cases = testDrafts.map((draft) => ({
      id: draft.id,
      name: draft.name || draft.id,
      rule: draft.rule || undefined,
      inputs: parseObject(draft.inputs, `用例「${draft.name}」的输入`),
      expect: parseObject(draft.expect, `用例「${draft.name}」的期望`),
    }))
    return { defaults, cases }
  }, [testDefaults, testDrafts])

  const runTests = useCallback(
    (onlyId) => {
      const current = docRef.current
      if (!current) return
      let collected
      try {
        collected = collectTests()
      } catch (caught) {
        notify(caught.message, 'error')
        return
      }
      const targets = onlyId ? collected.cases.filter((item) => item.id === onlyId) : collected.cases
      if (targets.length === 0) {
        notify('没有可运行的用例', 'error')
        return
      }
      const next = onlyId ? { ...testResults } : {}
      for (const testCase of targets) {
        next[testCase.id] = runCase(current, { ...testCase, inputs: { ...collected.defaults, ...testCase.inputs } })
      }
      setTestResults(next)
      applyDoc({ ...current, tests: collected.cases, testInputs: collected.defaults })
      const values = Object.values(next)
      const count = (status) => values.filter((item) => item.status === status).length
      notify(`运行完成：通过 ${count('pass')} · 失败 ${count('fail')} · 出错 ${count('error')} · 其他 ${count('inconclusive') + count('ok')}`)
    },
    [applyDoc, collectTests, notify, testResults],
  )

  const saveTests = useCallback(() => {
    const current = docRef.current
    if (!current) return
    try {
      const collected = collectTests()
      applyDoc({ ...current, tests: collected.cases, testInputs: collected.defaults })
      notify('用例已保存')
    } catch (caught) {
      notify(caught.message, 'error')
    }
  }, [applyDoc, collectTests, notify])

  const locateNode = useCallback((nodeId) => {
    const current = docRef.current
    if (!current || !nodeId) return
    const node = current.nodes.find((item) => item.id === nodeId)
    if (!node) return
    setModal(null)
    setFocusId(node.parentId || null)
    setSelection([node.id])
    setSelectedEdge(null)
    const stage = stageRef.current
    const rect = stage ? stage.getBoundingClientRect() : { width: 800, height: 600 }
    const position = posOf(node)
    const next = {
      k: 1,
      x: rect.width / 2 - (position.x + NODE_W / 2),
      y: rect.height / 2 - (position.y + NODE_H / 2),
    }
    viewRef.current = next
    setView(next)
  }, [])

  /* --------------------------------------------------------------- export */

  const files = useMemo(() => (doc ? buildExports(doc) : {}), [doc])
  const download = useCallback(
    (name, content) => {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = name
      anchor.click()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
    },
    [],
  )

  /* ------------------------------------------------------------- keyboard */

  useEffect(() => {
    const onKeyDown = (event) => {
      const target = event.target
      const tag = target && target.tagName ? target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || (target && target.isContentEditable)) return
      if (event.key === ' ') {
        spaceRef.current = true
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        deleteSelection()
        return
      }
      if (event.key.startsWith('Arrow') && selectionRef.current.length > 0) {
        if (modal || addMenu || canvasMenu || nodeMenu || flowMenu || moreMenu || composerMenu || composerPicker || modulePanel || toolsMenu) return
        event.preventDefault()
        const step = event.shiftKey ? 10 : 1
        nudgeSelection(
          event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0,
          event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0,
        )
        return
      }
      if (event.key === 'Escape') {
        const hadOverlay = Boolean(
          modal ||
            selection.length > 0 ||
            selectedEdge ||
            composerMenu ||
            composerPicker ||
            flowMenu ||
            moreMenu ||
            addMenu ||
            canvasMenu ||
            nodeMenu,
        )
        setSelection([])
        setSelectedEdge(null)
        setModal(null)
        setCanvasMenu(null)
        setNodeMenu(null)
        setComposerMenu(false)
        setComposerPicker(null)
        setModulePanel(false)
        setToolsMenu(false)
        setFlowMenu(false)
        setMoreMenu(false)
        setAddMenu(false)
        if (hadOverlay) return
        if (focusRef.current) {
          const current = docRef.current
          const pathNow = current ? pathOf(current, focusRef.current) : []
          drill(pathNow.length > 1 ? pathNow[pathNow.length - 2].id : null)
        }
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'c') {
        if (copySelection()) event.preventDefault()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'v') {
        if (pasteNodes()) event.preventDefault()
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      }
    }
    const onKeyUp = (event) => {
      if (event.key === ' ') spaceRef.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [addMenu, canvasMenu, composerMenu, composerPicker, copySelection, deleteSelection, drill, flowMenu, modal, modulePanel, moreMenu, nodeMenu, nudgeSelection, pasteNodes, redo, selectedEdge, selection.length, toolsMenu, undo])

  /* -------------------------------------------------------------- derived */

  const workspaceTree = useMemo(
    () => filterWorkspaceTree(buildWorkspaceTree(workspaceEntries), workspaceFilter),
    [workspaceEntries, workspaceFilter],
  )
  const visibleModules = useMemo(() => {
    const query = moduleFilter.trim().toLowerCase()
    if (!query) return modules
    return modules.filter((entry) => {
      const nodeText = (entry.nodes || [])
        .map((node) => {
          const data = node.data || {}
          return `${data.label || ''} ${data.condition || ''} ${data.action || ''} ${data.expr || ''} ${data.notes || ''}`
        })
        .join(' ')
      return `${entry.name} ${entry.flowName} ${nodeText}`.toLowerCase().includes(query)
    })
  }, [moduleFilter, modules])
  const recentEntries = useMemo(() => {
    if (moduleFilter.trim()) return []
    const byKey = new Map(modules.map((entry) => [entry.key, entry]))
    return recentKeys.map((key) => byKey.get(key)).filter(Boolean)
  }, [moduleFilter, modules, recentKeys])
  const moduleGroups = useMemo(() => {
    const flowModules =
      recentEntries.length > 0 ? visibleModules.filter((entry) => !recentKeys.includes(entry.key)) : visibleModules
    const grouped = new Map()
    for (const entry of flowModules) {
      const key = entry.flowId || entry.flowName
      if (!grouped.has(key)) grouped.set(key, { flowId: entry.flowId, flowName: entry.flowName, entries: [] })
      grouped.get(key).entries.push(entry)
    }
    return [...grouped.values()]
      .sort((a, b) => {
        const currentA = a.flowId === flowId ? 0 : 1
        const currentB = b.flowId === flowId ? 0 : 1
        return currentA - currentB || String(a.flowName).localeCompare(String(b.flowName))
      })
      .map((group) => ({ ...group, entries: [...group.entries].sort((a, b) => String(a.name).localeCompare(String(b.name))) }))
  }, [flowId, recentEntries, recentKeys, visibleModules])
  useEffect(() => {
    if (!modulePanel) return
    if (modulePreviewKey && visibleModules.some((entry) => entry.key === modulePreviewKey)) return
    setModulePreviewKey(visibleModules[0] ? visibleModules[0].key : '')
  }, [modulePanel, modulePreviewKey, visibleModules])
  const visible = useMemo(() => (doc ? scopeNodes(doc, focusId) : []), [doc, focusId])
  const visibleIds = useMemo(() => new Set(visible.map((node) => node.id)), [visible])
  const visibleEdges = useMemo(
    () => (doc ? doc.edges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)) : []),
    [doc, visibleIds],
  )
  const childCounts = useMemo(() => {
    const counts = new Map()
    if (doc) for (const node of doc.nodes) if (node.parentId) counts.set(node.parentId, (counts.get(node.parentId) || 0) + 1)
    return counts
  }, [doc])

  /* ---------------------------------------------------------------- render */

  if (!doc) {
    return h('div', { className: 'aimrule-root' }, h('style', null, CSS), h('div', { className: 'aimrule-loading' }, '正在加载 AimRule 画布…'))
  }

  const current = doc
  const positions = new Map(visible.map((node) => [node.id, posOf(node)]))
  const nodeMap = new Map(current.nodes.map((node) => [node.id, node]))
  const selectedNodes = current.nodes.filter((node) => selection.includes(node.id))
  const single = selectedNodes.length === 1 ? selectedNodes[0] : null
  const selectedEdgeObj = selectedEdge ? current.edges.find((edge) => edge.id === selectedEdge) || null : null
  const path = focusId ? pathOf(current, focusId) : []

  const renderWorkspaceNode = (node, depth) => {
    const selected = refPaths.some((item) => item.path === node.path)
    if (node.type === 'dir') {
      const open = Boolean(workspaceFilter.trim()) || Boolean(workspaceExpanded[node.path])
      return h(
        'div',
        { key: node.path, className: 'aimrule-tree-group' },
        h(
          'div',
          { className: 'aimrule-tree-row', style: { paddingLeft: `${6 + depth * 14}px` } },
          h(
            'button',
            {
              className: 'aimrule-tree-toggle',
              title: open ? '收起' : '展开',
              onClick: () => setWorkspaceExpanded((current) => ({ ...current, [node.path]: !current[node.path] })),
            },
            open ? '▾' : '▸',
          ),
          h('input', {
            type: 'checkbox',
            checked: selected,
            onChange: () => togglePathRef({ path: node.path, type: 'dir' }),
          }),
          h('span', { className: 'aimrule-menu-glyph' }, '▦'),
          h('span', { className: 'aimrule-picker-label' }, node.name),
          h('span', { className: 'aimrule-picker-meta' }, `${countTreeFiles(node)} 文件`),
        ),
        open
          ? h(
              'div',
              { className: 'aimrule-tree-children' },
              ...node.children.map((child) => renderWorkspaceNode(child, depth + 1)),
            )
          : null,
      )
    }
    return h(
      'label',
      {
        key: node.path,
        className: 'aimrule-picker-row aimrule-tree-row',
        style: { paddingLeft: `${6 + depth * 14 + 22}px` },
      },
      h('input', {
        type: 'checkbox',
        checked: selected,
        onChange: () => togglePathRef({ path: node.path, type: 'file' }),
      }),
      h('span', { className: 'aimrule-menu-glyph' }, '§'),
      h('span', { className: 'aimrule-picker-label' }, node.name),
      node.size ? h('span', { className: 'aimrule-picker-meta' }, formatBytes(node.size)) : null,
    )
  }

  const modulePreview = visibleModules.find((entry) => entry.key === modulePreviewKey) || visibleModules[0] || null
  const previewNodes = modulePreview ? (modulePreview.nodes || []).filter((node) => node.id !== modulePreview.moduleId) : []
  const renderModulePick = (entry) => {
    const nodes = (entry.nodes || []).filter((node) => node.id !== entry.moduleId)
    const summary =
      nodes
        .slice(0, 3)
        .map((node) => (node.data && node.data.label) || node.id)
        .join(' · ') || '空模块'
    return h(
      'div',
      {
        key: entry.key,
        className: 'aimrule-module-pick',
        'data-active': modulePreviewKey === entry.key,
        role: 'button',
        tabIndex: 0,
        draggable: true,
        title: '点击插入到中央，或拖到画布落点',
        onMouseEnter: () => setModulePreviewKey(entry.key),
        onFocus: () => setModulePreviewKey(entry.key),
        onDragStart: (event) => {
          moduleDragRef.current = true
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy'
            event.dataTransfer.setData('application/x-aimrule-module', entry.key)
            event.dataTransfer.setData('text/plain', entry.name)
          }
          setDraggingModule(entry)
        },
        onDragEnd: () => {
          setTimeout(() => {
            moduleDragRef.current = false
          }, 0)
          setDraggingModule(null)
        },
        onKeyDown: (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          if (!moduleDragRef.current) insertModuleFromPanel(entry)
        },
        onClick: () => {
          if (moduleDragRef.current) return
          insertModuleFromPanel(entry)
        },
      },
      h('span', { className: 'aimrule-module-grip' }, '⋮⋮'),
      h(
        'div',
        { className: 'aimrule-module-info' },
        h('b', null, entry.name),
        h('span', null, `${entry.flowName} · ${entry.nodeCount} 节点`),
        h('span', { className: 'aimrule-module-summary' }, summary),
      ),
      h('span', { className: 'aimrule-module-add' }, '＋'),
    )
  }

  const composerReady = genForm.text.trim().length > 0 || refNodes.length > 0 || selectedMessages.length > 0 || refPaths.length > 0 || uploads.length > 0

  const nodeRect = (id) => {
    const position = positions.get(id) || { x: 0, y: 0 }
    return { x: position.x, y: position.y }
  }

  const inspectorMeta = single ? TYPE_META[single.type] || TYPE_META.action : null
  const edgeSourceNode = selectedEdgeObj ? nodeMap.get(selectedEdgeObj.source) : null
  const edgeTargetNode = selectedEdgeObj ? nodeMap.get(selectedEdgeObj.target) : null
  const edgeSourceLabel = edgeSourceNode ? (edgeSourceNode.data && edgeSourceNode.data.label) || edgeSourceNode.id : ''
  const edgeTargetLabel = edgeTargetNode ? (edgeTargetNode.data && edgeTargetNode.data.label) || edgeTargetNode.id : ''

  return h(
    'div',
    { className: 'aimrule-root' },
    h('style', null, CSS),
    useSessions && !sessionId ? h(SessionWatcher, { useSessions, onResolve: setSessionId }) : null,
    h(
      'div',
      { className: 'aimrule-top' },
      h(
        'div',
        { className: 'aimrule-brand' },
        h('span', { className: 'aimrule-logo' }, h(AimRuleIcon, { size: 18 })),
        h(
          'div',
          { className: 'aimrule-title-wrap' },
          h('input', {
            className: 'aimrule-title',
            value: current.project.name,
            spellCheck: false,
            'aria-label': '流程图名称',
            style: { width: `${Math.min(280, Math.max(120, (current.project.name || '').length * 15 + 24))}px` },
            onFocus: pushHistoryOnce,
            onChange: (event) => mutate((state) => ({ ...state, project: { ...state.project, name: event.target.value } }), { history: false }),
          }),
          h(
            'button',
            {
              className: 'aimrule-title-more',
              title: '切换、新建或删除流程图',
              'aria-label': '流程图菜单',
              onClick: () => setFlowMenu((open) => !open),
              disabled: flowsLoading,
            },
            '切换',
            h('span', { className: 'aimrule-title-more-chevron' }, '▾'),
          ),
          flowMenu
            ? h(
                'div',
                { className: 'aimrule-flow-menu' },
                ...(flows.length > 0
                  ? flows.map((item) =>
                      h(
                        'button',
                        {
                          key: item.id,
                          className: 'aimrule-flow-option',
                          'data-active': item.id === flowId,
                          onClick: () => {
                            setFlowMenu(false)
                            setFlowId(item.id)
                          },
                        },
                        h('span', { className: 'aimrule-flow-option-name' }, item.name || '未命名流程图'),
                        h('span', { className: 'aimrule-flow-option-meta' }, `${item.nodes} 节点`),
                      ),
                    )
                  : [h('div', { key: 'none', className: 'aimrule-flow-option', style: { cursor: 'default', color: 'var(--aim-muted)' } }, '暂无流程图')]),
                h('div', { className: 'aimrule-flow-menu-sep' }),
                h(
                  'button',
                  {
                    className: 'aimrule-btn aimrule-new-flow-menu',
                    'data-kind': 'primary',
                    onClick: () => {
                      setFlowMenu(false)
                      createFlow()
                    },
                    disabled: busy === 'flow',
                  },
                  '＋ 新建流程图',
                ),
                h(
                  'button',
                  {
                    className: 'aimrule-flow-option',
                    'data-danger': true,
                    onClick: () => { setFlowMenu(false); deleteFlow() },
                    disabled: flows.length <= 1 || busy === 'flow',
                  },
                  '删除当前流程图',
                ),
              )
            : null,
          flowMenu ? h('div', { className: 'aimrule-flow-mask', onClick: () => setFlowMenu(false) }) : null,
        ),
        h(
          'span',
          { className: 'aimrule-sync', 'data-state': syncState, title: stateDir || '未连接 Host' },
          h('span', { className: 'aimrule-sync-label' }, syncState === 'synced' ? '已同步' : syncState === 'local' ? '仅本地' : '加载中…'),
        ),
      ),
      projectHooks
        ? h(ProjectPicker, {
            useWorkspaces: props.useWorkspaces,
            useSessions: props.useSessions,
            value: project,
            onChange: chooseProject,
          })
        : null,
      h(
        'div',
        { className: 'aimrule-actions' },
        h('div', { className: 'aimrule-top-tools' },
          h(
            'button',
            {
              className: 'aimrule-btn aimrule-tool-add',
              title: '添加节点',
              'aria-label': '添加节点',
              onClick: () => setAddMenu((open) => !open),
            },
            '＋',
          ),
          addMenu
            ? h(
                'div',
                { className: 'aimrule-add-menu' },
                h('div', { className: 'aimrule-add-menu-title' }, '添加节点'),
                ...['judge', 'calc', 'action', 'module'].map((type) =>
                  h(
                    'button',
                    {
                      key: type,
                      className: 'aimrule-add-item',
                      onClick: () => {
                        addNode(type)
                        setAddMenu(false)
                      },
                    },
                    h('span', { className: 'aimrule-dot', style: { background: TYPE_META[type].color } }),
                    h(
                      'div',
                      { className: 'aimrule-add-item-text' },
                      h('b', null, TYPE_META[type].label),
                      h('span', null, TYPE_META[type].hint),
                    ),
                  ),
                ),
              )
            : null,
          addMenu ? h('div', { className: 'aimrule-flow-mask', onClick: () => setAddMenu(false) }) : null,
          h(
            'button',
            {
              className: 'aimrule-btn aimrule-tool-pan',
              'data-active': canvasTool === 'hand',
              title:
                canvasTool === 'hand'
                  ? '拖拽模式：按住空白处拖动画布（点击切回框选）'
                  : '框选模式：拖拽空白处多选；点击切换为拖拽画布',
              'aria-label': '拖拽画布',
              onClick: () => setCanvasTool((current) => (current === 'hand' ? 'select' : 'hand')),
            },
            h(
              'svg',
              {
                width: 16,
                height: 16,
                viewBox: '0 0 24 24',
                fill: 'none',
                stroke: 'currentColor',
                strokeWidth: 1.6,
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                'aria-hidden': true,
              },
              h('path', {
                d: 'M8 12V6.5a1.5 1.5 0 0 1 3 0V11m0-1V5.5a1.5 1.5 0 0 1 3 0V11m0-1V6.5a1.5 1.5 0 0 1 3 0V11m0-1V9a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-4.6-2.1l-3.1-3.7a1.7 1.7 0 0 1 2.5-2.3L9 15m-1-6V9.5a1.5 1.5 0 0 1 3 0V12',
              }),
            ),
          ),
          h('span', { className: 'aimrule-bar-sep aimrule-tool-secondary-sep' }),
          h(
            'button',
            { className: 'aimrule-btn aimrule-tool-secondary', onClick: undo, disabled: pastRef.current.length === 0, title: '撤销 (⌘Z)', 'aria-label': '撤销' },
            '↶',
          ),
          h(
            'button',
            { className: 'aimrule-btn aimrule-tool-secondary', onClick: redo, disabled: futureRef.current.length === 0, title: '重做 (⇧⌘Z)', 'aria-label': '重做' },
            '↷',
          ),
          h('span', { className: 'aimrule-bar-sep aimrule-tool-secondary-sep' }),
          h(
            'button',
            {
              className: 'aimrule-btn aimrule-tool-secondary',
              title: '自动布局',
              'aria-label': '自动布局',
              onClick: () => {
                pushHistoryOnce()
                applyDoc(layoutState(docRef.current), { history: false })
                setTimeout(fitView, 30)
              },
            },
            '▦',
          ),
          h('span', { className: 'aimrule-bar-sep aimrule-tool-secondary-sep' }),
          h('button', { className: 'aimrule-btn aimrule-tool-secondary', onClick: () => zoomBy(1 / 1.2), title: '缩小' }, '−'),
          h('button', { className: 'aimrule-btn aimrule-tool-secondary', onClick: fitView, title: '适应画布' }, '⤢'),
          h('button', { className: 'aimrule-btn aimrule-tool-secondary', onClick: () => zoomBy(1.2), title: '放大' }, '+'),
          h('span', { className: 'aimrule-bar-sep' }),
          h(
            'div',
            { className: 'aimrule-module-wrap', ref: moduleWrapRef },
            h(
              'button',
              {
                className: 'aimrule-btn aimrule-tool-modules',
                'data-active': modulePanel,
                title: '插入模块',
                onClick: () => {
                  if (modulePanel) {
                    setModulePanel(false)
                  } else {
                    setModuleFilter('')
                    setModulePanel(true)
                    loadModules(false)
                  }
                },
              },
              h('span', null, '▦'),
              h('span', { className: 'aimrule-tool-modules-label' }, '模块'),
            ),
            modulePanel
              ? h(
                  'div',
                  { className: 'aimrule-module-popover' },
                  h(
                    'div',
                    { className: 'aimrule-module-popover-head' },
                    h('b', null, '插入模块'),
                    h('span', { className: 'aimrule-module-popover-hint' }, '悬停看内容；点击放到中央，或拖到落点'),
                    h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModulePanel(false) }, '✕'),
                  ),
                  h(
                    'div',
                    { style: { padding: '8px 10px 4px' } },
                    h('input', {
                      className: 'aimrule-input',
                      value: moduleFilter,
                      placeholder: '搜索模块、动作、条件…',
                      onChange: (event) => setModuleFilter(event.target.value),
                    }),
                  ),
                  h(
                    'div',
                    { className: 'aimrule-module-popover-body' },
                    h(
                      'div',
                      { className: 'aimrule-module-list' },
                      modulesLoading
                        ? h('p', { className: 'aimrule-hint' }, '正在扫描流程图…')
                        : modules.length === 0
                          ? h('p', { className: 'aimrule-hint' }, '当前工作区还没有模块。先在画布上框选节点，右键「合并模块」；或用完整模块库里的「AI 检测复用」。')
                          : visibleModules.length === 0
                            ? h('p', { className: 'aimrule-hint' }, '没有匹配的模块。可以搜模块名、来源流程图，或模块内部的节点名、条件、动作。')
                            : [
                                recentEntries.length > 0
                                  ? h(
                                      'div',
                                      { key: 'recent' },
                                      h(
                                        'div',
                                        { className: 'aimrule-module-group' },
                                        h('span', null, '最近使用'),
                                        h('span', { className: 'aimrule-module-group-meta' }, String(recentEntries.length)),
                                      ),
                                      ...recentEntries.map(renderModulePick),
                                    )
                                  : null,
                                ...moduleGroups.map((group) =>
                                  h(
                                    'div',
                                    { key: `group:${group.flowId || group.flowName}` },
                                    h(
                                      'div',
                                      { className: 'aimrule-module-group' },
                                      h('span', null, group.flowName),
                                      group.flowId === flowId ? h('span', { className: 'aimrule-module-current' }, '当前') : null,
                                    ),
                                    ...group.entries.map(renderModulePick),
                                  ),
                                ),
                              ],
                    ),
                    modulePreview
                      ? h(
                          'div',
                          { className: 'aimrule-module-detail' },
                          h(
                            'div',
                            { className: 'aimrule-module-detail-head' },
                            h('b', null, modulePreview.name),
                            h('span', null, `${modulePreview.flowName} · ${modulePreview.nodeCount} 节点`),
                          ),
                          h(
                            'div',
                            { className: 'aimrule-module-detail-list' },
                            previewNodes.length === 0
                              ? h('p', { className: 'aimrule-hint' }, '这个模块没有内部节点。')
                              : previewNodes.slice(0, 8).map((node) => {
                                  const meta = TYPE_META[node.type] || TYPE_META.action
                                  const data = node.data || {}
                                  const detail = data.condition ? `IF ${data.condition}` : data.expr || data.action || ''
                                  return h(
                                    'div',
                                    { key: node.id, className: 'aimrule-module-detail-node' },
                                    h('span', { className: 'aimrule-module-detail-glyph', style: { color: meta.color } }, meta.glyph),
                                    h(
                                      'span',
                                      { className: 'aimrule-module-detail-text' },
                                      h('b', null, data.label || node.id),
                                      detail ? h('span', null, detail) : null,
                                    ),
                                  )
                                }),
                          ),
                          h('p', { className: 'aimrule-module-detail-hint' }, '点击左侧插入到画布中央，或拖拽到落点。'),
                        )
                      : null,
                  ),
                  h(
                    'div',
                    { className: 'aimrule-module-popover-foot' },
                    h(
                      'button',
                      {
                        className: 'aimrule-btn',
                        'data-kind': 'ghost',
                        onClick: () => {
                          setModulePanel(false)
                          loadModules(true)
                        },
                      },
                      '完整模块库',
                    ),
                    h('span', { className: 'aimrule-composer-hint', style: { marginLeft: 'auto' } }, `${modules.length} 个模块`),
                  ),
                )
              : null,
          ),
          h(
            'div',
            { className: 'aimrule-tool-more-wrap' },
            h(
              'button',
              {
                className: 'aimrule-btn aimrule-tool-more',
                'data-active': toolsMenu,
                title: '更多画布工具',
                onClick: () => setToolsMenu((open) => !open),
              },
              '⚙',
            ),
            toolsMenu
              ? h(
                  'div',
                  { className: 'aimrule-tools-menu' },
                  h('div', { className: 'aimrule-tools-menu-title' }, '画布工具'),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      disabled: pastRef.current.length === 0,
                      onClick: () => {
                        setToolsMenu(false)
                        undo()
                      },
                    },
                    '撤销',
                    h('span', { className: 'aimrule-flow-option-meta' }, '⌘Z'),
                  ),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      disabled: futureRef.current.length === 0,
                      onClick: () => {
                        setToolsMenu(false)
                        redo()
                      },
                    },
                    '重做',
                    h('span', { className: 'aimrule-flow-option-meta' }, '⇧⌘Z'),
                  ),
                  h('div', { className: 'aimrule-flow-menu-sep' }),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      onClick: () => {
                        setToolsMenu(false)
                        pushHistoryOnce()
                        applyDoc(layoutState(docRef.current), { history: false })
                        setTimeout(fitView, 30)
                      },
                    },
                    '自动布局',
                  ),
                  h('div', { className: 'aimrule-flow-menu-sep' }),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      onClick: () => {
                        setToolsMenu(false)
                        zoomBy(1 / 1.2)
                      },
                    },
                    '缩小',
                  ),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      onClick: () => {
                        setToolsMenu(false)
                        fitView()
                      },
                    },
                    '适应画布',
                  ),
                  h(
                    'button',
                    {
                      className: 'aimrule-flow-option',
                      onClick: () => {
                        setToolsMenu(false)
                        zoomBy(1.2)
                      },
                    },
                    '放大',
                  ),
                )
              : null,
            toolsMenu ? h('div', { className: 'aimrule-flow-mask', onClick: () => setToolsMenu(false) }) : null,
          ),
        ),
        h('button', { className: 'aimrule-btn', onClick: openTests }, '测试'),
        h(
          'div',
          { className: 'aimrule-more-wrap' },
          h(
            'button',
            {
              className: 'aimrule-btn aimrule-more-trigger',
              title: '更多操作',
              'aria-label': '更多操作',
              onClick: () => setMoreMenu((open) => !open),
            },
            '⋯',
          ),
          moreMenu
            ? h(
                'div',
                { className: 'aimrule-flow-menu aimrule-more-menu' },
                h(
                  'button',
                  { className: 'aimrule-flow-option', onClick: () => { setMoreMenu(false); setModal('templates') } },
                  `模板${current.templates.length ? ` (${current.templates.length})` : ''}`,
                ),
                h(
                  'button',
                  { className: 'aimrule-flow-option', onClick: () => { setMoreMenu(false); openModules() } },
                  '模块库',
                ),
                h(
                  'button',
                  { className: 'aimrule-flow-option', onClick: () => { setMoreMenu(false); setModal('export') } },
                  '导出',
                ),
                h(
                  'button',
                  { className: 'aimrule-flow-option', onClick: () => { setMoreMenu(false); setModal('overview') } },
                  '概览与帮助',
                ),
              )
            : null,
          moreMenu ? h('div', { className: 'aimrule-flow-mask', onClick: () => setMoreMenu(false) }) : null,
        ),
      ),
    ),
    notes.length > 0
      ? h(
          'div',
          { className: 'aimrule-notes' },
          h('b', null, '待业务确认'),
          ...notes.slice(0, 3).map((note, index) => h('span', { key: index, className: 'aimrule-note' }, note)),
          notes.length > 3 ? h('span', { className: 'aimrule-note' }, `… 另有 ${notes.length - 3} 条`) : null,
          h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setNotes([]) }, '知道了'),
        )
      : null,
    h(
      'div',
      { className: 'aimrule-body' },
      h(
        'div',
        {
          className: 'aimrule-stage',
          ref: stageRef,
          'data-panning': panning,
          'data-marquee': Boolean(marquee),
          'data-tool': canvasTool,
          onMouseDown: onStageMouseDown,
          onDoubleClick: onStageDoubleClick,
          onContextMenu: onStageContextMenu,
          onDragOver: onStageDragOver,
          onDrop: onStageDrop,
        },
        focusId
          ? h(
              'div',
              { className: 'aimrule-canvas-crumbs' },
              h(
                'button',
                { className: 'aimrule-crumb-home', onClick: () => drill(null), title: '返回根画布' },
                '← 根画布',
              ),
              ...path.map((node, index) =>
                h(
                  'span',
                  { key: node.id, className: 'aimrule-crumb-wrap' },
                  h('span', { className: 'aimrule-crumb-sep' }, '›'),
                  h(
                    'button',
                    {
                      className: 'aimrule-crumb',
                      'data-current': index === path.length - 1,
                      onClick: () => drill(node.id),
                    },
                    node.data && node.data.label ? node.data.label : node.id,
                  ),
                ),
              ),
            )
          : null,
        h(
          'div',
          { className: 'aimrule-world', style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` } },
          h(
            'svg',
            { className: 'aimrule-edges', width: 6000, height: 4000 },
            h(
              'defs',
              null,
              h(
                'marker',
                { id: 'aimrule-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' },
                h('path', { d: 'M 0 0 L 10 5 L 0 10 z', style: { fill: 'var(--aimrule-edge)' } }),
              ),
            ),
            ...visibleEdges.map((edge) => {
              const from = nodeRect(edge.source)
              const to = nodeRect(edge.target)
              const pathData = edgePath(from, to)
              const midX = (from.x + NODE_W + to.x) / 2
              const midY = (from.y + to.y + NODE_H) / 2
              return h(
                'g',
                { key: edge.id, 'data-edge-id': edge.id },
                h('path', { className: 'aimrule-edge', 'data-selected': selectedEdge === edge.id, d: pathData, markerEnd: 'url(#aimrule-arrow)' }),
                h('path', {
                  className: 'aimrule-edge-hit',
                  d: pathData,
                  onMouseDown: (event) => {
                    event.stopPropagation()
                    setSelectedEdge(edge.id)
                    setSelection([])
                    selectionRef.current = []
                  },
                }),
                edge.label ? h('text', { className: 'aimrule-edge-label', x: midX, y: midY - 4, textAnchor: 'middle' }, edge.label) : null,
              )
            }),
            pendingEdge
              ? h('path', {
                  className: 'aimrule-edge',
                  style: { strokeDasharray: '5 4', stroke: 'var(--dsw-alias-brand-primary)' },
                  d: edgePath({ x: pendingEdge.start.x - NODE_W, y: pendingEdge.start.y - NODE_H / 2 }, { x: pendingEdge.cursor.x, y: pendingEdge.cursor.y - NODE_H / 2 }),
                })
              : null,
          ),
          ...visible.map((node) =>
            h(NodeCard, {
              key: node.id,
              node,
              selected: selection.includes(node.id),
              connectTarget: connectTarget === node.id,
              childCount: childCounts.get(node.id) || 0,
              onMouseDown: (event) => beginNodeDrag(event, node),
              onDoubleClick: (event) => {
                if (node.type === 'module') {
                  event.stopPropagation()
                  drill(node.id)
                }
              },
              onConnectStart: beginConnect,
              onConnectEnd: finishConnect,
            }),
          ),
        ),
        visible.length === 0
          ? h(
              'div',
              { className: 'aimrule-hero' },
              h('span', { className: 'aimrule-eyebrow' }, focusId ? '空模块' : '开始'),
              h('h2', null, focusId ? '这个模块还是空的' : '把条文，变成可执行的规则'),
              h(
                'p',
                null,
                focusId
                  ? '从画布工具条「＋」添加节点，或回到根画布把已有节点封装进来。'
                  : '在下方描述目标，用 ＋ 引用节点、对话记录或工作区文件；也可以直接粘贴原文。空白处拖拽框选；点手形工具或按住空格拖拽画布。',
              ),
              focusId
                ? null
                : h(
                    'button',
                    {
                      className: 'aimrule-hero-link',
                      onClick: () => {
                        applyDoc(demoDoc())
                        setTimeout(fitView, 40)
                      },
                    },
                    '载入示例',
                  ),
            )
          : null,
        marquee ? h('div', { className: 'aimrule-marquee', style: { left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h } }) : null,
        (composerMenu || composerPicker)
          ? h('div', {
              className: 'aimrule-composer-mask',
              onClick: () => {
                setComposerMenu(false)
                setComposerPicker(null)
              },
            })
          : null,
        modal === null
          ? h(
              'div',
              { className: 'aimrule-composer' },
              refNodes.length > 0 || refPaths.length > 0 || selectedMessages.length > 0 || uploads.length > 0
                ? h(
                    'div',
                    { className: 'aimrule-composer-chips' },
                    ...refNodes.map((id) => {
                      const node = nodeMap.get(id)
                      if (!node) return null
                      const meta = TYPE_META[node.type] || TYPE_META.action
                      return h(
                        'span',
                        { key: `node:${id}`, className: 'aimrule-composer-chip' },
                        h('span', { className: 'aimrule-dot', style: { background: meta.color } }),
                        `@${(node.data && node.data.label) || id}`,
                        h('button', { title: '移除', onClick: () => toggleNodeRef(id) }, '✕'),
                      )
                    }),
                    ...refPaths.map((item) =>
                      h(
                        'span',
                        { key: `path:${item.path}`, className: 'aimrule-composer-chip' },
                        item.type === 'dir' ? '▦' : '§',
                        item.path,
                        h('button', { title: '移除', onClick: () => setRefPaths((current) => current.filter((entry) => entry.path !== item.path)) }, '✕'),
                      ),
                    ),
                    selectedMessages.length > 0
                      ? h(
                          'span',
                          { className: 'aimrule-composer-chip' },
                          '◌',
                          `对话 ${selectedMessages.length} 条`,
                          h('button', { title: '移除', onClick: () => setSelectedMessages([]) }, '✕'),
                        )
                      : null,
                    ...uploads.map((item) =>
                      h(
                        'span',
                        { key: item.key, className: 'aimrule-composer-chip' },
                        '↥',
                        item.path || item.name,
                        h('button', { title: '移除', onClick: () => removeFile(item.key) }, '✕'),
                      ),
                    ),
                  )
                : null,
              h(
                'div',
                { className: 'aimrule-composer-box' },
                h(
                  'button',
                  {
                    className: 'aimrule-composer-add',
                    title: '添加引用或附件',
                    'aria-label': '添加引用或附件',
                    onClick: () => setComposerMenu((open) => !open),
                  },
                  '＋',
                ),
                h('textarea', {
                  ref: composerRef,
                  className: 'aimrule-composer-input',
                  rows: 1,
                  value: genForm.text,
                  placeholder: '描述规则，或用 ＋ 引用节点、对话记录、工作区文件…',
                  onChange: (event) => setGenForm({ ...genForm, text: event.target.value }),
                  onKeyDown: (event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      submitComposer()
                    }
                  },
                }),
                h(
                  'button',
                  {
                    className: 'aimrule-composer-send',
                    title: '生成',
                    'aria-label': '生成',
                    onClick: submitComposer,
                    disabled: busy === 'generate' || !composerReady,
                  },
                  busy === 'generate' ? '…' : '↑',
                ),
              ),
              h(
                'div',
                { className: 'aimrule-composer-foot' },
                h('span', { className: 'aimrule-spacer' }),
                h(
                  'span',
                  { className: 'aimrule-composer-hint' },
                  busy === 'generate' ? '正在提炼…' : 'Enter 生成 · Shift+Enter 换行',
                ),
              ),
              h('input', {
                ref: filesInputRef,
                type: 'file',
                multiple: true,
                style: { display: 'none' },
                onChange: (event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                },
              }),
              h('input', {
                ref: folderInputRef,
                type: 'file',
                multiple: true,
                webkitdirectory: '',
                directory: '',
                style: { display: 'none' },
                onChange: (event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                },
              }),
              composerMenu
                ? h(
                    'div',
                    { className: 'aimrule-composer-menu' },
                    h(
                      'button',
                      { className: 'aimrule-composer-menu-item', onClick: () => { setComposerMenu(false); if (filesInputRef.current) filesInputRef.current.click() } },
                      h('span', { className: 'aimrule-menu-glyph' }, '↥'),
                      '上传附件',
                    ),
                    h(
                      'button',
                      { className: 'aimrule-composer-menu-item', onClick: () => { setComposerMenu(false); if (folderInputRef.current) folderInputRef.current.click() } },
                      h('span', { className: 'aimrule-menu-glyph' }, '↥'),
                      '上传文件夹',
                    ),
                    h('div', { className: 'aimrule-flow-menu-sep' }),
                    h(
                      'button',
                      { className: 'aimrule-composer-menu-item', onClick: () => openComposerPicker('workspace') },
                      h('span', { className: 'aimrule-menu-glyph' }, '⌂'),
                      '工作区文件',
                    ),
                    h(
                      'button',
                      { className: 'aimrule-composer-menu-item', onClick: () => openComposerPicker('chat') },
                      h('span', { className: 'aimrule-menu-glyph' }, '◌'),
                      '对话记录',
                    ),
                    h(
                      'button',
                      { className: 'aimrule-composer-menu-item', onClick: () => openComposerPicker('nodes') },
                      h('span', { className: 'aimrule-menu-glyph' }, '⬡'),
                      '流程图节点',
                    ),
                  )
                : null,
              composerPicker
                ? h(
                    'div',
                    { className: 'aimrule-composer-picker' },
                    h(
                      'div',
                      { className: 'aimrule-picker-head' },
                      h(
                        'b',
                        null,
                        composerPicker === 'nodes'
                          ? '引用流程图节点'
                          : composerPicker === 'chat'
                            ? '引用对话记录'
                            : '引用工作区文件/文件夹',
                      ),
                      h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setComposerPicker(null) }, '✕'),
                    ),
                    composerPicker === 'nodes'
                      ? h(
                          'div',
                          { className: 'aimrule-picker-body' },
                          h('input', {
                            className: 'aimrule-input',
                            value: nodeFilter,
                            placeholder: '搜索节点或模块…',
                            onChange: (event) => setNodeFilter(event.target.value),
                          }),
                          h(
                            'div',
                            { className: 'aimrule-picker-list' },
                            ...current.nodes
                              .filter((node) => {
                                const query = nodeFilter.trim().toLowerCase()
                                if (!query) return true
                                return `${(node.data && node.data.label) || ''} ${node.id} ${node.type}`.toLowerCase().includes(query)
                              })
                              .map((node) => {
                                const meta = TYPE_META[node.type] || TYPE_META.action
                                return h(
                                  'label',
                                  { key: node.id, className: 'aimrule-picker-row' },
                                  h('input', {
                                    type: 'checkbox',
                                    checked: refNodes.includes(node.id),
                                    onChange: () => toggleNodeRef(node.id),
                                  }),
                                  h('span', { className: 'aimrule-dot', style: { background: meta.color } }),
                                  h('span', { className: 'aimrule-picker-label' }, (node.data && node.data.label) || node.id),
                                  h('span', { className: 'aimrule-picker-meta' }, meta.label),
                                )
                              }),
                          ),
                        )
                      : composerPicker === 'chat'
                        ? h(
                            'div',
                            { className: 'aimrule-picker-body' },
                            transcriptLoading
                              ? h('p', { className: 'aimrule-hint' }, '正在读取当前会话…')
                              : !sessionId
                                ? h('p', { className: 'aimrule-hint' }, '当前没有打开的会话。')
                                : transcriptItems.length === 0
                                  ? h('p', { className: 'aimrule-hint' }, '当前会话还没有可用的对话记录。')
                                  : h(
                                      'div',
                                      { className: 'aimrule-picker-list' },
                                      ...transcriptItems.map((item, index) =>
                                        h(
                                          'label',
                                          { key: `${item.seq || index}-${index}`, className: 'aimrule-picker-row aimrule-picker-row-chat' },
                                          h('input', {
                                            type: 'checkbox',
                                            checked: selectedMessages.includes(index),
                                            onChange: () => toggleMessage(index),
                                          }),
                                          h(
                                            'span',
                                            { className: 'aimrule-role', 'data-role': item.role === '助手' ? 'assistant' : 'user' },
                                            item.role,
                                          ),
                                          h('span', { className: 'aimrule-convo-text', title: item.text }, item.text),
                                        ),
                                      ),
                                    ),
                          )
                        : h(
                            'div',
                            { className: 'aimrule-picker-body' },
                            h('input', {
                              className: 'aimrule-input',
                              value: workspaceFilter,
                              placeholder: '搜索工作区文件或文件夹…',
                              onChange: (event) => setWorkspaceFilter(event.target.value),
                            }),
                            workspaceLoading
                              ? h('p', { className: 'aimrule-hint' }, '正在读取工作区…')
                              : h(
                                  'div',
                                  { className: 'aimrule-picker-list aimrule-file-tree' },
                                  ...workspaceTree.map((node) => renderWorkspaceNode(node, 0)),
                                ),
                            !workspaceLoading && workspaceTree.length === 0
                              ? h('p', { className: 'aimrule-hint' }, '工作区里没有可引用的文件。')
                              : null,
                          ),
                    h(
                      'div',
                      { className: 'aimrule-picker-foot' },
                      h(
                        'span',
                        { className: 'aimrule-composer-hint' },
                        composerPicker === 'chat'
                          ? `已选 ${selectedMessages.length} 条`
                          : composerPicker === 'nodes'
                            ? `已选 ${refNodes.length} 个节点`
                            : `已选 ${refPaths.length} 项`,
                      ),
                      h('span', { className: 'aimrule-spacer' }),
                      composerPicker === 'chat'
                        ? h(
                            'button',
                            { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: selectAllMessages },
                            '全选',
                          )
                        : null,
                      composerPicker === 'chat'
                        ? h(
                            'button',
                            { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: clearMessages },
                            '清空',
                          )
                        : null,
                      h('button', { className: 'aimrule-btn', 'data-kind': 'primary', onClick: () => setComposerPicker(null) }, '完成'),
                    ),
                  )
                : null,
            )
          : null,
        toast ? h('div', { className: 'aimrule-toast', 'data-tone': toast.tone }, toast.text) : null,
        canvasMenu || nodeMenu
          ? h('div', {
              className: 'aimrule-flow-mask',
              onClick: () => {
                setCanvasMenu(null)
                setNodeMenu(null)
              },
            })
          : null,
        canvasMenu
          ? h(
              'div',
              {
                className: 'aimrule-canvas-menu',
                style: { left: canvasMenu.x, top: canvasMenu.y },
                onMouseDown: (event) => event.stopPropagation(),
                onContextMenu: (event) => event.preventDefault(),
              },
              h('div', { className: 'aimrule-canvas-menu-title' }, '新建节点'),
              ...['start', 'judge', 'calc', 'action', 'end', 'module'].map((type) =>
                h(
                  'button',
                  {
                    key: type,
                    className: 'aimrule-add-item',
                    onClick: () => {
                      addNode(type, canvasMenu.world)
                      setCanvasMenu(null)
                    },
                  },
                  h('span', { className: 'aimrule-dot', style: { background: TYPE_META[type].color } }),
                  h('span', null, TYPE_META[type].label),
                ),
              ),
              h('div', { className: 'aimrule-flow-menu-sep' }),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  disabled: selection.length === 0,
                  onClick: () => {
                    copySelection()
                    setCanvasMenu(null)
                  },
                },
                h('span', { className: 'aimrule-menu-glyph' }, '⧉'),
                '复制',
                selection.length > 0
                  ? h('span', { className: 'aimrule-canvas-menu-meta' }, `${selection.length} 个`)
                  : null,
              ),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  disabled: !nodeClipboardRef.current,
                  onClick: () => {
                    pasteNodes(canvasMenu.world)
                    setCanvasMenu(null)
                  },
                },
                h('span', { className: 'aimrule-menu-glyph' }, '▣'),
                '粘贴',
              ),
            )
          : null,
        nodeMenu
          ? h(
              'div',
              {
                className: 'aimrule-canvas-menu aimrule-node-menu',
                style: { left: nodeMenu.x, top: nodeMenu.y },
                onMouseDown: (event) => event.stopPropagation(),
                onContextMenu: (event) => event.preventDefault(),
              },
              h(
                'div',
                { className: 'aimrule-canvas-menu-title' },
                nodeMenu.ids.length > 1 ? `${nodeMenu.ids.length} 个节点` : '节点操作',
              ),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  onClick: () => {
                    copySelection(nodeMenu.ids)
                    setNodeMenu(null)
                  },
                },
                h('span', { className: 'aimrule-menu-glyph' }, '⧉'),
                '复制',
              ),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  onClick: () => addNodesToComposer(nodeMenu.ids),
                },
                h('span', { className: 'aimrule-menu-glyph' }, '＋'),
                '添加到对话框',
              ),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  disabled: nodeMenu.ids.length < 2,
                  title: nodeMenu.ids.length < 2 ? '框选多个节点后合并' : '把选中节点合并成一个模块',
                  onClick: () => {
                    encapsulate(nodeMenu.ids)
                    setNodeMenu(null)
                  },
                },
                h('span', { className: 'aimrule-menu-glyph' }, '▣'),
                '合并模块',
              ),
              h('div', { className: 'aimrule-flow-menu-sep' }),
              h(
                'button',
                {
                  className: 'aimrule-add-item',
                  'data-danger': true,
                  onClick: () => {
                    deleteSelection(nodeMenu.ids)
                    setNodeMenu(null)
                  },
                },
                h('span', { className: 'aimrule-menu-glyph' }, '⌫'),
                '删除节点',
              ),
            )
          : null,
      ),
      (single || selectedEdgeObj || selection.length > 1)
        ? h(
            'aside',
            { className: 'aimrule-inspector' },
            h(
              'div',
              { className: 'aimrule-inspector-head' },
              single && inspectorMeta
                ? h(
                    'span',
                    {
                      className: 'aimrule-inspector-glyph',
                      style: {
                        color: inspectorMeta.color,
                        background: `color-mix(in srgb, ${inspectorMeta.color} 12%, transparent)`,
                      },
                    },
                    inspectorMeta.glyph,
                  )
                : null,
              h(
                'div',
                { className: 'aimrule-inspector-title' },
                h('h3', null, single ? single.data.label || '未命名节点' : selectedEdgeObj ? '连线属性' : `${selection.length} 个节点`),
                single && inspectorMeta
                  ? h('span', { className: 'aimrule-inspector-sub' }, `${inspectorMeta.label} · ${single.id}`)
                  : selectedEdgeObj
                    ? h('span', { className: 'aimrule-inspector-sub' }, `${edgeSourceLabel} → ${edgeTargetLabel}`)
                    : null,
              ),
              h(
                'button',
                {
                  className: 'aimrule-btn',
                  'data-kind': 'ghost',
                  title: '关闭属性面板',
                  onClick: () => {
                    setSelection([])
                    setSelectedEdge(null)
                  },
                },
                '✕',
              ),
            ),
            h(
              'div',
              { className: 'aimrule-inspector-body' },
              single
                ? [
                    h(
                      'div',
                      { key: 'basic', className: 'aimrule-panel-section' },
                      h('h3', null, '基本信息'),
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '类型'),
                        h(
                          'select',
                          {
                            className: 'aimrule-select',
                            value: single.type,
                            onChange: (event) =>
                              mutate((state) => ({
                                ...state,
                                nodes: state.nodes.map((node) => (node.id === single.id ? { ...node, type: event.target.value } : node)),
                              })),
                          },
                          ...TYPE_ORDER.map((type) => h('option', { key: type, value: type }, TYPE_META[type].label)),
                        ),
                      ),
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '名称'),
                        h('input', {
                          className: 'aimrule-input',
                          value: single.data.label || '',
                          onFocus: pushHistoryOnce,
                          onChange: (event) => patchNode(single.id, { label: event.target.value }),
                        }),
                      ),
                    ),
                    h(
                      'div',
                      { key: 'rule', className: 'aimrule-panel-section' },
                      h('h3', null, '规则'),
                      single.type === 'judge'
                        ? h(
                            'div',
                            { className: 'aimrule-field' },
                            h('span', { className: 'aimrule-field-label' }, '判断条件'),
                            h('textarea', {
                              className: 'aimrule-textarea',
                              value: single.data.condition || '',
                              placeholder: '例如：指标 > 阈值',
                              onFocus: pushHistoryOnce,
                              onChange: (event) => patchNode(single.id, { condition: event.target.value }),
                            }),
                          )
                        : null,
                      single.type === 'calc'
                        ? h(
                            'div',
                            { className: 'aimrule-field' },
                            h('span', { className: 'aimrule-field-label' }, '计算公式'),
                            h('input', {
                              className: 'aimrule-input',
                              value: single.data.expr || '',
                              placeholder: '例如：基数 * 系数',
                              onFocus: pushHistoryOnce,
                              onChange: (event) => patchNode(single.id, { expr: event.target.value }),
                            }),
                          )
                        : null,
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '执行动作'),
                        h('input', {
                          className: 'aimrule-input',
                          value: single.data.action || '',
                          placeholder: '例如：ESCALATE',
                          onFocus: pushHistoryOnce,
                          onChange: (event) => patchNode(single.id, { action: event.target.value }),
                        }),
                      ),
                    ),
                    h(
                      'div',
                      { key: 'trace', className: 'aimrule-panel-section' },
                      h('h3', null, '溯源与备注'),
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '原文条款'),
                        h('input', {
                          className: 'aimrule-input',
                          value: single.data.sourceRef || '',
                          placeholder: '例如：原文第 3 条',
                          onFocus: pushHistoryOnce,
                          onChange: (event) => patchNode(single.id, { sourceRef: event.target.value }),
                        }),
                      ),
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '隐含前提 / 备注'),
                        h('textarea', {
                          className: 'aimrule-textarea',
                          value: single.data.notes || '',
                          placeholder: '记录口径、例外或【待补充】',
                          onFocus: pushHistoryOnce,
                          onChange: (event) => patchNode(single.id, { notes: event.target.value }),
                        }),
                      ),
                    ),
                  ]
                : selectedEdgeObj
                  ? h(
                      'div',
                      { className: 'aimrule-panel-section' },
                      h('h3', null, '连线'),
                      h(
                        'div',
                        { className: 'aimrule-field' },
                        h('span', { className: 'aimrule-field-label' }, '分支标签'),
                        h('input', {
                          className: 'aimrule-input',
                          value: selectedEdgeObj.label || '',
                          placeholder: '是 / 否 / 其他条件',
                          onFocus: pushHistoryOnce,
                          onChange: (event) =>
                            mutate((state) => ({
                              ...state,
                              edges: state.edges.map((edge) => (edge.id === selectedEdgeObj.id ? { ...edge, label: event.target.value } : edge)),
                            }), { history: false }),
                        }),
                      ),
                      h(
                        'div',
                        { className: 'aimrule-edge-path' },
                        `${nodeMap.get(selectedEdgeObj.source) ? nodeMap.get(selectedEdgeObj.source).data.label : selectedEdgeObj.source} → ${nodeMap.get(selectedEdgeObj.target) ? nodeMap.get(selectedEdgeObj.target).data.label : selectedEdgeObj.target}`,
                      ),
                    )
                  : [
                      h(
                        'div',
                        { key: 'selected', className: 'aimrule-panel-section' },
                        h('h3', null, '已选节点'),
                        h(
                          'div',
                          { className: 'aimrule-selection-list' },
                          ...selection.map((id) => {
                            const node = nodeMap.get(id)
                            if (!node) return null
                            const meta = TYPE_META[node.type] || TYPE_META.action
                            return h(
                              'div',
                              { key: id, className: 'aimrule-selection-row' },
                              h('span', { className: 'aimrule-dot', style: { background: meta.color } }),
                              h('span', { className: 'aimrule-selection-name' }, (node.data && node.data.label) || id),
                              h('span', { className: 'aimrule-picker-meta' }, meta.label),
                            )
                          }),
                        ),
                      ),
                      h(
                        'div',
                        { key: 'batch', className: 'aimrule-panel-section' },
                        h('h3', null, '批量操作'),
                        h('p', { className: 'aimrule-hint' }, '右键任一选中节点，可复制、加入对话框或合并模块。'),
                      ),
                    ],
            ),
            h(
              'div',
              { className: 'aimrule-inspector-foot' },
              single
                ? [
                    single.type === 'module'
                      ? h(
                          'button',
                          { key: 'enter', className: 'aimrule-btn', onClick: () => { drill(single.id) } },
                          `进入模块（${childCounts.get(single.id) || 0} 项）`,
                        )
                      : null,
                    single.type === 'module'
                      ? h('button', { key: 'ungroup', className: 'aimrule-btn', onClick: () => ungroup(single.id) }, '解散模块')
                      : null,
                    h('button', { key: 'delete', className: 'aimrule-btn', 'data-kind': 'danger', onClick: deleteSelection }, '删除节点'),
                  ]
                : selectedEdgeObj
                  ? h('button', { className: 'aimrule-btn', 'data-kind': 'danger', onClick: deleteSelection }, '删除连线')
                  : [
                      h('button', { key: 'group', className: 'aimrule-btn', onClick: encapsulate }, '合并为模块'),
                      h('button', { key: 'delete', className: 'aimrule-btn', 'data-kind': 'danger', onClick: deleteSelection }, '删除所选'),
                    ],
            ),
          )
        : null,
    ),
    modal === 'export'
      ? h(
          'div',
          { className: 'aimrule-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setModal(null) } },
          h(
            'div',
            { className: 'aimrule-modal' },
            h(
              'div',
              { className: 'aimrule-modal-head' },
              h('h2', null, '导出开发上下文'),
              h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModal(null) }, '✕'),
            ),
            h(
              'div',
              { className: 'aimrule-tabs' },
              ...Object.keys(files).map((file) =>
                h('button', { key: file, className: 'aimrule-tab', 'data-active': exportTab === file, onClick: () => setExportTab(file) }, file),
              ),
            ),
            h('div', { className: 'aimrule-modal-body', style: { paddingTop: 8 } }, h('pre', { className: 'aimrule-pre' }, files[exportTab] || '')),
            h(
              'div',
              { className: 'aimrule-modal-foot' },
              h('span', { className: 'aimrule-hint', style: { marginRight: 'auto' } }, `${current.nodes.length} 个节点 · 4 份产物`),
              h(
                'button',
                {
                  className: 'aimrule-btn',
                  onClick: () => {
                    const all = Object.entries(files).map(([name, content]) => `\n\n---\n\n# ${name}\n\n${content}`).join('')
                    if (navigator.clipboard) navigator.clipboard.writeText(all.trim()).then(() => notify('已复制全部产物'), () => notify('复制失败', 'error'))
                  },
                },
                '复制全部',
              ),
              h('button', { className: 'aimrule-btn', onClick: () => download(exportTab, files[exportTab] || '') }, '下载当前'),
              h('button', { className: 'aimrule-btn', 'data-kind': 'primary', onClick: () => Object.entries(files).forEach(([name, content]) => download(name, content)) }, '下载全部'),
            ),
          ),
        )
      : null,
    modal === 'templates'
      ? h(
          'div',
          { className: 'aimrule-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setModal(null) } },
          h(
            'div',
            { className: 'aimrule-modal' },
            h(
              'div',
              { className: 'aimrule-modal-head' },
              h('h2', null, '模板库'),
              h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModal(null) }, '✕'),
            ),
            h(
              'div',
              { className: 'aimrule-modal-body' },
              h(
                'div',
                { style: { display: 'flex', gap: 8 } },
                h('input', {
                  className: 'aimrule-input',
                  value: templateName,
                  placeholder: '为当前选中的节点命名模板',
                  onChange: (event) => setTemplateName(event.target.value),
                }),
                h('button', { className: 'aimrule-btn', onClick: saveTemplate, disabled: selection.length === 0 }, '存为模板'),
              ),
              current.templates.length === 0
                ? h('p', { className: 'aimrule-hint' }, '还没有模板。在画布上框选一组节点，取个名字保存；下次可直接插入复用。')
                : null,
              ...current.templates.map((template) =>
                h(
                  'div',
                  { key: template.id, className: 'aimrule-tpl' },
                  h(
                    'div',
                    { className: 'aimrule-tpl-info' },
                    h('b', null, template.name),
                    h('span', null, `${template.nodes.length} 个节点 · ${template.edges.length} 条连线`),
                  ),
                  h('button', { className: 'aimrule-btn', onClick: () => insertTemplate(template) }, '插入'),
                  h(
                    'button',
                    {
                      className: 'aimrule-btn',
                      style: { color: 'var(--dsw-alias-state-error-primary)' },
                      onClick: () => mutate((state) => ({ ...state, templates: state.templates.filter((item) => item.id !== template.id) })),
                    },
                    '删除',
                  ),
                ),
              ),
            ),
            h('div', { className: 'aimrule-modal-foot' }, h('button', { className: 'aimrule-btn', onClick: () => setModal(null) }, '关闭')),
          ),
        )
      : null,
    modal === 'tests'
      ? h(
          'div',
          { className: 'aimrule-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setModal(null) } },
          h(
            'div',
            { className: 'aimrule-modal', style: { width: 'min(920px, 100%)' } },
            h(
              'div',
              { className: 'aimrule-modal-head' },
              h('h2', null, '测试验证'),
              h('span', { className: 'aimrule-hint' }, `${testDrafts.length} 条用例`),
              h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModal(null) }, '✕'),
            ),
            h(
              'div',
              { className: 'aimrule-modal-body' },
              h(
                'div',
                { className: 'aimrule-hint' },
                '默认输入会与每条用例的输入合并；期望值为空表示只跑通、不校验。变量名须与判断条件和公式里的一致，公式写成「指标 = 基数 * 系数」。',
              ),
              h(
                'div',
                { className: 'aimrule-field' },
                h('span', { className: 'aimrule-field-label' }, '默认输入（所有用例共用）'),
                h('textarea', {
                  className: 'aimrule-textarea',
                  style: { minHeight: 44, fontFamily: 'ui-monospace, Menlo, monospace' },
                  value: testDefaults,
                  placeholder: '{"基数": 100, "系数": 0.3}',
                  onChange: (event) => setTestDefaults(event.target.value),
                }),
              ),
              h(
                'div',
                { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
                h('button', { className: 'aimrule-btn', onClick: generateTests }, '从画布生成用例'),
                h('button', { className: 'aimrule-btn', onClick: aiGenerateTests, disabled: busy === 'tests' }, busy === 'tests' ? 'AI 生成中…' : '✦ AI 生成'),
                h(
                  'label',
                  { className: 'aimrule-ai-append', title: '勾选时保留现有用例，只追加新用例' },
                  h('input', {
                    type: 'checkbox',
                    checked: aiAppend,
                    onChange: (event) => setAiAppend(event.target.checked),
                  }),
                  '追加',
                ),
                h(
                  'button',
                  {
                    className: 'aimrule-btn',
                    'data-kind': 'ghost',
                    disabled: testDrafts.length === 0,
                    onClick: () => {
                      setTestDrafts([])
                      setTestResults({})
                    },
                  },
                  '清空用例',
                ),
                h('button', { className: 'aimrule-btn', 'data-kind': 'primary', onClick: () => runTests(), disabled: testDrafts.length === 0 }, '全部运行'),
                h('button', { className: 'aimrule-btn', onClick: saveTests, disabled: testDrafts.length === 0 }, '保存用例'),
              ),
              testDrafts.length === 0
                ? h('p', { className: 'aimrule-hint' }, '还没有用例。「从画布生成用例」按每个判断节点生成命中/未命中两条；「✦ AI 生成」由模型结合条件、公式和来源补全输入与期望，运行后再校准。')
                : null,
              ...testDrafts.map((draft, index) => {
                const result = testResults[draft.id]
                const status = result ? result.status : 'idle'
                const badge = { pass: '通过', fail: '失败', error: '出错', inconclusive: '不确定', ok: '跑通', idle: '待跑' }[status] || status
                const traceTail = result && Array.isArray(result.trace) && result.trace.length > 0
                  ? result.trace.slice(-2).map((item) => item.detail).filter(Boolean).join(' → ')
                  : ''
                return h(
                  'div',
                  { key: draft.id, className: 'aimrule-case' },
                  h(
                    'div',
                    { className: 'aimrule-case-head' },
                    h('span', { className: 'aimrule-badge', 'data-status': status }, badge),
                    h('input', {
                      className: 'aimrule-input',
                      style: { flex: 1 },
                      value: draft.name,
                      onChange: (event) => {
                        const next = testDrafts.slice()
                        next[index] = { ...draft, name: event.target.value }
                        setTestDrafts(next)
                      },
                    }),
                    h('button', { className: 'aimrule-btn', onClick: () => runTests(draft.id) }, '运行'),
                    h(
                      'button',
                      {
                        className: 'aimrule-btn aimrule-case-delete',
                        'data-kind': 'ghost',
                        title: '删除用例',
                        onClick: () => {
                          setTestDrafts((current) => current.filter((_, itemIndex) => itemIndex !== index))
                          const next = { ...testResults }
                          delete next[draft.id]
                          setTestResults(next)
                        },
                      },
                      '✕',
                    ),
                  ),
                  h(
                    'div',
                    { className: 'aimrule-case-grid' },
                    h(
                      'div',
                      { className: 'aimrule-field' },
                      h('span', { className: 'aimrule-field-label' }, '输入'),
                      h('textarea', {
                        className: 'aimrule-textarea',
                        style: { minHeight: 40, fontFamily: 'ui-monospace, Menlo, monospace' },
                        value: draft.inputs,
                        onChange: (event) => {
                          const next = testDrafts.slice()
                          next[index] = { ...draft, inputs: event.target.value }
                          setTestDrafts(next)
                        },
                      }),
                    ),
                    h(
                      'div',
                      { className: 'aimrule-field' },
                      h('span', { className: 'aimrule-field-label' }, '期望'),
                      h('textarea', {
                        className: 'aimrule-textarea',
                        style: { minHeight: 40, fontFamily: 'ui-monospace, Menlo, monospace' },
                        value: draft.expect,
                        placeholder: '{"指标": 30}',
                        onChange: (event) => {
                          const next = testDrafts.slice()
                          next[index] = { ...draft, expect: event.target.value }
                          setTestDrafts(next)
                        },
                      }),
                    ),
                  ),
                  result
                    ? h(
                        'div',
                        { className: 'aimrule-case-result' },
                        result.message ? h('span', null, result.message) : null,
                        ...(result.mismatches || []).map((item) =>
                          h('span', { key: item.key, className: 'aimrule-mismatch' }, `${item.key}: 期望 ${JSON.stringify(item.expected)}，实际 ${JSON.stringify(item.actual)}`),
                        ),
                        traceTail && !result.message ? h('span', { className: 'aimrule-muted' }, traceTail) : null,
                        result.nodeId
                          ? h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => locateNode(result.nodeId) }, '定位节点')
                          : null,
                      )
                    : null,
                )
              }),
            ),
            h(
              'div',
              { className: 'aimrule-modal-foot' },
              h('span', { className: 'aimrule-hint', style: { marginRight: 'auto' } }, '运行会同时把用例保存进画布文档'),
              h('button', { className: 'aimrule-btn', onClick: () => setModal(null) }, '关闭'),
            ),
          ),
        )
      : null,
    modal === 'modules'
      ? h(
          'div',
          {
            className: 'aimrule-overlay',
            'data-dragging': Boolean(draggingModule),
            onMouseDown: (event) => { if (event.target === event.currentTarget) setModal(null) },
          },
          h(
            'div',
            { className: 'aimrule-modal', style: { width: 'min(820px, 100%)' } },
            h(
              'div',
              { className: 'aimrule-modal-head' },
              h('h2', null, '跨流程图模块库'),
              h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModal(null) }, '✕'),
            ),
            h(
              'div',
              { className: 'aimrule-modal-body' },
              h(
                'div',
                { className: 'aimrule-hint' },
                '汇总当前工作区所有流程图里的模块，用于管理和 AI 检测复用。插入请用顶栏的「模块」快速选择器：可点击放到中央，也可拖到画布落点。',
              ),
              h(
                'div',
                { className: 'aimrule-detect' },
                h(
                  'button',
                  {
                    className: 'aimrule-btn',
                    'data-kind': 'primary',
                    onClick: detectModules,
                    disabled: detectBusy,
                  },
                  detectBusy ? '检测中…' : '✦ AI 检测复用',
                ),
                h('span', { className: 'aimrule-hint' }, '扫描工作区所有流程图，找出重复出现的子图并抽成模块'),
              ),
              candidates.length > 0
                ? h(
                    'div',
                    { className: 'aimrule-candidates' },
                    ...candidates.map((candidate, index) =>
                      h(
                        'div',
                        { key: `${candidate.name}-${index}`, className: 'aimrule-candidate' },
                        h(
                          'div',
                          { className: 'aimrule-candidate-head' },
                          h('b', null, candidate.name),
                          candidate.reason ? h('span', null, candidate.reason) : null,
                        ),
                        ...candidate.occurrences.map((occurrence) =>
                          h(
                            'div',
                            {
                              key: `${occurrence.flowId}:${occurrence.nodeIds.join(',')}`,
                              className: 'aimrule-candidate-occ',
                            },
                            h('span', null, `${occurrence.flowName} · ${occurrence.nodeIds.length} 节点`),
                            h(
                              'button',
                              {
                                className: 'aimrule-btn',
                                onClick: () => extractCandidate(candidate, occurrence),
                                disabled: Boolean(extractBusy),
                              },
                              extractBusy === `${occurrence.flowId}:${candidate.name}` ? '抽取中…' : '抽为模块',
                            ),
                          ),
                        ),
                      ),
                    ),
                  )
                : null,
              h('div', { className: 'aimrule-modal-sep' }, '已有模块'),
              modulesLoading
                ? h('p', { className: 'aimrule-hint' }, '正在扫描流程图…')
                : modules.length === 0
                  ? h('p', { className: 'aimrule-hint' }, '当前工作区还没有模块。先在一个流程图里框选节点并「封装」成模块。')
                  : [...modules]
                      .sort((a, b) => String(a.flowName).localeCompare(String(b.flowName)) || String(a.name).localeCompare(String(b.name)))
                      .map((entry) =>
                        h(
                          'div',
                          { key: entry.key, className: 'aimrule-module-row' },
                          h(
                            'div',
                            { className: 'aimrule-module-info' },
                            h('b', null, entry.name),
                            h('span', null, `${entry.flowName} · ${entry.nodeCount} 个节点`),
                          ),
                        ),
                      ),
            ),
            h(
              'div',
              { className: 'aimrule-modal-foot' },
              h(
                'span',
                { className: 'aimrule-hint', style: { marginRight: 'auto' } },
                `${modules.length} 个模块 · 来自 ${new Set(modules.map((item) => item.flowId)).size} 个流程图`,
              ),
              h('button', { className: 'aimrule-btn', onClick: () => setModal(null) }, '关闭'),
            ),
          ),
        )
      : null,
    modal === 'overview'
      ? h(
          'div',
          { className: 'aimrule-overlay', onMouseDown: (event) => { if (event.target === event.currentTarget) setModal(null) } },
          h(
            'div',
            { className: 'aimrule-modal' },
            h(
              'div',
              { className: 'aimrule-modal-head' },
              h('h2', null, '画布概览'),
              h('button', { className: 'aimrule-btn', 'data-kind': 'ghost', onClick: () => setModal(null) }, '✕'),
            ),
            h(
              'div',
              { className: 'aimrule-modal-body' },
              h(
                'div',
                { className: 'aimrule-overview-grid' },
                h('div', { className: 'aimrule-stat' }, h('b', null, current.nodes.length), h('span', null, '节点')),
                h('div', { className: 'aimrule-stat' }, h('b', null, current.edges.length), h('span', null, '连线')),
                h('div', { className: 'aimrule-stat' }, h('b', null, current.nodes.filter((node) => node.type === 'module').length), h('span', null, '模块')),
              ),
              h('div', { className: 'aimrule-muted' }, `当前工作区共 ${flows.length} 个流程图；工具栏与检查器只作用于当前流程图。`),
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                h('h3', { className: 'aimrule-field-label', style: { margin: 0 } }, '节点类型'),
                h(
                  'div',
                  { className: 'aimrule-legend' },
                  ...TYPE_ORDER.map((type) =>
                    h(
                      'div',
                      { key: type, className: 'aimrule-legend-row' },
                      h('span', { className: 'aimrule-legend-dot', style: { background: TYPE_META[type].color } }),
                      h('span', null, `${TYPE_META[type].label} · ${TYPE_META[type].hint}`),
                    ),
                  ),
                ),
              ),
              current.sources.length > 0
                ? h(
                    'div',
                    { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                    h('h3', { className: 'aimrule-field-label', style: { margin: 0 } }, '输入来源'),
                    ...current.sources.slice(-6).reverse().map((source) =>
                      h(
                        'div',
                        { key: source.id, className: 'aimrule-source' },
                        h('b', null, source.title || '未命名来源'),
                        h('span', null, source.text || ''),
                      ),
                    ),
                  )
                : null,
              h(
                'div',
                { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                h('h3', { className: 'aimrule-field-label', style: { margin: 0 } }, '操作'),
                h(
                  'div',
                  { className: 'aimrule-shortcuts' },
                  ...[
                    ['拖动空白处', '框选一组节点'],
                    ['双击空白处', '添加节点'],
                    ['双击模块', '进入模块内部'],
                    ['滚轮 / 触控板', '平移画布'],
                    ['⌘ / Ctrl + 滚轮', '缩放画布'],
                    ['⌘Z / ⇧⌘Z', '撤销 / 重做'],
                  ].map(([keys, label]) =>
                    h(
                      'div',
                      { key: keys, style: { display: 'flex', alignItems: 'center', gap: 9 } },
                      h('span', { className: 'aimrule-kbd' }, keys),
                      h('span', null, label),
                    ),
                  ),
                ),
              ),
            ),
            h(
              'div',
              { className: 'aimrule-modal-foot' },
              h(
                'button',
                {
                  className: 'aimrule-btn',
                  'data-kind': 'danger',
                  style: { marginRight: 'auto' },
                  onClick: () => {
                    setModal(null)
                    deleteFlow()
                  },
                  disabled: flows.length <= 1,
                },
                '删除当前流程图',
              ),
              h('button', { className: 'aimrule-btn', onClick: () => setModal(null) }, '关闭'),
            ),
          ),
        )
      : null,
    error && modal === null ? h('div', { className: 'aimrule-toast', 'data-tone': 'error' }, error) : null,
  )
}

/* ------------------------------------------------------- composer launcher */

export function AimRuleLauncher(props) {
  const [open, setOpen] = useState(false)
  const sessionId = props && typeof props.sessionId === 'string' ? props.sessionId : ''
  const workspaceItems = (props && typeof props.useWorkspaces === 'function' ? props.useWorkspaces((snapshot) => snapshot.items) : null) || []
  const sessions = (props && typeof props.useSessions === 'function' ? props.useSessions((snapshot) => snapshot.byId) : null) || {}
  const session = sessions[sessionId] || null
  const workspace = (workspaceItems || []).find((item) => Array.isArray(item.sessionIds) && item.sessionIds.includes(sessionId))
  const projectPath = (workspace && workspace.path) || (session && session.cwd) || ''
  const workspaceLabel = workspace
    ? workspace.title || baseName(workspace.path)
    : projectPath
      ? baseName(projectPath)
      : '未绑定工作区'

  const overlay =
    open && typeof document !== 'undefined'
      ? createPortal(
          h(
            'div',
            {
              className: 'aimrule-launcher-mask',
              onMouseDown: (event) => {
                if (event.target === event.currentTarget) setOpen(false)
              },
            },
            h(
              'div',
              { className: 'aimrule-launcher', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'AimRule 流程图设计' },
              h(
                'div',
                { className: 'aimrule-launcher-head' },
                h('span', { className: 'aimrule-launcher-mark' }, h(AimRuleIcon, { size: 20 })),
                h(
                  'div',
                  { className: 'aimrule-launcher-heading' },
                  h('b', null, '流程图设计'),
                  h('span', { title: projectPath || '' }, workspaceLabel, sessionId ? ' · 当前会话' : ''),
                ),
                h('span', { className: 'aimrule-launcher-spacer' }),
                h(
                  'button',
                  { type: 'button', className: 'aimrule-launcher-close', title: '关闭流程图设计', onClick: () => setOpen(false) },
                  '✕',
                ),
              ),
              h(
                'div',
                { className: 'aimrule-launcher-body' },
                h(AimRulePage, {
                  useSessions: props.useSessions,
                  useWorkspaces: props.useWorkspaces,
                  sessionId,
                  readCurrentSession: () => sessionId,
                  defaultProject: projectPath,
                }),
              ),
            ),
          ),
          document.body,
        )
      : null

  return h(
    'div',
    { className: 'aimrule-launcher-root' },
    h(
      'button',
      {
        type: 'button',
        className: 'aimrule-launch-button',
        title: '打开流程图设计',
        'aria-label': '打开流程图设计',
        onClick: () => setOpen(true),
      },
      h(AimRuleIcon, { size: 22 }),
    ),
    overlay,
  )
}

/* ------------------------------------------------------------------ plugin */

export function createPlugin() {
  return {
    inject: ['slots'],
    apply(ctx) {
      ctx.slots.inject('main', () =>
        ctx.slots.register(
          {
            name: 'main',
            key: 'aimrule',
          },
          (pageProps) =>
            h(AimRulePage, {
              ...pageProps,
              readCurrentSession: () => {
                try {
                  const reference = ctx.get('uiWorkspace') && ctx.get('uiWorkspace').mainReference
                  return reference && typeof reference.sessionId === 'string' ? reference.sessionId : ''
                } catch {
                  return ''
                }
              },
            }),
        ),
      )
      ctx.slots.inject('sidebar.panellist', () =>
        ctx.slots.register(
          {
            name: 'sidebar.panellist',
            id: 'aimrule',
            order: 30,
            label: 'AimRule',
          },
          AimRuleSidebarIcon,
        ),
      )
      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register(
          {
            name: 'conversation.input.left',
            id: 'aimrule-designer',
            order: 40,
          },
          AimRuleLauncher,
        ),
      )
    },
  }
}
