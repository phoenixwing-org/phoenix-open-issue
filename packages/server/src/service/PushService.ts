import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js'
import { generateId, validatePush } from '@open-issue/core'
import type { PushRecord, PushRequest, PushValidationResult } from '@open-issue/core'
import { IssueListService } from './IssueListService.js'
import { assertListActionAsync, getActiveUserAsync, getListRoleAsync } from '../utils/access.js'

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

  async push(req: PushRequest, userId: string): Promise<{ records: PushRecord[]; validation: PushValidationResult }> {
    const db = getAsyncDb()
    if (!req?.fromListId || !req?.toListId || req.fromListId === req.toListId) {
      throw new BadRequestError('请选择不同的源列表和目标列表')
    }
    if (!Array.isArray(req.issueIds) || req.issueIds.length === 0) {
      throw new BadRequestError('请至少选择一个要推送的 Issue')
    }
    await assertListActionAsync(db, req.fromListId, userId, 'push', '无权从源列表推送 Issue')
    await assertListActionAsync(db, req.toListId, userId, 'read', '无权访问目标列表')

    const fromMembers = await listService.getMembers(req.fromListId)
    const toMembers = await listService.getMembers(req.toListId)
    const validation = validatePush({ fromMembers, toMembers })

    if (!validation.canPush) {
      throw new ForbiddenError(validation.message)
    }

    const fromList = await listService.getById(req.fromListId)
    const toList = await listService.getById(req.toListId)
    if (!fromList) throw new NotFoundError('源列表')
    if (!toList) throw new NotFoundError('目标列表')

    const records: PushRecord[] = []

    await db.transaction(async tx => {
      for (const issueId of req.issueIds) {
        const issue = await tx.get('SELECT * FROM issues WHERE id = ? AND listId = ?',
          [issueId, req.fromListId]) as { id: string } | undefined
        if (!issue) throw new BadRequestError('推送数据包含不属于源列表的 Issue')

        const recordId = generateId()
        const now = new Date().toISOString()
        await tx.run(
          `INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy, note)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [recordId, req.fromListId, req.toListId, issueId, userId, req.note ?? ''],
        )
        records.push({
          id: recordId,
          fromListId: req.fromListId,
          toListId: req.toListId,
          issueId: issueId,
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

    console.log(`📤 [PUSH] ${records.length} issue(s) from "${fromList.name}" → "${toList.name}" by ${userId}`)
    for (const r of records) {
      console.log(`   record ${r.id}: issue=${r.issueId} status=pending`)
    }
    return { records, validation }
  }

  async getListPushHistory(listId: string, userId: string): Promise<PushRecord[]> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'read', '无权查看此列表推送记录')
    return db.all<PushRecord>(
      `SELECT pr.*, i.title as issueTitle, fl.name as fromListName, tl.name as toListName
       FROM pushRecords pr
       JOIN issues i ON i.id = pr.issueId
       JOIN issueLists fl ON fl.id = pr.fromListId
       JOIN issueLists tl ON tl.id = pr.toListId
       WHERE pr.fromListId = ? OR pr.toListId = ?
       ORDER BY pr.pushedAt DESC`,
      [listId, listId],
    )
  }

  async getMyPushHistory(userId: string): Promise<PushRecord[]> {
    const db = getAsyncDb()
    const user = await getActiveUserAsync(db, userId)
    const records = await db.all<PushRecord>(
      `SELECT pr.*, i.title as issueTitle, fl.name as fromListName, tl.name as toListName
       FROM pushRecords pr
       JOIN issues i ON i.id = pr.issueId
       JOIN issueLists fl ON fl.id = pr.fromListId
       JOIN issueLists tl ON tl.id = pr.toListId
       WHERE pr.pushedBy = ?
          OR pr.toListId IN (SELECT listId FROM issueListMembers WHERE userId = ?)
          OR pr.fromListId IN (SELECT listId FROM issueListMembers WHERE userId = ?)
       ORDER BY pr.pushedAt DESC`,
      [userId, userId, userId],
    )
    const targetIds = [...new Set(records.map(record => record.toListId))]
    const roles = new Map(await Promise.all(targetIds.map(async listId =>
      [listId, await getListRoleAsync(db, listId, userId)] as const,
    )))
    return records.map(record => Object.assign(record, {
      _canHandle: user.systemRole === 'admin'
        || (user.systemRole !== 'viewer' && ['owner', 'admin'].includes(roles.get(record.toListId) ?? '')),
    }))
  }

  /** 获取发到目标列表的待处理推送 */
  async getIncomingPushes(listId: string, userId: string): Promise<PushRecord[]> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'read', '无权查看此列表待处理推送')
    return db.all<PushRecord>(
      `SELECT pr.*, i.title as issueTitle, fl.name as fromListName
       FROM pushRecords pr
       JOIN issues i ON i.id = pr.issueId
       JOIN issueLists fl ON fl.id = pr.fromListId
       WHERE pr.toListId = ? AND pr.status = 'pending'
       ORDER BY pr.pushedAt DESC`,
      [listId],
    )
  }

  /** 审批推送：接受或拒绝 */
  async handlePush(recordId: string, action: 'accepted' | 'rejected', userId: string, rejectReason?: string): Promise<PushRecord> {
    const db = getAsyncDb()
    const record = await db.get<PushRecord>('SELECT * FROM pushRecords WHERE id = ?', [recordId])
    if (!record) throw new NotFoundError('推送记录')
    if (action !== 'accepted' && action !== 'rejected') throw new BadRequestError('无效的推送处理动作')
    await assertListActionAsync(db, record.toListId, userId, 'handle-push', '只有目标列表所有者或管理员可以处理推送')

    const now = new Date().toISOString()
    await db.transaction(async tx => {
      const updated = await tx.run(
        `UPDATE pushRecords SET status = ?, handledBy = ?, handledAt = ?, rejectReason = ?
         WHERE id = ? AND status = 'pending'`,
        [action, userId, now, rejectReason ?? null, recordId],
      )
      if (updated.changes !== 1) throw new ForbiddenError('该推送已处理')

      // 接受状态与列表链接在同一事务内提交，避免只更新一半。
      if (action === 'accepted') {
        const issue = await tx.get<{ title: string }>('SELECT title FROM issues WHERE id = ?', [record.issueId])
        if (!issue) throw new NotFoundError('Issue')
        await tx.run(
          `INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
           VALUES (?, ?, ?, ?) ON CONFLICT DO NOTHING`,
          [generateId(), record.issueId, record.toListId, userId],
        )
      }
    })

    console.log(`📋 [PUSH] ${action === 'accepted' ? '✅ 接受' : '❌ 拒绝'} push ${recordId} by ${userId}${rejectReason ? ` (理由: ${rejectReason})` : ''}`)

    return await db.get<PushRecord>('SELECT * FROM pushRecords WHERE id = ?', [recordId]) as PushRecord
  }
}
