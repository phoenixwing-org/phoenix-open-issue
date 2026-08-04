#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateHostOwnedSettingsBoundary } from './lib/admin-plugin-settings-boundary.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, 'packages/admin-plugin')
const sourceRoots = [
  path.join(pluginRoot, 'vue/phoenix-open-issue'),
  path.join(pluginRoot, 'midway/phoenix-open-issue'),
]

async function collectSources(directory, result = new Map()) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectSources(absolutePath, result)
    } else if (entry.isFile() && /\.(?:ts|vue)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
      const relativePath = path.relative(pluginRoot, absolutePath).replaceAll(path.sep, '/')
      result.set(relativePath, await readFile(absolutePath, 'utf8'))
    }
  }
  return result
}

const manifest = JSON.parse(await readFile(path.join(pluginRoot, 'manifest.json'), 'utf8'))
const sources = new Map()
for (const sourceRoot of sourceRoots) await collectSources(sourceRoot, sources)

const maintenanceDomain = sources.get('midway/phoenix-open-issue/domain/maintenance.ts') ?? ''
const taskListSource = maintenanceDomain.match(/OPEN_ISSUE_REPAIR_TASKS\s*=\s*\[([^\]]*)\]/s)?.[1] ?? ''
const repairTasks = [...taskListSource.matchAll(/['"]([^'"]+)['"]/g)].map(match => match[1])
const errors = validateHostOwnedSettingsBoundary({ manifest, sources, repairTasks })

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}

console.log(
  `Host-owned 设置边界合法：${sources.size} 个插件源文件，`
  + `maintenance=${repairTasks.join('+')}，Host 账号/组织仅通过受控 adapter 消费。`,
)
