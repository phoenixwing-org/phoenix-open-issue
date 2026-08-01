import { access, copyFile, mkdir, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PLUGIN_VUE_ROOT,
  ISSUE_CORE_SOURCE_ROOT,
  ISSUE_CORE_TARGET_ROOT,
  ISSUE_UI_FILE_MAPPINGS,
} from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const apply = process.argv.includes('--apply')
const onlyMissing = process.argv.includes('--only-missing')

if (!apply) {
  console.log('Dry run：使用 --apply 才会批量复制 Issue UI。')
}

async function copy(relativeSource, relativeTarget) {
  const source = path.join(repoRoot, relativeSource)
  const target = path.join(repoRoot, relativeTarget)
  if (onlyMissing) {
    try {
      await access(target)
      console.log(`SKIP ${relativeTarget}`)
      return
    } catch {
      // 目标不存在，继续复制。
    }
  }
  console.log(`${relativeSource} -> ${relativeTarget}`)
  if (!apply) return
  await mkdir(path.dirname(target), { recursive: true })
  await copyFile(source, target)
}

async function copyTree(relativeSourceRoot, relativeTargetRoot) {
  const sourceRoot = path.join(repoRoot, relativeSourceRoot)
  for (const entry of await readdir(sourceRoot)) {
    const source = path.join(sourceRoot, entry)
    const sourceRelative = path.join(relativeSourceRoot, entry)
    const targetRelative = path.join(relativeTargetRoot, entry)
    if ((await stat(source)).isDirectory()) {
      await copyTree(sourceRelative, targetRelative)
    } else {
      await copy(sourceRelative, targetRelative)
    }
  }
}

for (const [source, target] of ISSUE_UI_FILE_MAPPINGS) {
  await copy(source, path.join(ADMIN_PLUGIN_VUE_ROOT, target))
}

await copyTree(ISSUE_CORE_SOURCE_ROOT, ISSUE_CORE_TARGET_ROOT)

console.log(apply ? 'Issue UI 与 Core 已批量复制。' : 'Dry run 完成。')
