import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  createLegacyBusinessSubmission,
  previewLegacyMigrationPackage,
  suggestLegacyUserMappings,
} from './legacy-import'

function rows(count: number, create: (index: number) => Record<string, unknown>) {
  return Array.from({ length: count }, (_, index) => create(index))
}

function dictionaryRows() {
  const valuesByGroup = {
    issueCategory: rows(14, index => ({ value: `category-${index}` })),
    detectionPhase: rows(11, index => ({ value: `phase-${index}` })),
    orgUnitType: ['department', 'division', 'group', 'squad'].map(value => ({ value })),
    severity: ['trivial', 'minor', 'major', 'fatal'].map(value => ({ value })),
    closeReason: rows(6, index => ({ value: `reason-${index}` })),
    listType: ['yearly', 'monthly', 'project', 'custom', 'personal', 'group', 'department', 'division', 'company'].map(value => ({ value })),
    priority: ['low', 'medium', 'high', 'critical'].map(value => ({ value })),
  }
  return Object.entries(valuesByGroup).flatMap(([groupName, items]) =>
    items.map((item, sortOrder) => ({
      id: `dict-${groupName}-${sortOrder}`,
      groupName,
      value: item.value,
      label: `${groupName}:${item.value}`,
      sortOrder,
      enabled: 1,
      tags:
        groupName === 'severity' || groupName === 'priority' ||
        (groupName === 'listType' && sortOrder < 4)
          ? ',core,general,'
          : ',software,',
    })),
  )
}

function legacyPackage() {
  const users = rows(4, index => ({
    id: `legacy-user-${index}`,
    username: `user-${index}`,
    passwordHash: 'not-copied',
  }))
  return {
    version: 1,
    timestamp: '2026-08-03T22:45:23.638Z',
    passwordPolicy: 'resetAdmin',
    exportScope: 'full',
    tables: {
      users,
      orgUnits: rows(5, index => ({ id: `legacy-org-${index}`, name: `组织 ${index}` })),
      issueLists: rows(4, index => ({
        id: `list-${index}`,
        ownerId: `legacy-user-${index}`,
        orgUnitId: `legacy-org-${index % 3}`,
      })),
      issueListMembers: rows(6, index => ({
        id: `member-${index}`,
        listId: `list-${index % 4}`,
        userId: `legacy-user-${index % 4}`,
      })),
      issues: rows(4, index => ({
        id: `issue-${index}`,
        listId: `list-${index}`,
        createdBy: `legacy-user-${index}`,
        reporterId: `legacy-user-${index}`,
      })),
      issueListLinks: rows(7, index => ({
        id: `link-${index}`,
        issueId: `issue-${index % 4}`,
        listId: `list-${index % 4}`,
        linkedBy: `legacy-user-${index % 4}`,
      })),
      checkpoints: rows(12, index => ({
        id: `checkpoint-${index}`,
        issueId: `issue-${index % 4}`,
        responsibleUserId: `legacy-user-${index % 4}`,
      })),
      eightDReports: rows(3, index => ({
        id: `report-${index}`,
        relatedIssueId: `issue-${index}`,
        createdBy: `legacy-user-${index}`,
      })),
      pushRecords: rows(4, index => ({
        id: `push-${index}`,
        issueId: `issue-${index}`,
        pushedBy: `legacy-user-${index}`,
      })),
      dict: dictionaryRows(),
      poiFunctions: [{ id: 'function-1', platform: 'CAD', externalId: '1' }],
      externalIdentities: [],
      externalBindRequests: [],
    },
  }
}

function sanitizedLegacyPackage(): ReturnType<typeof legacyPackage> {
  const fixture = new URL(
    '../../../../../../tests/fixtures/legacy-import/migration-v1-full.sanitized.json',
    import.meta.url,
  )
  return JSON.parse(readFileSync(fixture, 'utf8')) as ReturnType<typeof legacyPackage>
}

function sanitizedLegacyPackageSha256() {
  const fixture = new URL(
    '../../../../../../tests/fixtures/legacy-import/migration-v1-full.sanitized.json',
    import.meta.url,
  )
  return createHash('sha256').update(readFileSync(fixture)).digest('hex')
}

describe('旧站 JSON 本地只读预检', () => {
  it('锁定 v1/full 的 41 行业务数据并排除账号、组织和字典', () => {
    const input = sanitizedLegacyPackage()
    const preview = previewLegacyMigrationPackage(input)

    expect(sanitizedLegacyPackageSha256()).toBe(
      '4ce585cc6bcf0bf6b2d4057bd6b91d7436ddf7e0689203f40d54a3746099a130',
    )
    expect(Array.isArray(input.tables.eightDReports)).toBe(true)
    expect(input.tables.eightDReports).toHaveLength(3)
    expect(input.tables.users.every(user =>
      String((user as Record<string, unknown>).email).endsWith('@example.invalid'),
    )).toBe(true)
    expect(input.tables.users.every(user => String(user.passwordHash).startsWith('REDACTED-FIXTURE-ONLY-'))).toBe(true)
    expect(preview.blockers).toEqual([])
    expect(preview.totalRows).toBe(41)
    expect(preview.tables.map(item => [item.table, item.rows])).toEqual([
      ['issueLists', 4],
      ['issueListMembers', 6],
      ['issues', 4],
      ['issueListLinks', 7],
      ['checkpoints', 12],
      ['eightDReports', 3],
      ['pushRecords', 4],
      ['poiFunctions', 1],
    ])
    expect(preview.excluded).toEqual([
      { table: 'dict', rows: 52 },
      { table: 'orgUnits', rows: 5 },
      { table: 'users', rows: 4 },
    ])
    expect(preview.userReferences).toHaveLength(4)
    expect(preview.legacyUsers.map(user => user.id)).toEqual(preview.userReferences)
    expect(preview.orgUnitReferences).toHaveLength(3)
    expect(preview.dictionary).toMatchObject({
      totalRows: 52,
      protectedRows: 12,
      disabledRows: 0,
      automaticImportAllowed: false,
      blockers: [],
    })
  })

  it('8D 缺失不阻断核心业务，提交物使用空数组等待服务端兼容提取', () => {
    const input = legacyPackage()
    delete (input.tables as Record<string, unknown>).eightDReports

    const preview = previewLegacyMigrationPackage(input)
    const submission = createLegacyBusinessSubmission(input, 'a'.repeat(64))

    expect(preview.blockers).toEqual([])
    expect(preview.warnings).toContain(
      'eightDReports 缺失或格式无效；服务端将尝试从 Issue 内嵌字段兼容提取，失败也不阻断核心业务',
    )
    expect(submission.tables.eightDReports).toEqual([])
  })

  it('只对用户名或邮箱唯一且一致的 Host 用户给出自动映射', () => {
    const mappings = suggestLegacyUserMappings([
      { id: 'legacy-1', username: ' Alice ', displayName: null, email: 'alice@example.com', disabled: false },
      { id: 'legacy-2', username: 'duplicate', displayName: null, email: null, disabled: false },
      { id: 'legacy-3', username: null, displayName: null, email: 'unique@example.com', disabled: true },
    ], [
      { id: '1', username: 'alice', displayName: 'Alice', email: 'ALICE@example.com', disabled: false },
      { id: '2', username: 'duplicate', displayName: null, email: null, disabled: false },
      { id: '3', username: 'duplicate', displayName: null, email: null, disabled: false },
      { id: '4', username: 'other', displayName: null, email: 'unique@example.com', disabled: true },
    ])

    expect(mappings).toEqual({ 'legacy-1': '1', 'legacy-3': '4' })
  })

  it('服务端提交物只含 8 类业务表，不携带账号、组织或字典', () => {
    const submission = createLegacyBusinessSubmission(sanitizedLegacyPackage(), 'a'.repeat(64))
    const serialized = JSON.stringify(submission)

    expect(Object.keys(submission.tables)).toEqual([
      'issueLists',
      'issueListMembers',
      'issues',
      'issueListLinks',
      'checkpoints',
      'eightDReports',
      'pushRecords',
      'poiFunctions',
    ])
    expect(submission.tables.issueLists.every(row => row.orgUnitId === null)).toBe(true)
    expect(serialized).not.toContain('passwordHash')
    expect(serialized).not.toContain('orgUnits')
    expect(serialized).not.toContain('"dict"')
  })

  it('拒绝个人受限导出、未知非空数据集和非法哈希', () => {
    const input = legacyPackage()
    input.exportScope = 'accessible'
    ;(input.tables as Record<string, unknown>).unknownTable = [{}]

    expect(previewLegacyMigrationPackage(input).blockers).toEqual([
      '个人受限导出不能用于数据库迁移',
      '发现未知非空数据集：unknownTable',
    ])
    expect(() => createLegacyBusinessSubmission(legacyPackage(), 'bad')).toThrow(
      '原始迁移包 SHA-256 无效',
    )
  })
})
