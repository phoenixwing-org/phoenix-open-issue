import type { DictItem } from '../types/dict.js'
import {
  previewLegacyDictionaryRows,
  type LegacyDictionaryPreview,
} from './legacy-dictionary.js'

export const LEGACY_BUSINESS_TABLES = [
  ['issueLists', '问题列表'],
  ['issueListMembers', '列表成员'],
  ['issues', 'Issue'],
  ['issueListLinks', 'Issue 关联'],
  ['checkpoints', '点检'],
  ['eightDReports', '8D 报告'],
  ['pushRecords', '推送记录'],
  ['poiFunctions', '功能简表'],
] as const

export type LegacyBusinessTableName = (typeof LEGACY_BUSINESS_TABLES)[number][0]

const LEGACY_NON_BUSINESS_TABLES = new Set([
  'users',
  'externalIdentities',
  'externalBindRequests',
  'orgUnits',
  'dict',
])

const USER_REFERENCE_FIELDS: ReadonlyArray<readonly [LegacyBusinessTableName, string]> = [
  ['issueLists', 'ownerId'],
  ['issueListMembers', 'userId'],
  ['issues', 'reporterId'],
  ['issues', 'assigneeId'],
  ['issues', 'closedBy'],
  ['issues', 'createdBy'],
  ['issueListLinks', 'linkedBy'],
  ['issueListLinks', 'attentionUpdatedBy'],
  ['checkpoints', 'responsibleUserId'],
  ['pushRecords', 'pushedBy'],
  ['pushRecords', 'toUserId'],
  ['pushRecords', 'handledBy'],
]

export interface LegacyUserIdentity {
  id: string
  username: string | null
  displayName: string | null
  email: string | null
  disabled: boolean
}

export interface HostUserIdentity {
  id: string
  username: string
  displayName: string | null
  email: string | null
  disabled: boolean
}

export interface LegacyMigrationTablePreview {
  table: LegacyBusinessTableName
  label: string
  rows: number
}

export interface LegacyExcludedTablePreview {
  table: string
  rows: number
}

export interface LegacyMigrationLocalPreview {
  version: number | null
  timestamp: string | null
  exportScope: string | null
  tables: LegacyMigrationTablePreview[]
  excluded: LegacyExcludedTablePreview[]
  blockers: string[]
  warnings: string[]
  totalRows: number
  userReferences: string[]
  legacyUsers: LegacyUserIdentity[]
  orgUnitReferences: string[]
  dictionary: LegacyDictionaryPreview | null
}

export interface LegacyBusinessSubmission {
  dataset: 'phoenix-open-issue-business-v1'
  source: {
    version: 1
    timestamp: string | null
    exportScope: 'full'
    rawSha256: string
  }
  tables: Record<LegacyBusinessTableName, Record<string, unknown>[]>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function nonBlankString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function tableRows(
  tables: Record<string, unknown>,
  table: LegacyBusinessTableName,
): Record<string, unknown>[] {
  const value = tables[table]
  if (!Array.isArray(value)) return []
  return value.filter(isRecord)
}

function collectReferences(
  tables: Record<string, unknown>,
  fields: ReadonlyArray<readonly [LegacyBusinessTableName, string]>,
): string[] {
  const values = fields.flatMap(([table, field]) =>
    tableRows(tables, table)
      .map(row => nonBlankString(row[field]))
      .filter((value): value is string => Boolean(value)),
  )
  return [...new Set(values)].sort()
}

function normalizedIdentity(value: unknown): string | null {
  const normalized = nonBlankString(value)?.toLocaleLowerCase()
  return normalized || null
}

function legacyUserIdentities(
  tables: Record<string, unknown>,
  references: readonly string[],
): LegacyUserIdentity[] {
  const referenced = new Set(references)
  const users = Array.isArray(tables.users) ? tables.users.filter(isRecord) : []
  const byId = new Map(users.flatMap(row => {
    const id = nonBlankString(row.id)
    if (!id || !referenced.has(id)) return []
    return [[id, {
      id,
      username: nonBlankString(row.username),
      displayName: nonBlankString(row.displayName),
      email: nonBlankString(row.email),
      disabled: Number(row.disabled ?? 0) === 1,
    } satisfies LegacyUserIdentity] as const]
  }))
  return references.map(id => byId.get(id) ?? {
    id,
    username: null,
    displayName: null,
    email: null,
    disabled: false,
  })
}

/**
 * 只在用户名或邮箱唯一、且所有命中均指向同一个 Host 用户时给出自动映射。
 * 旧账号资料不会进入返回值，调用方只提交 sourceId -> Host id。
 */
export function suggestLegacyUserMappings(
  legacyUsers: readonly LegacyUserIdentity[],
  hostUsers: readonly HostUserIdentity[],
): Record<string, string> {
  const lookup = (field: 'username' | 'email', value: string | null): string[] => {
    const key = normalizedIdentity(value)
    if (!key) return []
    return [...new Set(hostUsers
      .filter(user => normalizedIdentity(user[field]) === key)
      .map(user => user.id))]
  }

  return Object.fromEntries(legacyUsers.flatMap(legacyUser => {
    const candidates = new Set([
      ...lookup('username', legacyUser.username),
      ...lookup('email', legacyUser.email),
    ])
    return candidates.size === 1
      ? [[legacyUser.id, [...candidates][0]]]
      : []
  }))
}

export function previewLegacyMigrationPackage(
  value: unknown,
  hostDictionaryItems: DictItem[] = [],
): LegacyMigrationLocalPreview {
  const blockers: string[] = []
  const warnings: string[] = []
  const root = isRecord(value) ? value : {}
  if (!isRecord(value)) blockers.push('JSON 顶层必须是对象')
  const sourceTables = isRecord(root.tables) ? root.tables : {}
  if (!isRecord(root.tables)) blockers.push('旧站 JSON 缺少 tables 对象')

  const version = typeof root.version === 'number' ? root.version : null
  const timestamp = typeof root.timestamp === 'string' ? root.timestamp : null
  const exportScope = typeof root.exportScope === 'string' ? root.exportScope : null
  if (version !== 1) blockers.push('仅识别 legacy v1 JSON')
  if (exportScope !== 'full') {
    blockers.push(
      exportScope === 'accessible'
        ? '个人受限导出不能用于数据库迁移'
        : '迁移包必须明确声明 exportScope=full',
    )
  }

  const tables = LEGACY_BUSINESS_TABLES.map(([table, label]) => {
    const rows = sourceTables[table]
    if (!Array.isArray(rows)) {
      if (table === 'eightDReports') {
        warnings.push('eightDReports 缺失或格式无效；服务端将尝试从 Issue 内嵌字段兼容提取，失败也不阻断核心业务')
        return { table, label, rows: 0 }
      }
      blockers.push(`${table} 必须是数组`)
      return { table, label, rows: 0 }
    }
    const invalidRows = rows.filter(row => !isRecord(row)).length
    if (invalidRows) {
      if (table === 'eightDReports') {
        warnings.push(`eightDReports 包含 ${invalidRows} 条无效记录；本阶段将跳过，不阻断核心业务`)
      } else {
        blockers.push(`${table} 包含 ${invalidRows} 条非对象记录`)
      }
    }
    return { table, label, rows: rows.length }
  })

  const supported = new Set<string>(LEGACY_BUSINESS_TABLES.map(([table]) => table))
  const excluded = Object.entries(sourceTables)
    .filter(([table, rows]) => !supported.has(table) && Array.isArray(rows) && rows.length > 0)
    .map(([table, rows]) => ({ table, rows: (rows as unknown[]).length }))
    .sort((left, right) => left.table.localeCompare(right.table))
  const unknown = excluded.filter(item => !LEGACY_NON_BUSINESS_TABLES.has(item.table))
  if (unknown.length) {
    blockers.push(`发现未知非空数据集：${unknown.map(item => item.table).join('、')}`)
  }

  const totalRows = tables.reduce((total, table) => total + table.rows, 0)
  if (totalRows === 0) blockers.push('没有发现可迁移的 8 类 Issue 业务数据')

  const userReferences = collectReferences(sourceTables, USER_REFERENCE_FIELDS)
  const legacyUsers = legacyUserIdentities(sourceTables, userReferences)
  const orgUnitReferences = collectReferences(sourceTables, [['issueLists', 'orgUnitId']])
  const dictionary = Array.isArray(sourceTables.dict)
    ? previewLegacyDictionaryRows(sourceTables.dict, hostDictionaryItems)
    : null
  if (userReferences.length) warnings.push(`${userReferences.length} 个 legacy 用户引用必须映射到 Host 用户`)
  if (orgUnitReferences.length) {
    warnings.push(
      `${orgUnitReferences.length} 个 legacy 列表组织引用属于旧版未使用字段；业务提交物将置空，orgUnits 不导入`,
    )
  }

  return {
    version,
    timestamp,
    exportScope,
    tables,
    excluded,
    blockers,
    warnings,
    totalRows,
    userReferences,
    legacyUsers,
    orgUnitReferences,
    dictionary,
  }
}

export function createLegacyBusinessSubmission(
  value: unknown,
  rawSha256: string,
): LegacyBusinessSubmission {
  const preview = previewLegacyMigrationPackage(value)
  if (preview.blockers.length) throw new Error(preview.blockers.join('；'))
  if (!/^[a-f0-9]{64}$/.test(rawSha256)) throw new Error('原始迁移包 SHA-256 无效')

  const root = value as Record<string, unknown>
  const sourceTables = root.tables as Record<string, unknown>
  const tables = Object.fromEntries(
    LEGACY_BUSINESS_TABLES.map(([table]) => [
      table,
      tableRows(sourceTables, table).map(row => ({
        ...row,
        ...(table === 'issueLists' ? { orgUnitId: null } : {}),
      })),
    ]),
  ) as Record<LegacyBusinessTableName, Record<string, unknown>[]>

  return {
    dataset: 'phoenix-open-issue-business-v1',
    source: {
      version: 1,
      timestamp: preview.timestamp,
      exportScope: 'full',
      rawSha256,
    },
    tables,
  }
}
