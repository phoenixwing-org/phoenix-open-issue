#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolveOpenIssueLocalWingRoot } from './open-issue-wing-mode.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const action = process.argv[2]
if (action !== 'typecheck' && action !== 'test') {
  throw new Error('只支持 typecheck 或 test')
}

function resolveCandidate(value) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value)
}

const hostCandidates = [
  resolveCandidate(process.env.PHOENIX_ADMIN_VUE_ROOT),
  path.resolve(repoRoot, '../phoenix-admin-vue'),
  path.join(homedir(), 'phoenix/phoenix-admin-vue'),
].filter(Boolean)

const binaryName = action === 'typecheck' ? 'vue-tsc' : 'vitest'
const hostRoot = hostCandidates.find(candidate =>
  existsSync(path.join(candidate, 'node_modules/.bin', binaryName)),
)

if (!hostRoot) {
  throw new Error(
    `未找到可用的 Phoenix Admin Vue ${binaryName}；`
    + '请设置 PHOENIX_ADMIN_VUE_ROOT 或安装标准 Host checkout',
  )
}

const binary = path.join(hostRoot, 'node_modules/.bin', binaryName)
let temporaryRoot = null

try {
  let args
  if (action === 'test') {
    args = [
      'run',
      '--config',
      path.join(repoRoot, 'packages/admin-plugin/vue/vitest.config.ts'),
    ]
  } else {
    temporaryRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-admin-vue-tool-'))
    const fixtureRoot = path.join(repoRoot, 'packages/admin-plugin/vue')
    const hostDependency = name => path.join(hostRoot, 'node_modules', name)
    const wing = resolveOpenIssueLocalWingRoot(repoRoot, {
      ...process.env,
      PHOENIX_WING_ROOT: process.env.PHOENIX_WING_ROOT || path.join(homedir(), 'phoenix/phoenix-wing'),
    })
    const wingDist = path.join(wing.root, 'dist')
    if (!existsSync(path.join(wingDist, 'index.d.ts'))) {
      throw new Error(`本地 Phoenix Wing 尚未构建：${wing.root}`)
    }
    console.log(`Admin Vue typecheck Wing：${wing.root} (${wing.version})`)
    const runtimeConfig = {
      extends: path.join(fixtureRoot, 'tsconfig.fixture.json'),
      compilerOptions: {
        baseUrl: fixtureRoot,
        paths: {
          '/$/phoenix-open-issue/*': [path.join(fixtureRoot, 'phoenix-open-issue/*')],
          '/$/base': [path.join(fixtureRoot, 'fixture-base.ts')],
          '/@/cool': [path.join(fixtureRoot, 'fixture-cool.ts')],
          '/@/pah/PahViewContributions': [path.join(fixtureRoot, 'fixture-pah.ts')],
          '/@/pah/PahWorkbenchOutput': [path.join(fixtureRoot, 'fixture-pah-output.ts')],
          '@element-plus/icons-vue': [hostDependency('@element-plus/icons-vue')],
          axios: [hostDependency('axios')],
          'element-plus': [hostDependency('element-plus')],
          'phoenix-wing': [path.join(wingDist, 'index.d.ts')],
          'phoenix-wing/components/*.vue': [path.join(wingDist, 'components/*.vue.d.ts')],
          'phoenix-wing/layout/*.vue': [path.join(wingDist, 'layout/*.vue.d.ts')],
          pinia: [hostDependency('pinia')],
          vitest: [hostDependency('vitest')],
          vue: [hostDependency('vue')],
          'vue-router': [hostDependency('vue-router')],
          xlsx: [hostDependency('xlsx')],
        },
      },
    }
    const configPath = path.join(temporaryRoot, 'tsconfig.json')
    writeFileSync(configPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, 'utf8')
    args = ['--noEmit', '-p', configPath]
  }

  console.log(`Admin Vue ${action} 工具链：${hostRoot}`)
  const result = spawnSync(binary, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
}
