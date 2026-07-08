import { describe, it, expect } from 'vitest'
import { mapXlsxRow, diffImportRows } from '../../packages/core/src/algorithms/function-import.js'

describe('mapXlsxRow', () => {
  it('maps Chinese column names', () => {
    const result = mapXlsxRow({ '平台': '游戏软件', 'id': '1', '功能': '打地鼠' })
    expect(result.platform).toBe('游戏软件')
    expect(result.externalId).toBe('1')
    expect(result.functionName).toBe('打地鼠')
  })

  it('maps English column names', () => {
    const result = mapXlsxRow({ platform: 'test', id: '42', function: 'hello' })
    expect(result.platform).toBe('test')
    expect(result.externalId).toBe('42')
    expect(result.functionName).toBe('hello')
  })

  it('maps camelCase column names (functionName)', () => {
    const result = mapXlsxRow({ platform: 'p', id: '1', functionName: 'fn' })
    expect(result.functionName).toBe('fn')
  })

  it('trims whitespace from all string fields', () => {
    const result = mapXlsxRow({ platform: '  test  ', id: '3', function: ' fn ' })
    expect(result.platform).toBe('test')
    expect(result.functionName).toBe('fn')
  })

  it('returns empty string for missing required fields', () => {
    const result = mapXlsxRow({})
    expect(result.platform).toBe('')
    expect(result.externalId).toBe('')
    expect(result.functionName).toBe('')
  })

  it('passes through optional fields (targetYear, clientGroup, developGroup)', () => {
    const result = mapXlsxRow({ platform: 'p', id: '1', function: 'f', targetYear: '2024', clientGroup: '娱乐', developGroup: 'NodeJs' })
    expect(result.targetYear).toBe('2024')
    expect(result.clientGroup).toBe('娱乐')
    expect(result.developGroup).toBe('NodeJs')
  })

  it('treats number id as string', () => {
    const result = mapXlsxRow({ platform: 'p', id: 123, function: 'f' })
    expect(result.externalId).toBe('123')
  })
})

describe('diffImportRows', () => {
  const existing = [
    { platform: '游戏软件', externalId: '1', id: 'uuid-1' },
    { platform: '教学软件', externalId: '2', id: 'uuid-2' },
  ]

  it('classifies existing (platform,externalId) as toUpdate', () => {
    const incoming = [{ platform: '游戏软件', externalId: '1', functionName: '打地鼠v2' }]
    const { toInsert, toUpdate } = diffImportRows(existing, incoming)
    expect(toInsert).toHaveLength(0)
    expect(toUpdate).toHaveLength(1)
    expect(toUpdate[0].id).toBe('uuid-1')
    expect(toUpdate[0].data.functionName).toBe('打地鼠v2')
  })

  it('classifies new (platform,externalId) as toInsert', () => {
    const incoming = [{ platform: '新平台', externalId: '99', functionName: '新功能' }]
    const { toInsert, toUpdate } = diffImportRows(existing, incoming)
    expect(toInsert).toHaveLength(1)
    expect(toUpdate).toHaveLength(0)
    expect(toInsert[0].functionName).toBe('新功能')
  })

  it('handles mixed batch correctly', () => {
    const incoming = [
      { platform: '游戏软件', externalId: '1', functionName: '更新' },
      { platform: '新平台', externalId: '3', functionName: '新增' },
    ]
    const { toInsert, toUpdate } = diffImportRows(existing, incoming)
    expect(toInsert).toHaveLength(1)
    expect(toUpdate).toHaveLength(1)
  })

  it('returns empty arrays for empty input', () => {
    const { toInsert, toUpdate } = diffImportRows([], [])
    expect(toInsert).toHaveLength(0)
    expect(toUpdate).toHaveLength(0)
  })

  it('handles empty existing list (all insert)', () => {
    const incoming = [{ platform: 'p', externalId: '1', functionName: 'f' }]
    const { toInsert, toUpdate } = diffImportRows([], incoming)
    expect(toInsert).toHaveLength(1)
    expect(toUpdate).toHaveLength(0)
  })
})
