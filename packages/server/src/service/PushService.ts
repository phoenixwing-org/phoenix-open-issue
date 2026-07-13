import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, validatePush } from '@open-issue/core'
import type { PushRecord, PushRequest, PushValidationResult } from '@open-issue/core'
import { IssueListService } from './IssueListService.js'

const listService = new IssueListService()

export class PushService {
  async preview(fromListId: string, toListId: string): Promise<PushValidationResult> {
    const fromMembers = await listService.getMembers(fromListId)
    const toMembers = await listService.getMembers(toListId)
    return validatePush({ fromMembers, toMembers })
  }

  async push(req: PushRequest, userId: string): Promise<{ records: PushRecord[]; validation: PushValidationResult }> {
    const db = getAsyncDb()

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
        if (!issue) continue

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

  async getListPushHistory(listId: string): Promise<PushRecord[]> {
    const db = getAsyncDb()
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
    return db.all<PushRecord>(
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
  }

  /** 获取发到目标列表的待处理推送 */
  async getIncomingPushes(listId: string): Promise<PushRecord[]> {
    const db = getAsyncDb()
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
    if (record.status !== 'pending') throw new ForbiddenError('该推送已处理')

    const now = new Date().toISOString()
    await db.run(
      `UPDATE pushRecords SET status = ?, handledBy = ?, handledAt = ?, rejectReason = ? WHERE id = ?`,
      [action, userId, now, rejectReason ?? null, recordId],
    )

    console.log(`📋 [PUSH] ${action === 'accepted' ? '✅ 接受' : '❌ 拒绝'} push ${recordId} by ${userId}${rejectReason ? ` (理由: ${rejectReason})` : ''}`)

    // 接受后创建 issueListLinks 链接（而非复制 Issue）
    if (action === 'accepted') {
      const issue = await db.get<any>('SELECT * FROM issues WHERE id = ?', [record.issueId])
      if (issue) {
        // 检查是否已有链接
        const existing = await db.get(
          'SELECT id FROM issueListLinks WHERE issueId = ? AND listId = ?',
          [record.issueId, record.toListId],
        )
        if (!existing) {
          await db.run(
            'INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES (?, ?, ?, ?)',
            [generateId(), record.issueId, record.toListId, userId],
          )
          console.log(`   🔗 已链接 Issue "${issue.title}" → 目标列表 (toListId=${record.toListId})`)
        }
      }
    }

    return await db.get<PushRecord>('SELECT * FROM pushRecords WHERE id = ?', [recordId]) as PushRecord
  }
}
