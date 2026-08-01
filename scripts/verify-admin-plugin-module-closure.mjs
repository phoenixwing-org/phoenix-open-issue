import { access, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN_PLUGIN_VUE_ROOT } from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const pluginRoot = path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT)
const missing = new Set()
const invalidStoreIds = new Set()
const STORE_ID_PREFIX = 'phoenix-open-issue-'

async function exists(target) {
  try {
    await access(target)
    return true
  } catch {
    return false
  }
}

async function resolves(relativeTarget) {
  const target = path.join(pluginRoot, relativeTarget)
  return (
    await exists(target) ||
    await exists(`${target}.ts`) ||
    await exists(`${target}.vue`) ||
    await exists(path.join(target, 'index.ts')) ||
    await exists(path.join(target, 'index.vue'))
  )
}

async function visit(directory) {
  for (const entry of await readdir(directory)) {
    const target = path.join(directory, entry)
    if ((await stat(target)).isDirectory()) {
      await visit(target)
      continue
    }
    if (!/\.(ts|vue)$/.test(entry)) continue

    const source = await readFile(target, 'utf8')
    const imports = source.matchAll(/["']\/\$\/phoenix-open-issue\/([^"']+)["']/g)
    for (const match of imports) {
      if (!(await resolves(match[1]))) {
        missing.add(`${path.relative(repoRoot, target)} -> ${match[1]}`)
      }
    }

    for (const match of source.matchAll(/defineStore\(\s*["']([^"']+)["']/g)) {
      if (!match[1].startsWith(STORE_ID_PREFIX)) {
        invalidStoreIds.add(`${path.relative(repoRoot, target)} -> ${match[1]}`)
      }
    }
  }
}

await visit(pluginRoot)

if (missing.size) {
  for (const item of missing) console.error(`MISSING ${item}`)
  process.exitCode = 1
} else if (invalidStoreIds.size) {
  for (const item of invalidStoreIds) console.error(`INVALID_STORE_ID ${item}`)
  process.exitCode = 1
} else {
  console.log('Phoenix Open Issue 插件内部模块引用闭包与 Pinia 命名空间完整。')
}
