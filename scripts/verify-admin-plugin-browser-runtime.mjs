#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, 'packages/admin-plugin')
const vueRoot = path.join(pluginRoot, 'vue/phoenix-open-issue')
const runtimeRoot = path.join(vueRoot, 'runtime')
const descriptorPath = path.join(runtimeRoot, 'browser-runtime.artifacts.json')
const packageJson = JSON.parse(readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'))
const descriptor = JSON.parse(readFileSync(descriptorPath, 'utf8'))
const errors = []

function sha256(content) {
  return `sha256:${createHash('sha256').update(content).digest('hex')}`
}

function importSpecifiers(source) {
  const values = []
  for (const match of source.matchAll(
    /\b(?:import|export)\s+(?:[^'";]*?\s+from\s+)?["']([^"']+)["']/g,
  )) values.push(match[1])
  for (const match of source.matchAll(
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) values.push(match[1])
  return [...new Set(values)]
}

if (descriptor.formatVersion !== 1 || descriptor.moduleId !== 'phoenix-open-issue') {
  errors.push('browser runtime descriptor 标识不正确')
}
const exactDriverVersion = packageJson.devDependencies?.['driver.js']
if (!/^\d+\.\d+\.\d+$/.test(exactDriverVersion ?? '')) {
  errors.push('driver.js 不是精确 build-only devDependency')
}
if (packageJson.dependencies?.['driver.js']) {
  errors.push('driver.js 不得作为安装期 runtime dependency')
}
if (
  descriptor.source?.package !== 'driver.js' ||
  descriptor.source?.version !== exactDriverVersion ||
  descriptor.source?.license !== 'MIT'
) {
  errors.push('browser runtime 来源版本或许可证与 package 不一致')
}

const expectedArtifacts = new Map([
  ['page-help-driver-esm', ['runtime/driver.js.mjs', 'esm']],
  ['page-help-driver-css', ['runtime/driver.css', 'css']],
])
if (descriptor.artifacts?.length !== expectedArtifacts.size) {
  errors.push('browser runtime 必须精确声明 ESM 与 CSS 两项制品')
}

let rawBytes = 0
let gzipBytes = 0
for (const artifact of descriptor.artifacts ?? []) {
  const expected = expectedArtifacts.get(artifact.id)
  if (!expected || artifact.path !== expected[0] || artifact.format !== expected[1]) {
    errors.push(`browser runtime 制品声明越界：${artifact.id ?? 'unknown'}`)
    continue
  }
  if (artifact.runtime !== 'browser' || artifact.externalImports !== 0) {
    errors.push(`${artifact.id} 必须 runtime=browser 且 externalImports=0`)
  }
  const relativePath = artifact.path.replace(/^runtime\//, '')
  const absolutePath = path.join(runtimeRoot, relativePath)
  if (!existsSync(absolutePath)) {
    errors.push(`browser runtime 制品不存在：${artifact.path}`)
    continue
  }
  const content = readFileSync(absolutePath)
  const actualGzip = gzipSync(content, { level: 9 }).byteLength
  if (
    artifact.bytes !== content.byteLength ||
    artifact.sha256 !== sha256(content)
  ) {
    errors.push(`browser runtime 字节/SHA 不匹配：${artifact.path}`)
  }
  if (!Number.isSafeInteger(artifact.gzipBytes) || artifact.gzipBytes <= 0) {
    errors.push(`${artifact.id} gzipBytes 必须是正安全整数`)
  }
  rawBytes += content.byteLength
  gzipBytes += actualGzip

  const source = content.toString('utf8')
  if (artifact.format === 'esm' && importSpecifiers(source).length) {
    errors.push(`${artifact.path} 含外部或分片 import`)
  }
  if (artifact.format === 'css' && /(?:@import\b|@font-face\b|url\s*\()/i.test(source)) {
    errors.push(`${artifact.path} 含 @import、@font-face 或 url(...)`)
  }
}

for (const support of descriptor.supportFiles ?? []) {
  const relativePath = support.path.replace(/^runtime\//, '')
  const absolutePath = path.join(runtimeRoot, relativePath)
  if (!existsSync(absolutePath)) {
    errors.push(`browser runtime 支撑文件不存在：${support.path}`)
    continue
  }
  const content = readFileSync(absolutePath)
  if (support.bytes !== content.byteLength || support.sha256 !== sha256(content)) {
    errors.push(`browser runtime 支撑文件字节/SHA 不匹配：${support.path}`)
  }
}

const helpButton = readFileSync(path.join(vueRoot, 'components/PageHelpButton.vue'), 'utf8')
const pageHelp = readFileSync(path.join(vueRoot, 'content/pageHelp.ts'), 'utf8')
if (
  !helpButton.includes('../runtime/driver.js.mjs') ||
  !helpButton.includes('../runtime/driver.css') ||
  !pageHelp.includes('../runtime/driver.js.mjs')
) {
  errors.push('PageHelp 未完全改用插件相对 browser runtime 制品')
}
if (/from\s+["']driver\.js["']|["']driver\.js\/dist\//.test(`${helpButton}\n${pageHelp}`)) {
  errors.push('PageHelp 仍含 bare driver.js runtime import')
}

if (errors.length) {
  for (const error of errors) console.error(error)
  process.exit(1)
}

const hostCandidates = [
  process.env.PHOENIX_ADMIN_VUE_ROOT,
  path.resolve(repoRoot, '../phoenix-admin-vue'),
  path.join(homedir(), 'phoenix/phoenix-admin-vue'),
].filter(Boolean)
const hostRoot = hostCandidates.find(candidate =>
  existsSync(path.join(candidate, 'node_modules/.bin/vite')),
)
if (!hostRoot) throw new Error('未找到带 Vite 的 Phoenix Admin Vue 工具链')

const consumerRoot = mkdtempSync(path.join(tmpdir(), 'open-issue-browser-runtime-'))
try {
  const consumerRuntime = path.join(consumerRoot, 'runtime')
  mkdirSync(consumerRuntime, { recursive: true })
  for (const name of ['driver.js.mjs', 'driver.css']) {
    writeFileSync(
      path.join(consumerRuntime, name),
      readFileSync(path.join(runtimeRoot, name)),
    )
  }
  writeFileSync(
    path.join(consumerRoot, 'index.html'),
    '<!doctype html><html><body><main data-tour="target">fixture</main><script type="module" src="/main.js"></script></body></html>\n',
  )
  writeFileSync(
    path.join(consumerRoot, 'main.js'),
    `import { driver } from './runtime/driver.js.mjs'\nimport './runtime/driver.css'\nconst guide = driver({ steps: [{ element: '[data-tour="target"]', popover: { title: 'fixture' } }] })\nwindow.__OPEN_ISSUE_PAGE_HELP_RUNTIME__ = { open: () => guide.drive(), close: () => guide.destroy() }\n`,
  )
  const vite = path.join(hostRoot, 'node_modules/.bin/vite')
  const result = spawnSync(vite, ['build', '--logLevel', 'warn'], {
    cwd: consumerRoot,
    env: process.env,
    encoding: 'utf8',
  })
  if (result.error || result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || String(result.error))
    process.exit(1)
  }
  const assetRoot = path.join(consumerRoot, 'dist/assets')
  const assets = readdirSync(assetRoot)
  if (!assets.some(name => name.endsWith('.js')) || !assets.some(name => name.endsWith('.css'))) {
    throw new Error('独立 Vite consumer 未生成 JS/CSS')
  }
} finally {
  rmSync(consumerRoot, { recursive: true, force: true })
}

console.log(
  `Admin plugin browser runtime 合法：driver.js@${exactDriverVersion}，`
  + `2 项，${rawBytes} raw / ${gzipBytes} gzip bytes，externalImports=0；独立 Vite consumer PASS。`,
)
