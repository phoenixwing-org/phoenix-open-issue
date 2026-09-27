import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  cleanOpenIssueWingEnvironment,
  resolveOpenIssueDevelopmentPlan,
} from './admin-plugin-development-mode.mjs'

function fixture() {
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-dev-'))
  const repo = path.join(parent, 'phoenix-open-issue-working')
  fs.mkdirSync(repo)
  for (const [name, packageName] of [
    ['phoenix-admin-vue-working', 'phoenix-admin-vue'],
    ['phoenix-admin-node-working', 'phoenix-admin-node'],
    ['phoenix-wing', 'phoenix-wing'],
  ]) {
    const root = path.join(parent, name)
    fs.mkdirSync(root)
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: packageName }))
  }
  return { parent, repo }
}

test('Registry 与本地模式选择同一组 working Host', t => {
  const { parent, repo } = fixture()
  t.after(() => fs.rmSync(parent, { recursive: true, force: true }))
  assert.equal(resolveOpenIssueDevelopmentPlan(repo, 'registry', {}).wingRoot, undefined)
  const local = resolveOpenIssueDevelopmentPlan(repo, 'local', {})
  assert.match(local.vueRoot, /phoenix-admin-vue-working$/u)
  assert.match(local.nodeRoot, /phoenix-admin-node-working$/u)
  assert.match(local.wingRoot, /phoenix-wing$/u)
})

test('Registry 环境清除本地 Wing 来源', () => {
  assert.deepEqual(
    cleanOpenIssueWingEnvironment({ PHOENIX_WING_ROOT: '/tmp/x', PHOENIX_WING_MODE: 'local', KEEP: '1' }),
    { KEEP: '1' },
  )
})

for (const mode of ['registry', 'local']) {
  test(`${mode} --check 只检查 Host 入口，不挂载或启动服务`, t => {
    const { parent, repo } = fixture()
    t.after(() => fs.rmSync(parent, { recursive: true, force: true }))
    const plan = resolveOpenIssueDevelopmentPlan(repo, mode, {})
    const pnpmStub = path.join(parent, 'pnpm-stub.mjs')
    fs.writeFileSync(pnpmStub, `console.log(JSON.stringify({
      args: process.argv.slice(2), cwd: process.cwd(),
      mode: process.env.PHOENIX_WING_MODE ?? null,
      root: process.env.PHOENIX_WING_ROOT ?? null,
      src: process.env.PHOENIX_WING_SRC ?? null
    }))`)
    const entry = fileURLToPath(new URL('./develop-admin-plugin.mjs', import.meta.url))
    const result = spawnSync(process.execPath, [entry, mode, '--check'], {
      encoding: 'utf8',
      env: {
        ...process.env,
        npm_execpath: pnpmStub,
        PHOENIX_ADMIN_NODE_ROOT: plan.nodeRoot,
        PHOENIX_ADMIN_VUE_ROOT: plan.vueRoot,
        PHOENIX_WING_ROOT: path.join(parent, 'phoenix-wing'),
        PHOENIX_WING_MODE: 'local',
        PHOENIX_WING_SRC: 'stale-source',
      },
    })
    assert.equal(result.status, 0, result.stderr)
    const lines = result.stdout.trim().split('\n')
    assert.equal(lines.length, 2)
    assert.deepEqual(JSON.parse(lines[0]), {
      args: [mode === 'local' ? 'wing:local:check' : 'wing:registry:check'],
      cwd: plan.vueRoot,
      mode: null,
      root: mode === 'local' ? plan.wingRoot : null,
      src: null,
    })
    assert.equal(fs.existsSync(path.join(plan.vueRoot, 'src')), false)
    assert.equal(fs.existsSync(path.join(plan.nodeRoot, 'src')), false)
  })
}

test('公开开发命令只指向主线的唯一启动脚本', () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.scripts.dev, 'node scripts/develop-admin-plugin.mjs registry')
  assert.equal(manifest.scripts.wing, 'node scripts/develop-admin-plugin.mjs local')
})
