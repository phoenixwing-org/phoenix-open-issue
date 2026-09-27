import fs from 'node:fs'
import path from 'node:path'

function resolveProject(candidate, expectedName, label) {
  const manifestPath = path.join(candidate, 'package.json')
  if (!fs.existsSync(manifestPath)) throw new Error(`${label} 不存在：${candidate}`)
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  if (manifest.name !== expectedName) throw new Error(`${label} 身份不匹配：${candidate}`)
  return fs.realpathSync(candidate)
}

function firstExisting(candidates) {
  return candidates.find(candidate => fs.existsSync(path.join(candidate, 'package.json')))
}

export function resolveOpenIssueDevelopmentPlan(repoRoot, mode, environment = process.env) {
  if (mode !== 'registry' && mode !== 'local') {
    throw new Error(`Open Issue 开发模式仅支持 registry 或 local，当前为 ${mode}`)
  }
  const parent = path.dirname(repoRoot)
  const vueCandidate = environment.PHOENIX_ADMIN_VUE_ROOT
    ? path.resolve(environment.PHOENIX_ADMIN_VUE_ROOT)
    : firstExisting([path.join(parent, 'phoenix-admin-vue-working'), path.join(parent, 'phoenix-admin-vue')])
  const nodeCandidate = environment.PHOENIX_ADMIN_NODE_ROOT
    ? path.resolve(environment.PHOENIX_ADMIN_NODE_ROOT)
    : firstExisting([path.join(parent, 'phoenix-admin-node-working'), path.join(parent, 'phoenix-admin-node')])
  if (!vueCandidate || !nodeCandidate) throw new Error('找不到标准并列 Phoenix Admin Vue/Node Host')
  const vueRoot = resolveProject(vueCandidate, 'phoenix-admin-vue', 'Vue Host')
  const nodeRoot = resolveProject(nodeCandidate, 'phoenix-admin-node', 'Node Host')
  let wingRoot
  if (mode === 'local') {
    const candidate = path.resolve(environment.PHOENIX_WING_ROOT || path.join(parent, 'phoenix-wing'))
    wingRoot = resolveProject(candidate, 'phoenix-wing', '本地 Wing')
  }
  return { mode, vueRoot, nodeRoot, wingRoot }
}

export function cleanOpenIssueWingEnvironment(environment = process.env) {
  const clean = { ...environment }
  delete clean.PHOENIX_WING_MODE
  delete clean.PHOENIX_WING_ROOT
  delete clean.PHOENIX_WING_SRC
  return clean
}
