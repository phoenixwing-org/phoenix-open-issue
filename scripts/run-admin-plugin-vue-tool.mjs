#!/usr/bin/env node

import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

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
const configuredWingRoot = resolveCandidate(process.env.PHOENIX_WING_ROOT)
const wingRoot = configuredWingRoot
  || path.join(repoRoot, 'packages/admin-plugin/node_modules/phoenix-wing')
const wingManifestPath = path.join(wingRoot, 'package.json')
if (!existsSync(wingManifestPath)) {
  throw new Error(
    configuredWingRoot
      ? `未找到本地 Wing 候选：${configuredWingRoot}`
      : '未安装 Open Issue 锁定的 Registry phoenix-wing；请先在仓库根目录执行 pnpm install',
  )
}
const wingManifest = JSON.parse(readFileSync(wingManifestPath, 'utf8'))
if (!configuredWingRoot && wingManifest.version !== '0.7.1') {
  throw new Error(`Admin Vue typecheck 只接受 Registry phoenix-wing@0.7.1，实际为 ${wingManifest.version}`)
}
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
    const wingDist = path.join(wingRoot, 'dist')
    if (!existsSync(path.join(wingDist, 'index.d.ts'))) {
      throw new Error(`Registry phoenix-wing@0.7.1 缺少类型制品：${wingDist}`)
    }
    console.log(
      `Admin Vue typecheck Wing：${configuredWingRoot ? '本地候选' : 'Registry'} ${wingManifest.version}`,
    )
    const runtimeConfig = {
      extends: path.join(fixtureRoot, 'tsconfig.fixture.json'),
      compilerOptions: {
        baseUrl: fixtureRoot,
        paths: {
          '/$/phoenix-open-issue/*': [path.join(fixtureRoot, 'phoenix-open-issue/*')],
          '/$/base': [path.join(fixtureRoot, 'fixture-base.ts')],
          '/@/cool': [path.join(fixtureRoot, 'fixture-cool.ts')],
          '/@/phoenix/PahViewContributions': [path.join(fixtureRoot, 'fixture-pah.ts')],
          '/@/phoenix/PahWorkbenchOutput': [path.join(fixtureRoot, 'fixture-pah-output.ts')],
          '/@/phoenix/PahViewDialogs': [path.join(fixtureRoot, 'fixture-pah-view-dialog.ts')],
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
    env: {
      ...process.env,
      PHOENIX_ADMIN_VUE_ROOT: hostRoot,
    },
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
}
