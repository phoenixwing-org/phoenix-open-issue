import { getDb } from '../db/connection.js'
import { ForbiddenError } from './errors.js'
import type { SystemRole } from '@open-issue/core'

export function getUserSystemRole(userId: string): SystemRole {
  const db = getDb()
  const row = db.get('SELECT systemRole FROM users WHERE id = ?', userId) as { systemRole?: SystemRole } | undefined
  return (row?.systemRole ?? 'editor') as SystemRole
}

export function isUserSystemAdmin(userId: string): boolean {
  return getUserSystemRole(userId) === 'admin'
}

export function assertSystemAdmin(userId: string): void {
  if (!isUserSystemAdmin(userId)) throw new ForbiddenError('需要系统管理员权限')
}
