import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { validatePush } from '@phoenix-wing/open-issue-core'
import type { PushRecord, PushRequest, PushValidationResult } from '@phoenix-wing/open-issue-core'
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

        const recordId = uuid()
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

    // 接受后复制 Issue 到目标列表
    if (action === 'accepted') {
      const issue = db.get('SELECT * FROM issues WHERE id = ?', record.issueId) as any
      if (issue && issue.listId !== record.toListId) {
        const newId = uuid()
        const maxSort = db.get('SELECT MAX(sortOrder) as m FROM issues WHERE listId = ?', record.toListId) as { m: number | null }
        const sortOrder = (maxSort?.m ?? 0) + 1

        // 生成目标列表的编号
        const year = new Date().getFullYear()
        const count = db.get(
          "SELECT COUNT(*) as c FROM issues WHERE listId = ? AND issueNo LIKE ?",
          [record.toListId, `ISS-${year}-%`],
        ) as { c: number }
        const issueNo = `ISS-${year}-${String((count?.c ?? 0) + 1).padStart(4, '0')}`

        db.run(
          `INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase,
            reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction,
            sortOrder, createdBy, createdAt, updatedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId, record.toListId, issueNo, issue.title, issue.description,
            issue.status, issue.priority, issue.severity, issue.category, issue.detectionPhase,
            issue.reporterId, issue.assigneeId, issue.dueDate,
            issue.containment, issue.rootCause, issue.correctiveAction,
            sortOrder, issue.createdBy, now, now,
          ],
        )

        console.log(`   📋 已复制 Issue "${issue.title}" → 目标列表 (newId=${newId}, issueNo=${issueNo})`)

        // 复制点检
        const checkpoints = db.all('SELECT * FROM checkpoints WHERE issueId = ?', issue.id) as any[]
        for (const cp of checkpoints) {
          db.run(
            `INSERT INTO checkpoints (id, issueId, checkpointDate, description, status, responsibleUserId, sortOrder, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [uuid(), newId, cp.checkpointDate, cp.description, cp.status, cp.responsibleUserId, cp.sortOrder, now, now],
          )
        }
        console.log(`   📅 已复制 ${checkpoints.length} 条点检`)
      }
    }

    return db.get('SELECT * FROM pushRecords WHERE id = ?', recordId) as PushRecord
  }
}
