#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, 'packages/admin-plugin')
const cacheRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-admin-pack-'))

let rawReport = ''
try {
  rawReport = execFileSync(
    process.platform === 'win32' ? 'npm.cmd' : 'npm',
    ['pack', '--dry-run', '--json', '--cache', cacheRoot],
    {
      cwd: pluginRoot,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, npm_config_update_notifier: 'false' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
} catch (error) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : ''
  console.error(stderr || error?.message || 'npm pack --dry-run 失败')
  process.exitCode = 1
} finally {
  rmSync(cacheRoot, { recursive: true, force: true })
}

if (process.exitCode) process.exit()

let report
try {
  ;[report] = JSON.parse(rawReport)
} catch {
  console.error('npm pack --dry-run 未返回可解析的 JSON 清单')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(path.join(pluginRoot, 'manifest.json'), 'utf8'))
const packageJson = JSON.parse(readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'))
const browserRuntimeDescriptor = JSON.parse(readFileSync(
  path.join(pluginRoot, 'vue/phoenix-open-issue/runtime/browser-runtime.artifacts.json'),
  'utf8',
))
const paths = new Set(report.files.map(file => file.path))
const errors = []
const allowedRoots = new Set(['README.md', 'manifest.json', 'midway', 'package.json', 'vue'])

for (const file of paths) {
  const root = file.split('/')[0]
  if (!allowedRoots.has(root)) errors.push(`交付包顶层越界：${file}`)
  if (
    /(^|\/)(?:test|tests|__tests__)(?:\/|$)/.test(file) ||
    /\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) ||
    /(^|\/)fixture-[^/]+/.test(file) ||
    /(^|\/)(?:vitest\.config|tsconfig\.fixture)/.test(file) ||
    /(^|\/)controlled-test-suite\.json$/.test(file) ||
    /(^|\/)node_modules(?:\/|$)/.test(file) ||
    /(^|\/)vitest(?:\.mjs|\.cjs|\.js)?$/.test(file)
  ) {
    errors.push(`交付包含测试声明、配置、源码、工具或 fixture：${file}`)
  }
}

const requiredPaths = new Set([
  'README.md',
  'manifest.json',
  'package.json',
  manifest.entrypoints?.web,
  manifest.entrypoints?.node,
  'midway/phoenix-open-issue/pah-plugin.artifacts.json',
  'vue/phoenix-open-issue/runtime/README.md',
  'vue/phoenix-open-issue/runtime/browser-runtime.artifacts.json',
  ...(browserRuntimeDescriptor.artifacts ?? []).map(
    item => `vue/phoenix-open-issue/${item.path}`,
  ),
  ...(browserRuntimeDescriptor.supportFiles ?? []).map(
    item => `vue/phoenix-open-issue/${item.path}`,
  ),
  ...(manifest.migrations ?? []).map(item => `midway/phoenix-open-issue/${item.artifact?.path}`),
].filter(Boolean))

for (const requiredPath of requiredPaths) {
  if (!paths.has(requiredPath)) errors.push(`交付包缺少必需入口/制品：${requiredPath}`)
}

if (packageJson.license !== manifest.license) {
  errors.push(`package/manifest license 不一致：${packageJson.license} / ${manifest.license}`)
}
if (!Array.isArray(packageJson.files) || !packageJson.files.some(item => item.startsWith('!') && item.includes('.test.ts'))) {
  errors.push('package files 未显式排除测试源码')
}

if (errors.length > 0) {
  for (const error of errors) console.error(error)
  process.exit(1)
}

console.log(
  `Admin plugin pack 合法：${report.entryCount} 项，${report.size} bytes，`
  + '测试声明/config/测试源码/工具二进制/node_modules/fixture 均为 0，'
  + `${(manifest.migrations ?? []).length} 条 migration、`
  + `${(browserRuntimeDescriptor.artifacts ?? []).length} 条 browser runtime 制品完整。`,
)
