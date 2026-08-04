import { ForbiddenError } from './errors.js'
import type { SystemRole } from '@open-issue/core'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'

export async function getUserSystemRoleAsync(db: PnwDbExecutor, userId: string): Promise<SystemRole> {
  const row = await db.get<{ systemRole?: SystemRole }>(
    'SELECT "systemRole" FROM "users" WHERE "id" = ?',
    [userId],
  )
  return row?.systemRole ?? 'editor'
}

export async function assertSystemAdminAsync(db: PnwDbExecutor, userId: string): Promise<void> {
  if (await getUserSystemRoleAsync(db, userId) !== 'admin') {
    throw new ForbiddenError('需要系统管理员权限')
  }
}

export async function isUserSystemAdminAsync(db: PnwDbExecutor, userId: string): Promise<boolean> {
  return await getUserSystemRoleAsync(db, userId) === 'admin'
}
