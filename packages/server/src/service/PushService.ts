import { getDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, validatePush } from '@open-issue/core'
import type { PushRecord, PushRequest, PushValidationResult } from '@open-issue/core'
import { IssueListService } from './IssueListService.js'

const listService = new IssueListService()

export class PushService {
  preview(fromListId: string, toListId: string): PushValidationResult {
    const fromMembers = listService.getMembers(fromListId)
    const toMembers = listService.getMembers(toListId)
    return validatePush({ fromMembers, toMembers })
  }

  push(req: PushRequest, userId: string): { records: PushRecord[]; validation: PushValidationResult } {
    const db = getDb()

    const fromMembers = listService.getMembers(req.fromListId)
    const toMembers = listService.getMembers(req.toListId)
    const validation = validatePush({ fromMembers, toMembers })

    if (!validation.canPush) {
      throw new ForbiddenError(validation.message)
    }

    const fromList = listService.getById(req.fromListId)
    const toList = listService.getById(req.toListId)
    if (!fromList) throw new NotFoundError('源列表')
    if (!toList) throw new NotFoundError('目标列表')

    const records: PushRecord[] = []

    db.exec('BEGIN TRANSACTION')
    try {
      for (const issueId of req.issueIds) {
        const issue = db.get('SELECT * FROM issues WHERE id = ? AND listId = ?',
          [issueId, req.fromListId]) as { id: string } | undefined
        if (!issue) continue

        const recordId = generateId()
        const now = new Date().toISOString()
        db.run(
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
      db.exec('COMMIT')
    } catch (err) {
      if (db.inTransaction) db.exec('ROLLBACK')
      throw err
    }

    console.log(`📤 [PUSH] ${records.length} issue(s) from "${fromList.name}" → "${toList.name}" by ${userId}`)
    for (const r of records) {
      console.log(`   record ${r.id}: issue=${r.issueId} status=pending`)
    }
    return { records, validation }
  }

  getListPushHistory(listId: string): PushRecord[] {
    const db = getDb()
    return db.all(
      `SELECT pr.*, i.title as issueTitle, fl.name as fromListName, tl.name as toListName
       FROM pushRecords pr
       JOIN issues i ON i.id = pr.issueId
       JOIN issueLists fl ON fl.id = pr.fromListId
       JOIN issueLists tl ON tl.id = pr.toListId
       WHERE pr.fromListId = ? OR pr.toListId = ?
       ORDER BY pr.pushedAt DESC`,
      [listId, listId],
    ) as PushRecord[]
  }

  getMyPushHistory(userId: string): PushRecord[] {
    const db = getDb()
    return db.all(
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
    ) as PushRecord[]
  }

  /** 获取发到目标列表的待处理推送 */
  getIncomingPushes(listId: string): PushRecord[] {
    const db = getDb()
    return db.all(
      `SELECT pr.*, i.title as issueTitle, fl.name as fromListName
       FROM pushRecords pr
       JOIN issues i ON i.id = pr.issueId
       JOIN issueLists fl ON fl.id = pr.fromListId
       WHERE pr.toListId = ? AND pr.status = 'pending'
       ORDER BY pr.pushedAt DESC`,
      listId,
    ) as PushRecord[]
  }

  /** 审批推送：接受或拒绝 */
  handlePush(recordId: string, action: 'accepted' | 'rejected', userId: string, rejectReason?: string): PushRecord {
    const db = getDb()
    const record = db.get('SELECT * FROM pushRecords WHERE id = ?', recordId) as PushRecord | undefined
    if (!record) throw new NotFoundError('推送记录')
    if (record.status !== 'pending') throw new ForbiddenError('该推送已处理')

    const now = new Date().toISOString()
    db.run(
      `UPDATE pushRecords SET status = ?, handledBy = ?, handledAt = ?, rejectReason = ? WHERE id = ?`,
      [action, userId, now, rejectReason ?? null, recordId],
    )

    console.log(`📋 [PUSH] ${action === 'accepted' ? '✅ 接受' : '❌ 拒绝'} push ${recordId} by ${userId}${rejectReason ? ` (理由: ${rejectReason})` : ''}`)

    // 接受后创建 issueListLinks 链接（而非复制 Issue）
    if (action === 'accepted') {
      const issue = db.get('SELECT * FROM issues WHERE id = ?', record.issueId) as any
      if (issue) {
        // 检查是否已有链接
        const existing = db.get(
          'SELECT id FROM issueListLinks WHERE issueId = ? AND listId = ?',
          [record.issueId, record.toListId],
        )
        if (!existing) {
          db.run(
            'INSERT INTO issueListLinks (id, issueId, listId, linkedBy) VALUES (?, ?, ?, ?)',
            [generateId(), record.issueId, record.toListId, userId],
          )
          console.log(`   🔗 已链接 Issue "${issue.title}" → 目标列表 (toListId=${record.toListId})`)
        }
      }
    }

    return db.get('SELECT * FROM pushRecords WHERE id = ?', recordId) as PushRecord
  }
}
