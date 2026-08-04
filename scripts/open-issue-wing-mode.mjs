import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

export const OPEN_ISSUE_LOCAL_WING_VERSION = '0.6.2'
export const OPEN_ISSUE_LOCAL_WING_COMMIT = 'dbdd70d4a95a2771b41fbec9ae17f979715ff076'

function gitOutput(worktreeRoot, args) {
  return execFileSync('git', args, {
    cwd: worktreeRoot,
    encoding: 'utf8',
  }).trim()
}

export function resolveOpenIssueLocalWingRoot(openIssueRoot, env = process.env) {
  const configured = env.PHOENIX_WING_ROOT
  const wingRoot = path.resolve(configured || path.join(openIssueRoot, '..', 'phoenix-wing'))
  const manifestPath = path.join(wingRoot, 'package.json')
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`本地 Wing 不存在：${wingRoot}`)
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== 'phoenix-wing') {
    throw new Error(`PHOENIX_WING_ROOT 不是 phoenix-wing 仓库：${wingRoot}`)
  }
  if (manifest.version !== OPEN_ISSUE_LOCAL_WING_VERSION) {
    throw new Error(
      `Open Issue 本地联调只接受 Wing ${OPEN_ISSUE_LOCAL_WING_VERSION}，实际为 ${manifest.version}`,
    )
  }
  const commit = gitOutput(wingRoot, ['rev-parse', 'HEAD'])
  if (commit !== OPEN_ISSUE_LOCAL_WING_COMMIT) {
    throw new Error(
      `Open Issue 本地联调只接受 Wing 候选 ${OPEN_ISSUE_LOCAL_WING_COMMIT}，实际为 ${commit}`,
    )
  }
  return { root: wingRoot, version: manifest.version, commit }
}
export function openIssueLocalWingAliases(env = process.env) {
  if (env.PHOENIX_WING_MODE !== 'local') return []
  const wingRoot = env.PHOENIX_WING_ROOT
  if (!wingRoot) throw new Error('PHOENIX_WING_MODE=local 时必须设置 PHOENIX_WING_ROOT')
  const distRoot = path.join(wingRoot, 'dist')
  return [
    { find: /^phoenix-wing$/u, replacement: path.join(distRoot, 'index.js') },
    { find: /^phoenix-wing\/style\.css$/u, replacement: path.join(distRoot, 'style.css') },
    { find: /^phoenix-wing\/fixtures\/(.+)$/u, replacement: path.join(wingRoot, 'fixtures', '$1') },
    { find: /^phoenix-wing\/(.+)\.vue$/u, replacement: path.join(distRoot, '$1.js') },
    { find: /^phoenix-wing\/(.+)$/u, replacement: path.join(distRoot, '$1.js') },
  ]
}
