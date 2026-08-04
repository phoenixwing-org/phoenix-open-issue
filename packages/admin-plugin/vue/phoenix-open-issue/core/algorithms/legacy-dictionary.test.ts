import { describe, expect, it } from 'vitest'
import type { DictItem } from '../types/dict.js'
import { previewLegacyDictionaryRows } from './legacy-dictionary.js'

const valuesByGroup = {
  issueCategory: Array.from({ length: 14 }, (_, index) => `category-${index}`),
  detectionPhase: Array.from({ length: 11 }, (_, index) => `phase-${index}`),
  orgUnitType: ['department', 'division', 'group', 'squad'],
  severity: ['trivial', 'minor', 'major', 'fatal'],
  closeReason: Array.from({ length: 6 }, (_, index) => `reason-${index}`),
  listType: ['yearly', 'monthly', 'project', 'custom', 'personal', 'group', 'department', 'division', 'company'],
  priority: ['low', 'medium', 'high', 'critical'],
} as const

function dictionaryRows() {
  return Object.entries(valuesByGroup).flatMap(([groupName, values]) =>
    values.map((value, sortOrder) => {
      const core =
        groupName === 'severity' ||
        groupName === 'priority' ||
        (groupName === 'listType' && sortOrder < 4)
      return {
        id: `legacy:${groupName}:${value}`,
        groupName,
        value,
        label: `${groupName}:${value}`,
        sortOrder,
        enabled: 1,
        tags: core ? ',core,general,' : ',software,',
        createdAt: '2026-08-03T22:45:23.638Z',
      }
    }),
  )
}

function hostItem(groupName: string, value: string, label: string, id: string): DictItem {
  return {
    id,
    groupName,
    value,
    label,
    sortOrder: 0,
    enabled: 1,
    tags: 'host',
    createdAt: '',
  }
}

describe('legacy dictionary read-only preview', () => {
  it('冻结 52 行、7 个 namespaced 分组和 12 个核心协议项', () => {
    const rows = dictionaryRows()
    const preview = previewLegacyDictionaryRows(rows, [
      hostItem('severity', 'minor', 'severity:minor', 'cool:1'),
      hostItem('priority', 'high', 'Host 高优先', 'cool:2'),
      hostItem('listType', 'monthly', 'listType:monthly', 'builtin:listType:monthly'),
    ])

    expect(preview.totalRows).toBe(52)
    expect(preview.groups).toHaveLength(7)
    expect(preview.protectedRows).toBe(12)
    expect(preview.disabledRows).toBe(0)
    expect(preview.blockers).toEqual([])
    expect(preview.sameLabelRows).toBe(1)
    expect(preview.proposedCreates).toBe(50)
    expect(preview.labelConflicts).toEqual([
      { groupName: 'priority', value: 'high', protected: true },
    ])
    expect(preview.automaticImportAllowed).toBe(false)
    expect(preview.tags).toMatchObject({ core: 12, general: 12, software: 40 })
  })

  it('核心项停用、顺序漂移和重复排序均 fail closed', () => {
    const rows = dictionaryRows()
    const minor = rows.find(row => row.groupName === 'severity' && row.value === 'minor')!
    minor.enabled = 0
    const category = rows.filter(row => row.groupName === 'issueCategory')
    category[1].sortOrder = category[0].sortOrder

    const preview = previewLegacyDictionaryRows(rows)
    expect(preview.rows).toBeNull()
    expect(preview.blockers).toContain('severity 有 1 个核心协议项被停用')
    expect(preview.blockers).toContain('legacy 有 1 个停用项；COOL 字典没有 enabled 内置属性')
    expect(preview.blockers.some(item => item.includes('重复 sortOrder'))).toBe(true)
  })

  it('legacy core tag 只作证据，不能决定 Host core', () => {
    const rows = dictionaryRows()
    const minor = rows.find(row => row.groupName === 'severity' && row.value === 'minor')!
    minor.tags = ',general,'
    const extension = rows.find(
      row => row.groupName === 'listType' && row.value === 'personal',
    )!
    extension.tags = ',core,general,'

    const preview = previewLegacyDictionaryRows(rows)
    expect(preview.blockers).toEqual([])
    expect(preview.protectedRows).toBe(12)
    expect(preview.warnings).toEqual(expect.arrayContaining([
      expect.stringContaining('保护级别仍以 manifest itemClass 为准'),
      expect.stringContaining('不会据此升级为 Host core'),
    ]))
  })
})
