#!/usr/bin/env node

import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, 'packages/admin-plugin')
const runtimeRoot = path.join(
  pluginRoot,
  'vue/phoenix-open-issue/runtime',
)
const packageJson = JSON.parse(
  readFileSync(path.join(pluginRoot, 'package.json'), 'utf8'),
)
const sourceVersion = packageJson.devDependencies?.['driver.js']

if (!/^\d+\.\d+\.\d+$/.test(sourceVersion ?? '')) {
  throw new Error('driver.js 必须作为精确版本的 build-only devDependency')
}

const candidates = [
  process.env.OPEN_ISSUE_DRIVER_ROOT,
  path.join(pluginRoot, 'node_modules/driver.js'),
  path.join(repoRoot, 'packages/web/node_modules/driver.js'),
  path.join(repoRoot, 'node_modules/driver.js'),
].filter(Boolean)
const sourceRoot = candidates.find(candidate =>
  existsSync(path.join(candidate, 'package.json')),
)

if (!sourceRoot) {
  throw new Error(
    '未找到精确 driver.js 源包；请安装 workspace 依赖，或设置 OPEN_ISSUE_DRIVER_ROOT',
  )
}

const sourcePackage = JSON.parse(
  readFileSync(path.join(sourceRoot, 'package.json'), 'utf8'),
)
if (sourcePackage.name !== 'driver.js' || sourcePackage.version !== sourceVersion) {
  throw new Error(
    `driver.js 源版本不一致：期望 ${sourceVersion}，实际 ${sourcePackage.version ?? 'unknown'}`,
  )
}

const sourceFiles = {
  esm: 'dist/driver.js.mjs',
  css: 'dist/driver.css',
  types: 'dist/driver.js.d.mts',
  license: 'license',
}

function bytes(relativePath) {
  const absolutePath = path.join(sourceRoot, relativePath)
  if (!existsSync(absolutePath)) {
    throw new Error(`driver.js 源制品不存在：${relativePath}`)
  }
  return readFileSync(absolutePath)
}

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

const esm = bytes(sourceFiles.esm)
const css = bytes(sourceFiles.css)
const types = Buffer.from(
  bytes(sourceFiles.types).toString('utf8').replace(/\r\n?/g, '\n'),
  'utf8',
)
const license = bytes(sourceFiles.license)
const esmText = esm.toString('utf8')
const cssText = css.toString('utf8')
const imports = importSpecifiers(esmText)

if (imports.length) {
  throw new Error(`driver.js browser bundle 仍有 import：${imports.join(', ')}`)
}
if (/(?:@import\b|@font-face\b|url\s*\()/i.test(cssText)) {
  throw new Error('driver.js CSS 含 @import、@font-face 或 url(...) 外部资源')
}

mkdirSync(runtimeRoot, { recursive: true })
const outputs = [
  ['driver.js.mjs', esm],
  ['driver.css', css],
  ['driver.js.d.mts', types],
  ['driver.js.LICENSE.txt', license],
]
for (const [name, content] of outputs) {
  writeFileSync(path.join(runtimeRoot, name), content)
}

function artifact(id, relativePath, format, content) {
  return {
    id,
    path: `runtime/${relativePath}`,
    format,
    runtime: 'browser',
    bytes: content.byteLength,
    gzipBytes: gzipSync(content, { level: 9 }).byteLength,
    sha256: sha256(content),
    externalImports: 0,
  }
}

function supportFile(relativePath, format, content) {
  return {
    path: `runtime/${relativePath}`,
    format,
    bytes: content.byteLength,
    sha256: sha256(content),
  }
}

const descriptor = {
  formatVersion: 1,
  moduleId: 'phoenix-open-issue',
  source: {
    package: 'driver.js',
    version: sourceVersion,
    license: sourcePackage.license,
    sourceFiles,
  },
  artifacts: [
    artifact('page-help-driver-esm', 'driver.js.mjs', 'esm', esm),
    artifact('page-help-driver-css', 'driver.css', 'css', css),
  ],
  supportFiles: [
    supportFile('driver.js.d.mts', 'typescript-declaration', types),
    supportFile('driver.js.LICENSE.txt', 'license', license),
  ],
}

writeFileSync(
  path.join(runtimeRoot, 'browser-runtime.artifacts.json'),
  `${JSON.stringify(descriptor, null, 2)}\n`,
  'utf8',
)

const rawBytes = descriptor.artifacts.reduce((sum, item) => sum + item.bytes, 0)
const gzipBytes = descriptor.artifacts.reduce((sum, item) => sum + item.gzipBytes, 0)
console.log(
  `浏览器运行时已生成：driver.js@${sourceVersion}，`
  + `${descriptor.artifacts.length} 项，${rawBytes} raw / ${gzipBytes} gzip bytes，externalImports=0`,
)
