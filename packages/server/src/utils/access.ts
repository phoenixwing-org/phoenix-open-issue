import { canPerformListAction, type ListAction, type MemberRole, type SystemRole } from '@open-issue/core'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'
import { ForbiddenError, NotFoundError, UnauthorizedError } from './errors.js'

interface ActiveUserRow {
  systemRole: SystemRole
  approved: number
  disabled: number
  tokenVersion?: number
}

export async function getActiveUserAsync(db: PnwDbExecutor, userId: string): Promise<ActiveUserRow> {
  const user = await db.get<ActiveUserRow>(
    'SELECT "systemRole", "approved", "disabled", "tokenVersion" FROM "users" WHERE "id" = ?',
    [userId],
  )
  if (!user || !user.approved || user.disabled) throw new UnauthorizedError('账号不存在、未批准或已被禁用')
  return user
}

export async function getListRoleAsync(db: PnwDbExecutor, listId: string, userId: string): Promise<MemberRole | null> {
  const member = await db.get<{ role: MemberRole }>(
    'SELECT "role" FROM "issueListMembers" WHERE "listId" = ? AND "userId" = ?',
    [listId, userId],
  )
  return member?.role ?? null
}

export async function assertListActionAsync(
  db: PnwDbExecutor,
  listId: string,
  userId: string,
  action: ListAction,
  message = '无权执行此列表操作',
): Promise<MemberRole | null> {
  const user = await getActiveUserAsync(db, userId)
  const role = await getListRoleAsync(db, listId, userId)
  if (!canPerformListAction(user, role, action)) throw new ForbiddenError(message)
  return role
}

export async function assertSystemCanWriteAsync(db: PnwDbExecutor, userId: string): Promise<void> {
  const user = await getActiveUserAsync(db, userId)
  if (user.systemRole === 'viewer') throw new ForbiddenError('系统查看用户为全局只读，不能执行写操作')
}

export async function assertIssueReadableAsync(db: PnwDbExecutor, issueId: string, userId: string): Promise<void> {
  const user = await getActiveUserAsync(db, userId)
  if (user.systemRole === 'admin') return

  const access = await db.get<{ role: MemberRole }>(
    `SELECT m."role"
       FROM "issueListLinks" il
       JOIN "issueListMembers" m ON m."listId" = il."listId" AND m."userId" = ?
      WHERE il."issueId" = ?
      LIMIT 1`,
    [userId, issueId],
  )
  if (!access) throw new ForbiddenError('无权访问此 Issue')
}

export async function getIssueOriginListIdAsync(db: PnwDbExecutor, issueId: string): Promise<string> {
  const issue = await db.get<{ listId: string }>('SELECT "listId" FROM "issues" WHERE "id" = ?', [issueId])
  if (!issue) throw new NotFoundError('Issue')
  return issue.listId
}
