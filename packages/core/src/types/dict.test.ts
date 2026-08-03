import { describe, expect, it } from 'vitest'
import { getIssueBuiltinDictLabel } from './dict.js'

describe('getIssueBuiltinDictLabel', () => {
  it('为已有七个字典分组提供中文显示兜底', () => {
    expect(getIssueBuiltinDictLabel('severity', 'minor')).toBe('一般')
    expect(getIssueBuiltinDictLabel('priority', 'critical')).toBe('立即')
    expect(getIssueBuiltinDictLabel('listType', 'project')).toBe('项目')
    expect(getIssueBuiltinDictLabel('issueCategory', 'function')).toBe('功能')
    expect(getIssueBuiltinDictLabel('detectionPhase', 'incoming')).toBe('来料检验')
    expect(getIssueBuiltinDictLabel('orgUnitType', 'division')).toBe('部')
    expect(getIssueBuiltinDictLabel('closeReason', 'unreproducible')).toBe('不可复现')
  })

  it('不替未知的可扩展字典值伪造中文标签', () => {
    expect(getIssueBuiltinDictLabel('listType', 'customer-defined')).toBeUndefined()
    expect(getIssueBuiltinDictLabel('unknown', 'minor')).toBeUndefined()
  })
})
