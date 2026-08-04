import type { DictItem } from '../types/dict.js'

export const LEGACY_DICTIONARY_GROUP_KEYS = {
  issueCategory: 'phoenix-open-issue.issueCategory',
  detectionPhase: 'phoenix-open-issue.detectionPhase',
  orgUnitType: 'phoenix-open-issue.orgUnitType',
  severity: 'phoenix-open-issue.severity',
  priority: 'phoenix-open-issue.priority',
  closeReason: 'phoenix-open-issue.closeReason',
  listType: 'phoenix-open-issue.listType',
} as const

export type LegacyDictionaryGroup = keyof typeof LEGACY_DICTIONARY_GROUP_KEYS

const PROTECTED_PROTOCOLS: Partial<Record<LegacyDictionaryGroup, readonly string[]>> = {
  severity: ['trivial', 'minor', 'major', 'fatal'],
  priority: ['low', 'medium', 'high', 'critical'],
  listType: ['yearly', 'monthly', 'project', 'custom'],
}

export interface LegacyDictionarySourceRow {
  groupName: LegacyDictionaryGroup
  hostDictKey: string
  value: string
  label: string
  sortOrder: number
  legacyEnabled: 0 | 1
  legacyTags: string[]
  protected: boolean
}

export interface LegacyDictionaryGroupPreview {
  groupName: LegacyDictionaryGroup
  hostDictKey: string
  rows: number
  protectedRows: number
  disabledRows: number
}

export interface LegacyDictionaryConflictPreview {
  groupName: LegacyDictionaryGroup
  value: string
  protected: boolean
}

export interface LegacyDictionaryPreview {
  totalRows: number
  groups: LegacyDictionaryGroupPreview[]
  tags: Record<string, number>
  protectedRows: number
  disabledRows: number
  proposedCreates: number
  sameLabelRows: number
  labelConflicts: LegacyDictionaryConflictPreview[]
  blockers: string[]
  warnings: string[]
  automaticImportAllowed: false
  rows: LegacyDictionarySourceRow[] | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function normalizeLegacyTags(value: unknown): string[] {
  const source = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return [...new Set(source.map(item => String(item).trim()).filter(Boolean))].sort()
}

function isProtected(groupName: LegacyDictionaryGroup, value: string): boolean {
  return PROTECTED_PROTOCOLS[groupName]?.includes(value) ?? false
}

export function previewLegacyDictionaryRows(
  value: unknown,
  hostItems: DictItem[] = [],
): LegacyDictionaryPreview {
  const blockers: string[] = []
  const warnings: string[] = []
  if (!Array.isArray(value)) blockers.push('dict 必须是数组')
  const rows: LegacyDictionarySourceRow[] = []
  const pairs = new Set<string>()
  const sortOrders = new Map<LegacyDictionaryGroup, Set<number>>()

  for (const [index, candidate] of (Array.isArray(value) ? value : []).entries()) {
    if (!isRecord(candidate)) {
      blockers.push(`dict[${index}] 必须是对象`)
      continue
    }
    const groupName = text(candidate.groupName)
    const stableValue = text(candidate.value)
    const label = text(candidate.label)
    if (!groupName || !(groupName in LEGACY_DICTIONARY_GROUP_KEYS)) {
      blockers.push(`dict[${index}] 包含未知分组`)
      continue
    }
    if (!stableValue || !label) {
      blockers.push(`dict[${index}] 缺少 value 或 label`)
      continue
    }
    if (!Number.isInteger(candidate.sortOrder)) {
      blockers.push(`dict[${index}].sortOrder 必须是整数`)
      continue
    }
    if (candidate.enabled !== 0 && candidate.enabled !== 1) {
      blockers.push(`dict[${index}].enabled 必须是 0 或 1`)
      continue
    }
    const group = groupName as LegacyDictionaryGroup
    const sortOrder = candidate.sortOrder as number
    const key = `${group}\u0000${stableValue}`
    if (pairs.has(key)) blockers.push(`dict 存在重复 (groupName,value)：${group}/${stableValue}`)
    pairs.add(key)
    const orders = sortOrders.get(group) ?? new Set<number>()
    if (orders.has(sortOrder)) blockers.push(`${group} 存在重复 sortOrder=${sortOrder}`)
    orders.add(sortOrder)
    sortOrders.set(group, orders)
    rows.push({
      groupName: group,
      hostDictKey: LEGACY_DICTIONARY_GROUP_KEYS[group],
      value: stableValue,
      label,
      sortOrder,
      legacyEnabled: candidate.enabled,
      legacyTags: normalizeLegacyTags(candidate.tags),
      protected: isProtected(group, stableValue),
    })
  }

  for (const [groupName, expected] of Object.entries(PROTECTED_PROTOCOLS) as Array<
    [LegacyDictionaryGroup, readonly string[]]
  >) {
    const actual = rows
      .filter(row => row.groupName === groupName && expected.includes(row.value))
      .sort((left, right) => left.sortOrder - right.sortOrder)
    if (
      actual.map(row => row.value).join('\u0000') !== expected.join('\u0000') ||
      actual.some((row, index) => row.sortOrder !== index)
    ) {
      blockers.push(`${groupName} 核心协议值或顺序不匹配`)
    }
    const disabledCore = actual.filter(row => row.legacyEnabled !== 1)
    if (disabledCore.length) blockers.push(`${groupName} 有 ${disabledCore.length} 个核心协议项被停用`)
    const missingCoreTag = actual.filter(row => !row.legacyTags.includes('core'))
    if (missingCoreTag.length) {
      warnings.push(
        `${groupName} 有 ${missingCoreTag.length} 个核心协议项缺少 legacy core tag；保护级别仍以 manifest itemClass 为准`,
      )
    }
  }

  const tags: Record<string, number> = {}
  for (const row of rows) {
    for (const tag of row.legacyTags) tags[tag] = (tags[tag] ?? 0) + 1
  }
  const actualHost = new Map(
    hostItems
      .filter(item => String(item.id).startsWith('cool:'))
      .map(item => [`${item.groupName}\u0000${item.value}`, item]),
  )
  const labelConflicts: LegacyDictionaryConflictPreview[] = []
  let proposedCreates = 0
  let sameLabelRows = 0
  for (const row of rows) {
    const host = actualHost.get(`${row.groupName}\u0000${row.value}`)
    if (!host) proposedCreates++
    else if (host.label === row.label) sameLabelRows++
    else labelConflicts.push({
      groupName: row.groupName,
      value: row.value,
      protected: row.protected,
    })
  }

  const disabledRows = rows.filter(row => row.legacyEnabled === 0).length
  if (disabledRows) {
    blockers.push(`legacy 有 ${disabledRows} 个停用项；COOL 字典没有 enabled 内置属性`)
  }
  if (labelConflicts.length) {
    warnings.push(`${labelConflicts.length} 个 Host 显示名冲突必须逐项选择保留或覆盖`)
  }
  if (Object.keys(tags).length) {
    warnings.push('COOL 字典没有 tags/core 内置属性；legacy tags 仅作只读预检元数据')
  }
  const legacyCoreOnExtension = rows.filter(
    row => !row.protected && row.legacyTags.includes('core'),
  ).length
  if (legacyCoreOnExtension) {
    warnings.push(
      `${legacyCoreOnExtension} 个非协议项带 legacy core tag；不会据此升级为 Host core`,
    )
  }
  warnings.push('字典 52 行是独立候选数据集，不随 41 行业务数据自动导入')

  const groups = (Object.keys(LEGACY_DICTIONARY_GROUP_KEYS) as LegacyDictionaryGroup[])
    .map(groupName => {
      const groupRows = rows.filter(row => row.groupName === groupName)
      return {
        groupName,
        hostDictKey: LEGACY_DICTIONARY_GROUP_KEYS[groupName],
        rows: groupRows.length,
        protectedRows: groupRows.filter(row => row.protected).length,
        disabledRows: groupRows.filter(row => row.legacyEnabled === 0).length,
      }
    })
    .filter(group => group.rows > 0)

  return {
    totalRows: rows.length,
    groups,
    tags,
    protectedRows: rows.filter(row => row.protected).length,
    disabledRows,
    proposedCreates,
    sameLabelRows,
    labelConflicts,
    blockers,
    warnings,
    automaticImportAllowed: false,
    rows: blockers.length ? null : rows,
  }
}
