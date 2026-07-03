import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'fs'

vi.mock('fs', () => ({
  default: { existsSync: vi.fn() },
}))

import { resolvePhoenixWingPath } from './resolvePhoenixWing'

const mockExistsSync = vi.mocked(fs.existsSync)

describe('resolvePhoenixWingPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('返回 null 当本地 phoenix-wing 不存在', () => {
    mockExistsSync.mockReturnValue(false)

    const result = resolvePhoenixWingPath('/Users/me/phoenix-open-issue/packages/web')
    expect(result).toBeNull()
  })

  it('返回本地路径当 phoenix-wing 存在', () => {
    mockExistsSync.mockReturnValue(true)

    const result = resolvePhoenixWingPath('/Users/me/phoenix-open-issue/packages/web')
    expect(result).toBe('/Users/me/phoenix-wing/src')
  })

  it('支持自定义相对路径', () => {
    mockExistsSync.mockReturnValue(true)

    const result = resolvePhoenixWingPath('/app/packages/web', '../custom-wing/src')
    expect(result).toBe('/app/packages/custom-wing/src')
  })
})
