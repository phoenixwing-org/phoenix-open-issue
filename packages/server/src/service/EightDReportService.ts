import { generateId } from '@open-issue/core'
import type { EightDReport, EightDReportInput, EightDReportIssueOption } from '@open-issue/core'
import { getAsyncDb } from '../db/connection.js'
import { BadRequestError, ForbiddenError, NotFoundError } from '../utils/errors.js'
import {
  assertIssueReadableAsync,
  assertListActionAsync,
  assertSystemCanWriteAsync,
  getActiveUserAsync,
  getIssueOriginListIdAsync,
} from '../utils/access.js'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'

export interface EightDReportView extends EightDReport {
  issueNo?: string | null
  issueTitle?: string | null
  listName?: string | null
  creatorName?: string | null
  _canModify: boolean
}

export class EightDReportService {
  private selectView(): string {
    return `SELECT r.*, i."issueNo", i."title" AS "issueTitle", l."name" AS "listName",
                   COALESCE(NULLIF(u."displayName", ''), u."username") AS "creatorName"
              FROM "eightDReports" r
         LEFT JOIN "issues" i ON i."id" = r."relatedIssueId"
         LEFT JOIN "issueLists" l ON l."id" = i."listId"
         LEFT JOIN "users" u ON u."id" = r."createdBy"`
  }

  private async decorate(rows: Omit<EightDReportView, '_canModify'>[], userId: string): Promise<EightDReportView[]> {
    const db = getAsyncDb()
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole === 'admin') return rows.map(row => ({ ...row, _canModify: true }))
    if (actor.systemRole === 'viewer') return rows.map(row => ({ ...row, _canModify: false }))
    return Promise.all(rows.map(async row => {
      if (!row.relatedIssueId) return { ...row, _canModify: row.createdBy === userId }
      const listId = await getIssueOriginListIdAsync(db, row.relatedIssueId)
      try {
        await assertListActionAsync(db, listId, userId, 'modify-issue')
        return { ...row, _canModify: true }
      } catch {
        return { ...row, _canModify: false }
      }
    }))
  }

  async list(userId: string): Promise<EightDReportView[]> {
    const db = getAsyncDb()
    const actor = await getActiveUserAsync(db, userId)
    const where = actor.systemRole === 'admin'
      ? 'r."isDeleted" = 0'
      : `r."isDeleted" = 0 AND (
          (r."relatedIssueId" IS NULL AND r."createdBy" = ?)
          OR EXISTS (
            SELECT 1 FROM "issueListLinks" il
            JOIN "issueListMembers" m ON m."listId" = il."listId" AND m."userId" = ?
            WHERE il."issueId" = r."relatedIssueId"
          )
        )`
    const params = actor.systemRole === 'admin' ? [] : [userId, userId]
    const rows = await db.all<Omit<EightDReportView, '_canModify'>>(
      `${this.selectView()} WHERE ${where} ORDER BY r."updatedAt" DESC`,
      params,
    )
    return this.decorate(rows, userId)
  }

  async getByIssue(issueId: string, userId: string): Promise<EightDReportView[]> {
    const db = getAsyncDb()
    await assertIssueReadableAsync(db, issueId, userId)
    const rows = await db.all<Omit<EightDReportView, '_canModify'>>(
      `${this.selectView()} WHERE r."relatedIssueId" = ? AND r."isDeleted" = 0 ORDER BY r."updatedAt" DESC`,
      [issueId],
    )
    return this.decorate(rows, userId)
  }

  async getById(id: string, userId: string): Promise<EightDReportView> {
    const db = getAsyncDb()
    const row = await db.get<Omit<EightDReportView, '_canModify'>>(
      `${this.selectView()} WHERE r."id" = ? AND r."isDeleted" = 0`,
      [id],
    )
    if (!row) throw new NotFoundError('8D 报告')
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole !== 'admin') {
      if (row.relatedIssueId) await assertIssueReadableAsync(db, row.relatedIssueId, userId)
      else if (row.createdBy !== userId) throw new ForbiddenError('无权查看此独立 8D 报告')
    }
    return (await this.decorate([row], userId))[0]
  }

  async getIssueOptions(userId: string): Promise<EightDReportIssueOption[]> {
    const db = getAsyncDb()
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole === 'admin') {
      return db.all<EightDReportIssueOption>(
        `SELECT i."id", i."issueNo", i."title", l."name" AS "listName"
           FROM "issues" i JOIN "issueLists" l ON l."id" = i."listId"
          WHERE l."isDeleted" = 0 ORDER BY i."updatedAt" DESC`,
      )
    }
    return db.all<EightDReportIssueOption>(
      `SELECT DISTINCT i."id", i."issueNo", i."title", l."name" AS "listName"
         FROM "issues" i
         JOIN "issueLists" l ON l."id" = i."listId"
         JOIN "issueListLinks" il ON il."issueId" = i."id"
         JOIN "issueListMembers" m ON m."listId" = il."listId" AND m."userId" = ?
        WHERE l."isDeleted" = 0 AND m."role" IN ('owner','admin','editor')
        ORDER BY i."updatedAt" DESC`,
      [userId],
    )
  }

  private validateInput(input: EightDReportInput): void {
    if (!input?.title?.trim()) throw new BadRequestError('请填写 8D 报告标题')
    if (input.title.trim().length > 200) throw new BadRequestError('8D 报告标题不能超过 200 字')
  }

  private async assertWritable(
    db: PnwDbExecutor,
    report: Pick<EightDReport, 'createdBy' | 'relatedIssueId'>,
    userId: string,
  ): Promise<void> {
    const actor = await getActiveUserAsync(db, userId)
    if (actor.systemRole === 'viewer') throw new ForbiddenError('系统查看用户不能修改 8D 报告')
    if (actor.systemRole === 'admin') return
    if (!report.relatedIssueId) {
      if (report.createdBy !== userId) throw new ForbiddenError('只有创建人可以修改独立 8D 报告')
      return
    }
    const listId = await getIssueOriginListIdAsync(db, report.relatedIssueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue', '需要关联 Issue 的编辑权限')
  }

  private async assertRelatedIssueWritable(relatedIssueId: string | null | undefined, userId: string): Promise<void> {
    if (!relatedIssueId) return
    const db = getAsyncDb()
    const listId = await getIssueOriginListIdAsync(db, relatedIssueId)
    await assertListActionAsync(db, listId, userId, 'modify-issue', '无权关联此 Issue')
  }

  async create(input: EightDReportInput, userId: string): Promise<EightDReportView> {
    const db = getAsyncDb()
    await assertSystemCanWriteAsync(db, userId)
    this.validateInput(input)
    const relatedIssueId = input.relatedIssueId || null
    await this.assertRelatedIssueWritable(relatedIssueId, userId)
    const id = generateId()
    const now = new Date().toISOString()
    await db.run(
      `INSERT INTO "eightDReports"
         ("id", "relatedIssueId", "title", "containment", "rootCause", "correctiveAction", "createdBy", "createdAt", "updatedAt")
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, relatedIssueId, input.title.trim(), input.containment?.trim() ?? '', input.rootCause?.trim() ?? '',
       input.correctiveAction?.trim() ?? '', userId, now, now],
    )
    return this.getById(id, userId)
  }

  async update(id: string, input: EightDReportInput, userId: string): Promise<EightDReportView> {
    const db = getAsyncDb()
    const report = await db.get<EightDReport>('SELECT * FROM "eightDReports" WHERE "id" = ? AND "isDeleted" = 0', [id])
    if (!report) throw new NotFoundError('8D 报告')
    await this.assertWritable(db, report, userId)
    this.validateInput(input)
    const relatedIssueId = input.relatedIssueId || null
    if (relatedIssueId !== report.relatedIssueId) await this.assertRelatedIssueWritable(relatedIssueId, userId)
    await db.run(
      `UPDATE "eightDReports"
          SET "relatedIssueId" = ?, "title" = ?, "containment" = ?, "rootCause" = ?,
              "correctiveAction" = ?, "updatedAt" = ?
        WHERE "id" = ? AND "isDeleted" = 0`,
      [relatedIssueId, input.title.trim(), input.containment?.trim() ?? '', input.rootCause?.trim() ?? '',
       input.correctiveAction?.trim() ?? '', new Date().toISOString(), id],
    )
    return this.getById(id, userId)
  }

  async delete(id: string, userId: string): Promise<void> {
    const db = getAsyncDb()
    const report = await db.get<EightDReport>('SELECT * FROM "eightDReports" WHERE "id" = ? AND "isDeleted" = 0', [id])
    if (!report) throw new NotFoundError('8D 报告')
    await this.assertWritable(db, report, userId)
    const now = new Date().toISOString()
    const result = await db.run(
      `UPDATE "eightDReports" SET "isDeleted" = 1, "deletedAt" = ?, "updatedAt" = ?
        WHERE "id" = ? AND "isDeleted" = 0`,
      [now, now, id],
    )
    if (result.changes !== 1) throw new NotFoundError('8D 报告')
  }
}
