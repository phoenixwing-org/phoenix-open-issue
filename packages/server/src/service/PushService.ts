import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js'
import { generateId, validatePush } from '@open-issue/core'
import type {
  DashboardPushTask,
  PushRecord,
  PushRecordView,
  PushRequest,
  PushTargetListOption,
  PushValidationResult,
} from '@open-issue/core'
import { IssueListService } from './IssueListService.js'
import { assertListActionAsync, getActiveUserAsync, getListRoleAsync } from '../utils/access.js'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'

const listService = new IssueListService()

export class PushService {
  async preview(fromListId: string, toListId: string, userId: string): Promise<PushValidationResult> {
    const db = getAsyncDb()
    if (!fromListId || !toListId || fromListId === toListId) throw new BadRequestError('请选择不同的源列表和目标列表')
    await assertListActionAsync(db, fromListId, userId, 'push', '无权从源列表推送 Issue')
    await assertListActionAsync(db, toListId, userId, 'read', '无权访问目标列表')
    const fromMembers = await listService.getMembers(fromListId)
    const toMembers = await listService.getMembers(toListId)
    return validatePush({ fromMembers, toMembers })
  }

  private async validateUserTarget(db: PnwDbExecutor, toUserId: string, userId: string): Promise<void> {
    if (!toUserId) throw new BadRequestError('请选择接收人')
    if (toUserId === userId) throw new BadRequestError('不能推送给自己')
    const target = await db.get<{ approved: number; disabled: number; systemRole: string }>(
      'SELECT "approved", "disabled", "systemRole" FROM "users" WHERE "id" = ?',
      [toUserId],
    )
    if (!target || !target.approved || target.disabled) throw new BadRequestError('接收人不存在、未批准或已停用')
    if (target.systemRole === 'viewer') throw new BadRequestError('系统查看用户不能接收待处理推送')
  }

  async push(req: PushRequest, userId: string): Promise<{ records: PushRecord[]; validation: PushValidationResult }> {
    const db = getAsyncDb()
    const targetType = req?.targetType === 'user' ? 'user' : 'list'
    if (!req?.fromListId) throw new BadRequestError('请选择源列表')
    if (!Array.isArray(req.issueIds) || req.issueIds.length === 0) {
      throw new BadRequestError('请至少选择一个要推送的 Issue')
    }
    await assertListActionAsync(db, req.fromListId, userId, 'push', '无权从源列表推送 Issue')

    let validation: PushValidationResult
    let toListId: string | null = null
    let toUserId: string | null = null
    let targetName = ''
    if (targetType === 'user') {
      toUserId = req.toUserId ?? ''
      await this.validateUserTarget(db, toUserId, userId)
      const target = await db.get<{ name: string }>(
        'SELECT COALESCE(NULLIF("displayName", \'\'), "username") AS name FROM "users" WHERE "id" = ?',
        [toUserId],
      )
      targetName = target?.name ?? '指定用户'
      validation = {
        valid: true,
        overlapUserIds: [],
        overlapPercent: 0,
        canPush: true,
        message: '可推送：接收人接受时选择其有管理权限的目标列表',
      }
    } else {
      toListId = req.toListId ?? ''
      if (!toListId || req.fromListId === toListId) throw new BadRequestError('请选择不同的源列表和目标列表')
      await assertListActionAsync(db, toListId, userId, 'read', '无权访问目标列表')
      const fromMembers = await listService.getMembers(req.fromListId)
      const toMembers = await listService.getMembers(toListId)
      validation = validatePush({ fromMembers, toMembers })
      if (!validation.canPush) throw new ForbiddenError(validation.message)
      const toList = await listService.getById(toListId)
      if (!toList) throw new NotFoundError('目标列表')
      targetName = toList.name
    }

    const fromList = await listService.getById(req.fromListId)
    if (!fromList) throw new NotFoundError('源列表')
    const records: PushRecord[] = []

    await db.transaction(async tx => {
      for (const issueId of [...new Set(req.issueIds)]) {
        // 来源资格按当前列表关联判断，而不是只认 Issue 的创建列表。
        // 这样个人、小组、科室、部门之间可以逐级转推同一条 Issue。
        const issue = await tx.get(
          `SELECT i."id"
             FROM "issues" i
            WHERE i."id" = ?
              AND EXISTS (
                SELECT 1 FROM "issueListLinks" link
                 WHERE link."issueId" = i."id" AND link."listId" = ?
              )`,
          [issueId, req.fromListId],
        ) as { id: string } | undefined
        if (!issue) throw new BadRequestError('推送数据包含不属于源列表的 Issue')

        const recordId = generateId()
        const now = new Date().toISOString()
        await tx.run(
          `INSERT INTO "pushRecords"
             ("id", "fromListId", "targetType", "toListId", "toUserId", "issueId", "pushedBy", "pushedAt", "note")
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [recordId, req.fromListId, targetType, toListId, toUserId, issueId, userId, now, req.note ?? ''],
        )
        records.push({
          id: recordId,
          fromListId: req.fromListId,
          targetType,
          toListId,
          toUserId,
          issueId,
          pushedBy: userId,
          pushedAt: now,
          status: 'pending',
          handledBy: null,
          handledAt: null,
          rejectReason: null,
          note: req.note ?? '',
        })
      }
    })

    console.log(`📤 [PUSH] ${records.length} issue(s) from "${fromList.name}" → ${targetType === 'user' ? 'user ' : ''}"${targetName}" by ${userId}`)
    return { records, validation }
  }

  private historySelect(): string {
    return `SELECT pr.*, i."title" AS "issueTitle", fl."name" AS "fromListName",
                   tl."name" AS "toListName",
                   COALESCE(NULLIF(tu."displayName", ''), tu."username") AS "toUserName",
                   COALESCE(NULLIF(pu."displayName", ''), pu."username") AS "pushedByName"
              FROM "pushRecords" pr
              JOIN "issues" i ON i."id" = pr."issueId"
              JOIN "issueLists" fl ON fl."id" = pr."fromListId"
         LEFT JOIN "issueLists" tl ON tl."id" = pr."toListId"
         LEFT JOIN "users" tu ON tu."id" = pr."toUserId"
              JOIN "users" pu ON pu."id" = pr."pushedBy"`
  }

  /**
   * 仪表盘只读取仍可处理的推送，不扫描已完成历史。
   * 同一条推送可能同时属于“待我处理”和“我发起的”，两个视角分别保留。
   */
  async getDashboardTasks(userId: string): Promise<{
    incomingPushes: DashboardPushTask[]
    outgoingPushes: DashboardPushTask[]
  }> {
    const db = getAsyncDb()
    const user = await getActiveUserAsync(db, userId)
    const canReceive = user.systemRole === 'viewer'
      ? '0 = 1'
      : `((pr."targetType" = 'user' AND pr."toUserId" = ?)
          OR (pr."targetType" = 'list' AND EXISTS (
            SELECT 1 FROM "issueListMembers" tm
             WHERE tm."listId" = pr."toListId" AND tm."userId" = ?
               AND tm."role" IN ('owner', 'admin')
          )))`
    const visibility = `(pr."pushedBy" = ? OR ${canReceive})`
    const params = user.systemRole === 'viewer'
      ? [userId]
      : [userId, userId, userId]
    const records = await db.all<PushRecordView>(
      `${this.historySelect()}
       WHERE pr."status" = 'pending' AND (${visibility})
       ORDER BY pr."pushedAt" DESC`,
      params,
    )

    const targetIds = [...new Set(records.map(record => record.toListId).filter((id): id is string => !!id))]
    const roles = new Map(await Promise.all(targetIds.map(async listId =>
      [listId, await getListRoleAsync(db, listId, userId)] as const,
    )))
    const annotated: DashboardPushTask[] = records.map(record => Object.assign(record, {
      _canHandle: user.systemRole !== 'viewer' && (
        (record.targetType === 'user' && record.toUserId === userId)
        || (record.targetType === 'list' && ['owner', 'admin'].includes(roles.get(record.toListId ?? '') ?? ''))
      ),
      _canWithdraw: record.pushedBy === userId,
    }))
    return {
      incomingPushes: annotated.filter(record => record._canHandle),
      outgoingPushes: annotated.filter(record => record._canWithdraw),
    }
  }

  async getListPushHistory(listId: string, userId: string): Promise<PushRecordView[]> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'read', '无权查看此列表推送记录')
    return db.all<PushRecordView>(
      `${this.historySelect()}
       WHERE pr."fromListId" = ? OR pr."toListId" = ?
       ORDER BY pr."pushedAt" DESC`,
      [listId, listId],
    )
  }

  async getMyPushHistory(userId: string): Promise<PushRecordView[]> {
    const db = getAsyncDb()
    const user = await getActiveUserAsync(db, userId)
    const isAdmin = user.systemRole === 'admin'
    const visibility = isAdmin
      ? '1 = 1'
      : `(pr."pushedBy" = ?
          OR (pr."targetType" = 'user' AND pr."toUserId" = ?)
          OR (pr."targetType" = 'list' AND pr."toListId" IN (SELECT "listId" FROM "issueListMembers" WHERE "userId" = ?))
          OR pr."fromListId" IN (SELECT "listId" FROM "issueListMembers" WHERE "userId" = ?))`
    const params = isAdmin ? [] : [userId, userId, userId, userId]
    const records = await db.all<PushRecordView>(
      `${this.historySelect()} WHERE ${visibility} ORDER BY pr."pushedAt" DESC`,
      params,
    )
    const targetIds = [...new Set(records.map(record => record.toListId).filter((id): id is string => !!id))]
    const roles = new Map(await Promise.all(targetIds.map(async listId =>
      [listId, await getListRoleAsync(db, listId, userId)] as const,
    )))
    return records.map(record => Object.assign(record, {
      _canHandle: user.systemRole !== 'viewer' && record.status === 'pending' && (
        isAdmin
        || (record.targetType === 'user' && record.toUserId === userId)
        || (record.targetType === 'list' && ['owner', 'admin'].includes(roles.get(record.toListId ?? '') ?? ''))
      ),
      _canWithdraw: record.status === 'pending' && record.pushedBy === userId,
    }))
  }

  /** 获取发到目标列表的待处理推送；定向用户推送只出现在接收人的个人历史中。 */
  async getIncomingPushes(listId: string, userId: string): Promise<PushRecordView[]> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'read', '无权查看此列表待处理推送')
    return db.all<PushRecordView>(
      `${this.historySelect()}
       WHERE pr."targetType" = 'list' AND pr."toListId" = ? AND pr."status" = 'pending'
       ORDER BY pr."pushedAt" DESC`,
      [listId],
    )
  }

  async getTargetLists(recordId: string, userId: string): Promise<PushTargetListOption[]> {
    const db = getAsyncDb()
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole === 'viewer') throw new ForbiddenError('系统查看用户不能处理推送')
    const record = await db.get<PushRecord>('SELECT * FROM "pushRecords" WHERE "id" = ?', [recordId])
    if (!record) throw new NotFoundError('推送记录')
    if (record.status !== 'pending' || record.targetType !== 'user') throw new BadRequestError('该记录不是待处理的用户推送')
    if (actor.systemRole !== 'admin' && record.toUserId !== userId) throw new ForbiddenError('只有指定接收人可以处理此推送')

    if (actor.systemRole === 'admin') {
      return db.all<PushTargetListOption>(
        `SELECT "id", "name", "listType", NULL AS "role" FROM "issueLists"
         WHERE "archived" = 0 AND "isDeleted" = 0 ORDER BY "name"`,
      )
    }
    return db.all<PushTargetListOption>(
      `SELECT l."id", l."name", l."listType", m."role"
         FROM "issueLists" l
         JOIN "issueListMembers" m ON m."listId" = l."id" AND m."userId" = ?
        WHERE l."archived" = 0 AND l."isDeleted" = 0 AND m."role" IN ('owner','admin')
        ORDER BY l."name"`,
      [userId],
    )
  }

  /** 接受或拒绝；用户定向推送仅在接受时绑定目标列表。 */
  async handlePush(
    recordId: string,
    action: 'accepted' | 'rejected',
    userId: string,
    rejectReason?: string,
    requestedToListId?: string,
  ): Promise<PushRecord> {
    const db = getAsyncDb()
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole === 'viewer') throw new ForbiddenError('系统查看用户不能处理推送')
    const record = await db.get<PushRecord>('SELECT * FROM "pushRecords" WHERE "id" = ?', [recordId])
    if (!record) throw new NotFoundError('推送记录')
    if (action !== 'accepted' && action !== 'rejected') throw new BadRequestError('无效的推送处理动作')

    const targetType = record.targetType ?? 'list'
    if (targetType === 'user') {
      if (actor.systemRole !== 'admin' && record.toUserId !== userId) {
        throw new ForbiddenError('只有指定接收人可以处理此推送')
      }
    } else {
      if (!record.toListId) throw new BadRequestError('列表推送缺少目标列表')
      await assertListActionAsync(db, record.toListId, userId, 'handle-push', '只有目标列表所有者或管理员可以处理推送')
    }

    const acceptedToListId = targetType === 'user' ? requestedToListId : record.toListId
    if (action === 'accepted') {
      if (!acceptedToListId) throw new BadRequestError('接受推送时请选择目标列表')
      await assertListActionAsync(db, acceptedToListId, userId, 'handle-push', '只能接受到您有管理权限的目标列表')
      const target = await db.get<{ id: string }>(
        'SELECT "id" FROM "issueLists" WHERE "id" = ? AND "archived" = 0 AND "isDeleted" = 0',
        [acceptedToListId],
      )
      if (!target) throw new BadRequestError('目标列表不存在、已归档或已删除')
    }

    const now = new Date().toISOString()
    await db.transaction(async tx => {
      const updated = await tx.run(
        `UPDATE "pushRecords"
            SET "status" = ?, "toListId" = ?, "handledBy" = ?, "handledAt" = ?, "rejectReason" = ?
          WHERE "id" = ? AND "status" = 'pending'`,
        [action, action === 'accepted' ? acceptedToListId : record.toListId, userId, now, rejectReason ?? null, recordId],
      )
      if (updated.changes !== 1) throw new ForbiddenError('该推送已处理')

      if (action === 'accepted') {
        const issue = await tx.get<{ id: string }>('SELECT "id" FROM "issues" WHERE "id" = ?', [record.issueId])
        if (!issue) throw new NotFoundError('Issue')
        await tx.run(
          `INSERT INTO "issueListLinks" ("id", "issueId", "listId", "linkedBy")
           VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [generateId(), record.issueId, acceptedToListId, userId],
        )
      }
    })

    console.log(`📋 [PUSH] ${action === 'accepted' ? '✅ 接受' : '❌ 拒绝'} push ${recordId} by ${userId}`)
    return await db.get<PushRecord>('SELECT * FROM "pushRecords" WHERE "id" = ?', [recordId]) as PushRecord
  }

  async withdrawPush(recordId: string, userId: string): Promise<PushRecord> {
    const db = getAsyncDb()
    await getActiveUserAsync(db, userId)
    const now = new Date().toISOString()
    const updated = await db.run(
      `UPDATE "pushRecords"
          SET "status" = 'withdrawn', "handledBy" = ?, "handledAt" = ?
        WHERE "id" = ? AND "status" = 'pending' AND "pushedBy" = ?`,
      [userId, now, recordId, userId],
    )
    if (updated.changes !== 1) {
      const record = await db.get<PushRecord>('SELECT * FROM "pushRecords" WHERE "id" = ?', [recordId])
      if (!record) throw new NotFoundError('推送记录')
      if (record.pushedBy !== userId) throw new ForbiddenError('只有发起人可以撤回推送')
      throw new ForbiddenError('该推送已处理，不能撤回')
    }
    return await db.get<PushRecord>('SELECT * FROM "pushRecords" WHERE "id" = ?', [recordId]) as PushRecord
  }
}
