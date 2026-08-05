import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ADMIN_PLUGIN_VUE_ROOT,
  ISSUE_UI_INTENTIONAL_DELTAS,
  ISSUE_UI_FIDELITY_MAPPINGS,
  ISSUE_UI_NEW_TARGETS,
} from './admin-plugin-ui-files.mjs'
import { extractSfcUiBlocks } from './lib/sfc-ui-blocks.mjs'
import { findRawSemanticColors } from './lib/semantic-color-policy.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let failed = false
let exactCount = 0
let deltaCount = 0

for (const [sourceRelative, targetRelative] of ISSUE_UI_FIDELITY_MAPPINGS) {
  const source = await readFile(path.join(repoRoot, sourceRelative), 'utf8')
  const target = await readFile(path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT, targetRelative), 'utf8')
  const rawColors = findRawSemanticColors(target)
  if (rawColors.length > 0) {
    failed = true
    for (const violation of rawColors) {
      console.error(`RAW_COLOR ${targetRelative}:${violation.line} — ${violation.property}: ${violation.value}`)
    }
  }
  const sourceUi = extractSfcUiBlocks(source)
  const targetUi = extractSfcUiBlocks(target)
  const same = JSON.stringify(sourceUi) === JSON.stringify(targetUi)
  const intentional = ISSUE_UI_INTENTIONAL_DELTAS.get(targetRelative)
  // UI 指纹在完整 SFC 中检查，避免嵌套 <template> 被轻量块提取器提前截断。
  const targetUiText = target
  const signaturesPresent = intentional?.requiredUi.every(signature =>
    targetUiText.includes(signature),
  ) && intentional?.forbiddenUi?.every(signature => !targetUiText.includes(signature)) !== false
  // 少数渲染差异由 script 中的颜色映射驱动；只有白名单指纹是本次新增时
  // 才将 template/style 一致的文件登记为 DELTA。
  const scriptDrivenUiDelta = Boolean(
    intentional && signaturesPresent && intentional.requiredUi.some(signature => !source.includes(signature)),
  )
  if (same) {
    if (scriptDrivenUiDelta) {
      deltaCount += 1
      console.log(`DELTA ${targetRelative} — ${intentional.reason}`)
      continue
    }
    exactCount += 1
    console.log(`OK ${targetRelative}`)
    continue
  }

  if (intentional && signaturesPresent) {
    deltaCount += 1
    console.log(`DELTA ${targetRelative} — ${intentional.reason}`)
    continue
  }

  console.log(`DIFF ${targetRelative}`)
  if (intentional && !signaturesPresent) {
    const missing = intentional.requiredUi.filter(signature => !targetUiText.includes(signature))
    const forbidden = (intentional.forbiddenUi ?? []).filter(signature => targetUiText.includes(signature))
    if (missing.length) console.error(`声明差异缺少必需 UI 指纹：${missing.join(' | ')}`)
    if (forbidden.length) console.error(`声明差异仍含废弃 UI 指纹：${forbidden.join(' | ')}`)
  }
  failed = true
}

for (const targetRelative of ISSUE_UI_NEW_TARGETS) {
  const target = await readFile(path.join(repoRoot, ADMIN_PLUGIN_VUE_ROOT, targetRelative), 'utf8')
  const rawColors = findRawSemanticColors(target)
  if (rawColors.length > 0) {
    failed = true
    for (const violation of rawColors) {
      console.error(`RAW_COLOR ${targetRelative}:${violation.line} — ${violation.property}: ${violation.value}`)
    }
  }
  const intentional = ISSUE_UI_INTENTIONAL_DELTAS.get(targetRelative)
  const signaturesPresent = intentional?.requiredUi.every(signature => target.includes(signature)) &&
    intentional?.forbiddenUi?.every(signature => !target.includes(signature)) !== false
  if (!intentional || !signaturesPresent) {
    failed = true
    console.error(`新增 UI 缺少或不符合结构指纹：${targetRelative}`)
    continue
  }
  deltaCount += 1
  console.log(`DELTA ${targetRelative} — ${intentional.reason}`)
}

if (failed) {
  console.error('Issue 插件存在未经声明或不符合指纹的 template/style 差异。')
  process.exitCode = 1
} else {
  console.log(`Issue 插件 UI：${exactCount} 个严格一致，${deltaCount} 个已声明最小差异。`)
}
