import { describe, expect, it } from 'vitest'
import { formatUserLabel, resolveUserLabel, unknownUserLabel } from './user-label.js'

describe('用户展示标签', () => {
  it('优先显示姓名（账号），并避免重复姓名与空白值', () => {
    expect(formatUserLabel({ displayName: ' 李四 ', username: 'lisi' })).toBe('李四（lisi）')
    expect(formatUserLabel({ displayName: 'admin', username: 'admin' })).toBe('admin')
    expect(formatUserLabel({ displayName: ' ', username: 'zhangsan' })).toBe('zhangsan')
  })

  it('按字符串化 ID 解析用户，未知引用显示明确 ID', () => {
    const users = [{ id: 2, displayName: '李四', username: 'lisi' }]
    expect(resolveUserLabel(users, '2')).toBe('李四（lisi）')
    expect(resolveUserLabel(users, '3')).toBe('未知用户（ID 3）')
    expect(resolveUserLabel(users, null)).toBe('—')
    expect(unknownUserLabel('9')).toBe('未知用户（ID 9）')
  })
})
