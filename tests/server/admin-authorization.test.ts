import { describe, expect, it, vi } from 'vitest'
import type { SystemRole } from '@open-issue/core'
import type { PnwDbExecutor } from '../../packages/server/src/db/pnw/pnwDbTypes.js'
import {
  assertSystemAdminAsync,
  getUserSystemRoleAsync,
  isUserSystemAdminAsync,
} from '../../packages/server/src/utils/admin.js'

function executor(role?: SystemRole): PnwDbExecutor {
  return {
    get: vi.fn(async () => role ? { systemRole: role } : undefined),
    all: vi.fn(async () => []),
    run: vi.fn(async () => ({ changes: 0 })),
    exec: vi.fn(async () => undefined),
  }
}

describe('standalone async administrator authorization', () => {
  it('reads the role through a bound executor query', async () => {
    const db = executor('admin')

    await expect(getUserSystemRoleAsync(db, 'user-1')).resolves.toBe('admin')
    expect(db.get).toHaveBeenCalledWith(
      'SELECT "systemRole" FROM "users" WHERE "id" = ?',
      ['user-1'],
    )
  })

  it('treats a missing user or role as editor', async () => {
    await expect(getUserSystemRoleAsync(executor(), 'missing')).resolves.toBe('editor')
  })

  it('allows administrators and rejects editors with 403', async () => {
    await expect(assertSystemAdminAsync(executor('admin'), 'admin-1')).resolves.toBeUndefined()
    await expect(assertSystemAdminAsync(executor('editor'), 'editor-1')).rejects.toMatchObject({
      name: 'ForbiddenError',
      statusCode: 403,
      message: '需要系统管理员权限',
    })
  })

  it('reports administrator status without a synchronous database bridge', async () => {
    await expect(isUserSystemAdminAsync(executor('admin'), 'admin-1')).resolves.toBe(true)
    await expect(isUserSystemAdminAsync(executor('viewer'), 'viewer-1')).resolves.toBe(false)
  })
})
