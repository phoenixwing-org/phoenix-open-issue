import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { validatePush } from '@phoenix-wing/open-issue-core'
import type { PushRecord, PushRequest, PushValidationResult, IssueListMember } from '@phoenix-wing/open-issue-core'
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

    const insertRecord = db.prepare(
      `INSERT INTO push_records (id, from_list_id, to_list_id, issue_id, pushed_by, note)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )

    const push = db.transaction(() => {
      for (const issueId of req.issueIds) {
        const issue = db.prepare('SELECT * FROM issues WHERE id = ? AND list_id = ?')
          .get(issueId, req.fromListId) as { id: string } | undefined
        if (!issue) continue

        const recordId = uuid()
        insertRecord.run(recordId, req.fromListId, req.toListId, issueId, userId, req.note ?? '')
        records.push({
          id: recordId,
          from_list_id: req.fromListId,
          to_list_id: req.toListId,
          issue_id: issueId,
          pushed_by: userId,
          pushed_at: new Date().toISOString(),
          note: req.note ?? '',
        })
      }
    })

    push()
    return { records, validation }
  }

  getListPushHistory(listId: string): PushRecord[] {
    const db = getDb()
    return db.prepare(
      `SELECT * FROM push_records WHERE from_list_id = ? OR to_list_id = ?
       ORDER BY pushed_at DESC`,
    ).all(listId, listId) as PushRecord[]
  }

  getMyPushHistory(userId: string): PushRecord[] {
    const db = getDb()
    return db.prepare(
      `SELECT pr.* FROM push_records pr
       JOIN issue_lists l ON l.id = pr.from_list_id OR l.id = pr.to_list_id
       LEFT JOIN issue_list_members m ON m.list_id = l.id AND m.user_id = ?
       WHERE pr.pushed_by = ? OR m.user_id IS NOT NULL
       GROUP BY pr.id
       ORDER BY pr.pushed_at DESC`,
    ).all(userId, userId) as PushRecord[]
  }
}
