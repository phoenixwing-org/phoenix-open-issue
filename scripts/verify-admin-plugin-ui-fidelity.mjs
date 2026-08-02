import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PLUGIN_VUE_ROOT,
  ISSUE_UI_INTENTIONAL_DELTAS,
  ISSUE_UI_FIDELITY_MAPPINGS,
} from './admin-plugin-ui-files.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function blocks(source, tag) {
  const pattern = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?<\\/${tag}>`, 'g')
  return source.match(pattern) || []
}

let failed = false
let exactCount = 0
let deltaCount = 0

for (const [sourceRelative, targetRelative] of ISSUE_UI_FIDELITY_MAPPINGS) {
  const source = await readFile(path.join(repoRoot, sourceRelative), 'utf8')
  const target = await readFile(path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT, targetRelative), 'utf8')
  const sourceUi = [...blocks(source, 'template'), ...blocks(source, 'style')]
  const targetUi = [...blocks(target, 'template'), ...blocks(target, 'style')]
  const same = JSON.stringify(sourceUi) === JSON.stringify(targetUi)
  if (same) {
    exactCount += 1
    console.log(`OK ${targetRelative}`)
    continue
  }

  const intentional = ISSUE_UI_INTENTIONAL_DELTAS.get(targetRelative)
  // UI 指纹在完整 SFC 中检查，避免嵌套 <template> 被轻量块提取器提前截断。
  const targetUiText = target
  const signaturesPresent = intentional?.requiredUi.every(signature =>
    targetUiText.includes(signature),
  )
  if (intentional && signaturesPresent) {
    deltaCount += 1
    console.log(`DELTA ${targetRelative} — ${intentional.reason}`)
    continue
  }

  console.log(`DIFF ${targetRelative}`)
  if (intentional && !signaturesPresent) {
    console.error(`声明差异缺少必需 UI 指纹：${intentional.requiredUi.join(' | ')}`)
  }
  failed = true
}

if (failed) {
  console.error('Issue 插件存在未经声明或不符合指纹的 template/style 差异。')
  process.exitCode = 1
} else {
  console.log(`Issue 插件 UI：${exactCount} 个严格一致，${deltaCount} 个已声明最小差异。`)
}
