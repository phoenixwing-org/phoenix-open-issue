import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PLUGIN_VUE_ROOT,
  ISSUE_UI_FIDELITY_MAPPINGS,
} from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function blocks(source, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'g')
  return source.match(pattern) || []
}

let failed = false

for (const [sourceRelative, targetRelative] of ISSUE_UI_FIDELITY_MAPPINGS) {
  const source = await readFile(path.join(repoRoot, sourceRelative), 'utf8')
  const target = await readFile(path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT, targetRelative), 'utf8')
  const sourceUi = [...blocks(source, 'template'), ...blocks(source, 'style')]
  const targetUi = [...blocks(target, 'template'), ...blocks(target, 'style')]
  const same = JSON.stringify(sourceUi) === JSON.stringify(targetUi)
  console.log(`${same ? 'OK' : 'DIFF'} ${targetRelative}`)
  failed ||= !same
}

if (failed) {
  console.error('Issue 插件的 template/style 与 legacy 基线不一致。')
  process.exitCode = 1
} else {
  console.log('Issue 插件 template/style 与 legacy 基线一致。')
}
