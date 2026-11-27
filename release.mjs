#!/usr/bin/env node
/**
 * AimRule release: bump version, build, test, pack, commit, tag.
 *
 *   node release.mjs patch
 *   node release.mjs minor
 *   node release.mjs 0.10.0
 *   node release.mjs patch --push
 *
 * Flags: --skip-tests, --no-commit, --push
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const plugin = join(root, 'aimrule')
const args = process.argv.slice(2)
const flags = new Set(args.filter((arg) => arg.startsWith('--')))
const bumpArg = args.find((arg) => !arg.startsWith('--')) || 'patch'
const skipTests = flags.has('--skip-tests')
const noCommit = flags.has('--no-commit')
const push = flags.has('--push')

function run(command, commandArgs, options = {}) {
  return execFileSync(command, commandArgs, { cwd: root, stdio: 'inherit', ...options })
}

function bumpVersion(current, kind) {
  if (/^\d+\.\d+\.\d+$/.test(kind)) return kind
  const [major, minor, patch] = current.split('.').map(Number)
  if (kind === 'major') return `${major + 1}.0.0`
  if (kind === 'minor') return `${major}.${minor + 1}.0`
  if (kind === 'patch') return `${major}.${minor}.${patch + 1}`
  throw new Error(`未知版本参数：${kind}（可用 patch|minor|major|X.Y.Z）`)
}

const packageFile = join(plugin, 'package.json')
const pkg = JSON.parse(readFileSync(packageFile, 'utf8'))
const currentVersion = pkg.version
const nextVersion = bumpVersion(currentVersion, bumpArg)
const tag = `v${nextVersion}`

console.log(`\nAimRule ${currentVersion} → ${nextVersion}\n`)

pkg.version = nextVersion
writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`)

const indexPath = join(plugin, 'index.js')
const indexSource = readFileSync(indexPath, 'utf8')
const nextIndex = indexSource.replace(/version:\s*'[^']+'/, `version: '${nextVersion}'`)
if (nextIndex === indexSource) throw new Error('未找到 index.js 中的 version 字段')
writeFileSync(indexPath, nextIndex)

run('node', ['build.mjs'], { cwd: plugin })
if (!skipTests) {
  run('node', ['test/host-check.mjs'], { cwd: plugin })
  run('node', ['test/render-check.mjs'], { cwd: plugin })
  run('node', ['test/evaluate-check.mjs'], { cwd: plugin })
}

const dist = join(root, 'dist')
mkdirSync(dist, { recursive: true })
run('npm', ['pack', './aimrule', '--pack-destination', dist])
const tarball = readdirSync(dist)
  .filter((file) => file.endsWith(`-${nextVersion}.tgz`))
  .sort()
  .pop()

const zipFile = `aimrule-${nextVersion}.zip`
const zipPath = join(dist, zipFile)
try {
  execFileSync('zip', ['-qr', zipPath, '.', '-x', 'test/*', '.DS_Store'], { cwd: plugin, stdio: 'inherit' })
} catch (error) {
  console.warn(`警告：zip 打包失败（${error.message}），tarball 仍可用`)
}

let commit = ''
if (!noCommit && existsSync(join(root, '.git'))) {
  run('git', ['add', '-A'])
  let staged = false
  try {
    run('git', ['diff', '--cached', '--quiet'], { stdio: 'ignore' })
  } catch {
    staged = true
  }
  if (staged) {
    run('git', ['commit', '-m', `chore(release): ${tag}`])
    commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
    try {
      run('git', ['tag', '-a', tag, '-m', `AimRule ${tag}`])
    } catch {
      console.warn(`警告：tag ${tag} 已存在或创建失败`)
    }
  } else {
    console.log('工作区没有需要提交的改动，跳过 commit/tag')
  }
  if (push && commit) {
    try {
      run('git', ['push', 'origin', 'HEAD', '--tags'])
    } catch (error) {
      console.warn(`警告：推送失败（${error.message}），可稍后手动 git push origin HEAD --tags`)
    }
  }
}

const notes = [
  `# AimRule ${tag}`,
  '',
  `- 版本：${currentVersion} → ${nextVersion}`,
  `- 日期：${new Date().toISOString()}`,
  `- 提交：${commit || '未提交'}`,
  `- 标签：${commit ? tag : '未创建'}`,
  `- 测试：${skipTests ? '已跳过' : 'host / render / evaluate 全部通过'}`,
  '',
  '## 产物',
  '',
  `- \`dist/${tarball || `local-aimrule-${nextVersion}.tgz`}\`（npm pack）`,
  `- \`dist/${zipFile}\`（插件目录 ZIP）`,
  '',
  '## 安装/发布',
  '',
  '- tarball 可直接交给 DSH 插件安装或归档。',
  '- ZIP 解压后是完整插件目录。',
  commit && !push ? '- 本地已提交并打 tag；推送：`git push origin HEAD --tags`。' : '',
].filter(Boolean).join('\n')
const notesPath = join(dist, `RELEASE-${tag}.md`)
writeFileSync(notesPath, `${notes}\n`)

console.log(`\n完成：${tag}`)
console.log(`- ${tarball ? join('dist', tarball) : 'tarball'}`)
console.log(`- ${join('dist', zipFile)}`)
console.log(`- ${notesPath}`)
