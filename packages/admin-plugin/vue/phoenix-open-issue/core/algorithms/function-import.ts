import type { CreatePoiFunctionInput } from '../types/poi-function.js'

// ── 列名候选映射（中文 → 英文 → 驼峰） ──
const COLUMN_CANDIDATES: Record<string, string[]> = {
  platform:     ['平台', 'platform'],
  externalId:   ['id', 'ID', 'externalId'],
  functionName: ['功能', 'function', 'functionName', '功能名称'],
  targetYear:   ['目标年份', 'targetYear'],
  clientGroup:  ['客户分组', '客户群体', 'clientGroup'],
  developGroup: ['开发组', 'developGroup'],
}

/**
 * 将 xlsx 解析后的原始行对象映射为规范的 CreatePoiFunctionInput。
 * 支持中文/英文/驼峰列名，自动去空格，数字 id 转字符串。
 * 纯函数，无 UI/DB 依赖。
 */
export function mapXlsxRow(raw: Record<string, unknown>): CreatePoiFunctionInput {
  const getField = (field: string): string | undefined => {
    const candidates = COLUMN_CANDIDATES[field]
    if (!candidates) return undefined
    for (const key of candidates) {
      if (key in raw && raw[key] != null) {
        return String(raw[key]).trim()
      }
    }
    return undefined
  }

  return {
    platform:     getField('platform') || '',
    externalId:   getField('externalId') || '',
    functionName: getField('functionName') || '',
    targetYear:   getField('targetYear'),
    clientGroup:  getField('clientGroup'),
    developGroup: getField('developGroup'),
  }
}

/**
 * 对比已有记录和待导入列表，按 (platform, externalId) 拆分为新增和更新两组。
 * 纯函数，无 UI/DB 依赖。
 */
export function diffImportRows(
  existing: { platform: string; externalId: string; id: string }[],
  incoming: CreatePoiFunctionInput[],
): {
  toInsert: CreatePoiFunctionInput[]
  toUpdate: { id: string; data: CreatePoiFunctionInput }[]
} {
  const existingMap = new Map<string, string>()
  for (const row of existing) {
    existingMap.set(`${row.platform}::${row.externalId}`, row.id)
  }

  const toInsert: CreatePoiFunctionInput[] = []
  const toUpdate: { id: string; data: CreatePoiFunctionInput }[] = []

  for (const row of incoming) {
    const key = `${row.platform}::${row.externalId}`
    const existingId = existingMap.get(key)
    if (existingId) {
      toUpdate.push({ id: existingId, data: row })
    } else {
      toInsert.push(row)
    }
  }

  return { toInsert, toUpdate }
}
