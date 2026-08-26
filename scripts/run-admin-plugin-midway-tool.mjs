#!/usr/bin/env node

import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function resolveCandidate(value) {
  if (!value) return null
  return path.isAbsolute(value) ? value : path.resolve(repoRoot, value)
}

const hostCandidates = [
  resolveCandidate(process.env.PHOENIX_ADMIN_NODE_ROOT),
  path.resolve(repoRoot, '../phoenix-admin-node'),
  path.join(homedir(), 'phoenix/phoenix-admin-node'),
].filter(Boolean)

const hostRoot = hostCandidates.find(candidate =>
  existsSync(path.join(candidate, 'node_modules/.bin/tsc')),
)

if (!hostRoot) {
  throw new Error(
    '未找到可用的 Phoenix Admin Node tsc；'
    + '请设置 PHOENIX_ADMIN_NODE_ROOT 或安装标准 Host checkout',
  )
}

const fixtureRoot = path.join(repoRoot, 'packages/admin-plugin/midway')
const temporaryRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-admin-midway-tool-'))

try {
  const runtimeConfig = {
    extends: path.join(fixtureRoot, 'tsconfig.fixture.json'),
    compilerOptions: {
      baseUrl: hostRoot,
      paths: {
        '@cool-midway/*': [path.join(hostRoot, 'node_modules/@cool-midway/*')],
        '@midwayjs/*': [path.join(hostRoot, 'node_modules/@midwayjs/*')],
        typeorm: [path.join(hostRoot, 'node_modules/typeorm')],
      },
      typeRoots: [
        path.join(hostRoot, 'typings'),
        path.join(hostRoot, 'node_modules/@types'),
      ],
    },
    include: [path.join(fixtureRoot, 'phoenix-open-issue/**/*.ts')],
    exclude: [path.join(fixtureRoot, 'phoenix-open-issue/migrations')],
  }
  const configPath = path.join(temporaryRoot, 'tsconfig.json')
  writeFileSync(configPath, `${JSON.stringify(runtimeConfig, null, 2)}\n`, 'utf8')

  console.log(`Admin Node typecheck 工具链：${hostRoot}`)
  const result = spawnSync(path.join(hostRoot, 'node_modules/.bin/tsc'), [
    '--noEmit',
    '-p',
    configPath,
  ], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error) throw result.error
  process.exitCode = result.status ?? 1
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true })
}
