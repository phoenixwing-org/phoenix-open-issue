import { describe, expect, it } from 'vitest'
import {
  ISSUE_HOST_CAPABILITIES,
  hasIssueHostCapability,
} from './host-capability.js'

describe('Cool/Pah capability adapter', () => {
  it('matches stable semantic capability IDs exactly', () => {
    expect(hasIssueHostCapability(
      [
        'phoenix-open-issue:list:read',
        'GET /admin/phoenix-open-issue/lists',
      ],
      'phoenix-open-issue:list:read',
    )).toBe(true)
    expect(hasIssueHostCapability(
      ['prefix-phoenix-open-issue:list:read-suffix'],
      'phoenix-open-issue:list:read',
    )).toBe(false)
  })

  it('fails closed for missing Host permission state', () => {
    expect(hasIssueHostCapability(undefined, 'phoenix-open-issue:list:create')).toBe(false)
    expect(hasIssueHostCapability([], 'phoenix-open-issue:list:create')).toBe(false)
  })

  it('keeps the global list administration boundary separate from member reads', () => {
    expect(ISSUE_HOST_CAPABILITIES).toContain('phoenix-open-issue:list:admin')
    expect(hasIssueHostCapability(
      ['phoenix-open-issue:list:read'],
      'phoenix-open-issue:list:admin',
    )).toBe(false)
  })
})
