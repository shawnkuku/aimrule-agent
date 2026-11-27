/* Per-workspace flow storage and the cross-flow module catalog. */

import { copyFile, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { emptyState, normalizeState } from './state.js'
import { parseStateMarkdown, writeStateMarkdown } from './markdown.js'

class FlowStore {
  constructor(workspace, id) {
    this.workspace = workspace
    this.id = id
    this.dir = workspace.dir
    this.file = join(workspace.flowsDir, `${id}.md`)
    this.legacyFile = join(workspace.flowsDir, `${id}.json`)
    this.chain = Promise.resolve()
    this.cache = null
  }

  async read() {
    this.warning = ''
    const markdown = await stat(this.file).catch(() => null)
    if (markdown && this.cache && this.cache.mtimeMs === markdown.mtimeMs && this.cache.size === markdown.size) {
      return this.cache.state
    }
    if (markdown) {
      try {
        const state = parseStateMarkdown(await readFile(this.file, 'utf8'))
        this.cache = { mtimeMs: markdown.mtimeMs, size: markdown.size, state }
        return state
      } catch (error) {
        this.cache = null
        await copyFile(this.file, `${this.file}.corrupt`).catch(() => {})
        for (const backup of [this.legacyFile, `${this.legacyFile}.bak`]) {
          const info = await stat(backup).catch(() => null)
          if (!info) continue
          try {
            const state = normalizeState(JSON.parse(await readFile(backup, 'utf8')))
            this.warning = `流程图 ${this.id}.md 解析失败，已回退到 JSON 备份；原 Markdown 已保留为 ${this.id}.md.corrupt。`
            return state
          } catch {
            /* try the next backup */
          }
        }
        throw new Error(`流程图 ${this.id}.md 解析失败：${error.message}`)
      }
    }
    const legacy = await stat(this.legacyFile).catch(() => null)
    if (legacy) {
      try {
        return normalizeState(JSON.parse(await readFile(this.legacyFile, 'utf8')))
      } catch {
        return emptyState()
      }
    }
    return emptyState()
  }

  write(state) {
    const run = async () => {
      const next = { ...normalizeState(state), updatedAt: new Date().toISOString() }
      await writeStateMarkdown(this.file, this.id, next)
      this.cache = null
      return next
    }
    const task = this.chain.then(run, run)
    this.chain = task.catch(() => {})
    return task
  }
}

class Workspace {
  constructor(dir) {
    this.dir = dir
    this.flowsDir = join(dir, 'flows')
    this.legacyFile = join(dir, 'state.json')
    this.stores = new Map()
    this.chain = Promise.resolve()
  }

  validId(id) {
    return typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)
  }

  async exists(file) {
    return Boolean(await stat(file).catch(() => null))
  }

  async legacyState() {
    try {
      return normalizeState(JSON.parse(await readFile(this.legacyFile, 'utf8')))
    } catch {
      return null
    }
  }

  storeRef(id) {
    let store = this.stores.get(id)
    if (!store) {
      store = new FlowStore(this, id)
      this.stores.set(id, store)
    }
    return store
  }

  async list() {
    let entries = []
    try {
      entries = await readdir(this.flowsDir, { withFileTypes: true })
    } catch {
      entries = []
    }
    const ids = new Set()
    for (const entry of entries) {
      if (!entry.isFile()) continue
      let id = ''
      if (entry.name.endsWith('.md')) id = entry.name.slice(0, -3)
      else if (entry.name.endsWith('.json') && !entry.name.endsWith('.json.bak')) id = entry.name.slice(0, -5)
      if (id && this.validId(id)) ids.add(id)
    }
    const rows = []
    for (const id of ids) {
      await this.ensureFlowFile(id)
      const store = this.storeRef(id)
      const state = await store.read()
      const info = await stat(store.file).catch(() => null)
      rows.push({
        id,
        name: state.project.name || '未命名流程图',
        description: state.project.description || '',
        updatedAt: state.updatedAt || (info ? info.mtime.toISOString() : ''),
        nodes: state.nodes.length,
        edges: state.edges.length,
        modules: state.nodes.filter((node) => node.type === 'module').length,
        legacy: false,
      })
    }
    if (rows.length === 0) {
      const legacy = await this.legacyState()
      if (legacy) {
        const info = await stat(this.legacyFile).catch(() => null)
        rows.push({
          id: 'legacy',
          name: legacy.project.name || '未命名流程图',
          description: legacy.project.description || '',
          updatedAt: legacy.updatedAt || (info ? info.mtime.toISOString() : ''),
          nodes: legacy.nodes.length,
          edges: legacy.edges.length,
          modules: legacy.nodes.filter((node) => node.type === 'module').length,
          legacy: true,
        })
      }
    }
    rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
    return rows
  }

  /** Migrate the old single flow JSON / legacy state.json to Markdown. */
  async ensureFlowFile(id) {
    const markdown = join(this.flowsDir, `${id}.md`)
    if (await this.exists(markdown)) return markdown
    const json = join(this.flowsDir, `${id}.json`)
    if (await this.exists(json)) {
      const state = normalizeState(JSON.parse(await readFile(json, 'utf8')))
      await writeStateMarkdown(markdown, id, state)
      const backup = `${json}.bak`
      await rm(backup, { force: true })
      await rename(json, backup)
      return markdown
    }
    if (id === 'legacy') {
      const legacy = await this.legacyState()
      if (legacy) await writeStateMarkdown(markdown, 'legacy', legacy)
    }
    return markdown
  }

  async store(id) {
    let resolved = typeof id === 'string' ? id.trim() : ''
    if (!resolved) {
      const rows = await this.list()
      resolved = rows.length > 0 ? rows[0].id : ''
    }
    if (!resolved) {
      const created = await this.create()
      resolved = created.id
    }
    if (!this.validId(resolved)) throw new Error('流程图 id 不合法')
    const store = this.storeRef(resolved)
    await this.ensureFlowFile(resolved)
    return store
  }

  async create(name) {
    const id = `f${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const store = this.storeRef(id)
    const state = emptyState()
    state.project.name = String(name || '未命名流程图').slice(0, 80)
    const saved = await store.write(state)
    return { id, state: saved }
  }

  async remove(id) {
    if (!this.validId(id)) throw new Error('流程图 id 不合法')
    const rows = await this.list()
    if (rows.length <= 1) throw new Error('至少保留一个流程图')
    await rm(join(this.flowsDir, `${id}.md`), { force: true })
    await rm(join(this.flowsDir, `${id}.json`), { force: true })
    await rm(join(this.flowsDir, `${id}.json.bak`), { force: true })
    this.stores.delete(id)
  }

  async modules() {
    const rows = await this.list()
    const modules = []
    for (const row of rows) {
      const store = await this.store(row.id)
      const state = await store.read()
      for (const node of state.nodes) {
        if (node.type !== 'module') continue
        const ids = new Set([node.id])
        let grew = true
        while (grew) {
          grew = false
          for (const candidate of state.nodes) {
            if (candidate.parentId && ids.has(candidate.parentId) && !ids.has(candidate.id)) {
              ids.add(candidate.id)
              grew = true
            }
          }
        }
        modules.push({
          key: `${row.id}:${node.id}`,
          flowId: row.id,
          flowName: row.name,
          moduleId: node.id,
          name: node.data && node.data.label ? node.data.label : node.id,
          nodeCount: ids.size,
          nodes: state.nodes.filter((item) => ids.has(item.id)),
          edges: state.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)),
        })
      }
    }
    return modules
  }
}

export class StoreManager {
  constructor(globalDir) {
    this.globalDir = globalDir
    this.workspaces = new Map()
  }

  async resolveDir(project) {
    const path = typeof project === 'string' ? project.trim() : ''
    if (!path) return this.globalDir
    if (!path.startsWith('/')) throw new Error('项目路径必须是绝对路径')
    const info = await stat(path).catch(() => null)
    if (!info || !info.isDirectory()) throw new Error(`项目目录不存在：${path}`)
    return join(path, '.aimrule')
  }

  async workspace(project) {
    const dir = await this.resolveDir(project)
    let workspace = this.workspaces.get(dir)
    if (!workspace) {
      workspace = new Workspace(dir)
      this.workspaces.set(dir, workspace)
    }
    return workspace
  }
}
