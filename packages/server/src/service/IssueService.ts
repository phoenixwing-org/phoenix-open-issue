import { getDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canModifyIssue, DEFAULT_ATTENTION_LEVEL, normalizeAttentionLevel } from '@open-issue/core'
import type { Issue, CreateIssueInput, UpdateIssueInput, ReorderInput, IssueStatus } from '@open-issue/core'
import { IssueListService } from './IssueListService.js'

const listService = new IssueListService()

export class IssueService {
  getIssues(listId: string, userId: string, opts: {
    status?: string
    priority?: string
    search?: string
    sort?: string
    page?: number
    size?: number
    includeVoided?: boolean
  } = {}): { items: Issue[]; total: number } {
    const db = getDb()

    // 权限检查
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!role) throw new ForbiddenError('无权访问此列表')

    const { status, priority, search, sort, page = 1, size = 50, includeVoided } = opts
    // JOIN issueListLinks 获取 _attentionLevel + 统一过滤
    const params: unknown[] = [listId]
    const conditions: string[] = []

    // 默认排除不关注（attentionLevel=0，兼容旧 voided=1）
    if (!includeVoided) {
      conditions.push(`(
        COALESCE(il.attentionLevel, CASE WHEN il.voided = 1 THEN 0 ELSE ${DEFAULT_ATTENTION_LEVEL} END) > 0
      )`)
    }

    if (status) {
      conditions.push('i.status = ?')
      params.push(status)
    }
    if (priority) {
      conditions.push('i.priority = ?')
      params.push(priority)
    }
    if (search) {
      conditions.push('(i.title LIKE ? OR i.description LIKE ?)')
      params.push(`%${search}%`, `%${search}%`)
    }

    const where = conditions.length > 0 ? ' AND ' + conditions.join(' AND ') : ''
    const fromJoin = `FROM issues i JOIN issueListLinks il ON i.id = il.issueId AND il.listId = ? LEFT JOIN poiFunctions f ON i.functionId = f.id`
    const total = db.get(`SELECT COUNT(*) as count FROM issues i JOIN issueListLinks il ON i.id = il.issueId AND il.listId = ?${where}`, [listId, ...params.slice(1)]) as { count: number }

    // 排序：默认 createdAt DESC，可通过 sort 参数切换字段和方向
    const SEVERITY_ORDER = "CASE i.severity WHEN 'fatal' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 WHEN 'trivial' THEN 4 ELSE 5 END"
    const PRIORITY_ORDER = "CASE i.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END"
    const STATUS_ORDER = "CASE i.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 WHEN 'closed' THEN 4 WHEN 'cancelled' THEN 5 ELSE 6 END"

    let orderBy = 'i.createdAt DESC, i.sortOrder ASC'
    if (sort) {
      const parts = sort.split(':')
      const field = parts[0]
      const dir = parts[1] || 'desc'
      const d = dir === 'asc' ? 'ASC' : 'DESC'
      switch (field) {
        case 'createdAt':  orderBy = `i.createdAt ${d}, i.sortOrder ASC`; break
        case 'severity':   orderBy = `${SEVERITY_ORDER} ${d}, i.createdAt DESC`; break
        case 'priority':   orderBy = `${PRIORITY_ORDER} ${d}, i.createdAt DESC`; break
        case 'status':     orderBy = `${STATUS_ORDER} ${d}, i.createdAt DESC`; break
        case 'title':      orderBy = `i.title ${d}, i.createdAt DESC`; break
        case 'issueNo':    orderBy = `i.issueNo ${d}, i.createdAt DESC`; break
        case 'dueDate':    orderBy = `COALESCE(i.dueDate,'9999') ${d}, i.createdAt DESC`; break
        case 'sortOrder':  orderBy = `i.sortOrder ASC, i.createdAt DESC`; break
      }
    }

    const offset = (page - 1) * size
    const allParams = [...params, size, offset]
    const items = db.all(
      `SELECT i.*,
        COALESCE(il.attentionLevel, CASE WHEN il.voided = 1 THEN 0 ELSE ${DEFAULT_ATTENTION_LEVEL} END) as _attentionLevel,
        f.functionName as _functionName, f.platform as _functionPlatform, f.externalId as _functionExternalId ${fromJoin}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      allParams,
    ) as (Issue & { _attentionLevel: number })[]

    return { items, total: total.count }
  }

  getById(id: string): Issue | undefined {
    const db = getDb()
    return db.get(
      `SELECT i.*, f.functionName as _functionName, f.platform as _functionPlatform, f.externalId as _functionExternalId
       FROM issues i
       LEFT JOIN poiFunctions f ON i.functionId = f.id
       WHERE i.id = ?`,
      id,
    ) as (Issue & { _functionName: string | null }) | undefined
  }

  create(listId: string, input: CreateIssueInput, userId: string): Issue {
    const db = getDb()
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const id = generateId()
    const now = new Date().toISOString()

    // 计算下一个 sortOrder
    const maxSort = db.get('SELECT MAX(sortOrder) as m FROM issues WHERE listId = ?', listId) as { m: number | null }
    const sortOrder = (maxSort?.m ?? 0) + 1

    // 生成可读编号：ISS-2026-0001（全局自增，不按列表区分）
    const year = input.issueNo
      ? parseInt(input.issueNo.split('-')[1], 10) || new Date().getFullYear()
      : new Date().getFullYear()
    const issueNo = input.issueNo || (() => {
      const maxRow = db.get(
        "SELECT issueNo FROM issues WHERE issueNo LIKE ? ORDER BY issueNo DESC LIMIT 1",
        [`ISS-${year}-%`],
      ) as { issueNo: string } | undefined
      const num = maxRow ? (parseInt(maxRow.issueNo.split('-')[2], 10) || 0) + 1 : 1
      return `ISS-${year}-${String(num).padStart(4, '0')}`
    })()

    db.run(
      `INSERT INTO issues (id, listId, issueNo, title, description, status, priority, severity, category, detectionPhase,
        reporterId, assigneeId, dueDate, containment, rootCause, correctiveAction,
        functionId, sortOrder, createdBy, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, listId, issueNo, input.title, input.description ?? '',
        'open', input.priority ?? 'medium', input.severity ?? 'minor',
        input.category ?? null, input.detectionPhase ?? null,
        input.reporterId ?? null, input.assigneeId ?? null, input.dueDate ?? null,
        input.containment ?? '', input.rootCause ?? '', input.correctiveAction ?? '',
        input.functionId ?? null, sortOrder, userId, now, now,
      ],
    )

    // 创建 issueListLinks 链接记录（主列表）
    db.run(
      'INSERT INTO issueListLinks (id, issueId, listId, linkedBy, attentionLevel) VALUES (?, ?, ?, ?, ?)',
      [generateId(), id, listId, userId, DEFAULT_ATTENTION_LEVEL],
    )

    return this.getById(id)!
  }

  update(id: string, input: UpdateIssueInput, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.run(
      `UPDATE issues
       SET title = COALESCE(?, title),
           description = COALESCE(?, description),
           issueNo = COALESCE(?, issueNo),
           status = COALESCE(?, status),
           priority = COALESCE(?, priority),
           severity = COALESCE(?, severity),
           category = COALESCE(?, category),
           detectionPhase = COALESCE(?, detectionPhase),
           reporterId = COALESCE(?, reporterId),
           assigneeId = COALESCE(?, assigneeId),
           dueDate = COALESCE(?, dueDate),
           closeReason = COALESCE(?, closeReason),
           closedBy = COALESCE(?, closedBy),
           completedAt = COALESCE(?, completedAt),
           containment = COALESCE(?, containment),
           rootCause = COALESCE(?, rootCause),
           correctiveAction = COALESCE(?, correctiveAction),
           functionId = COALESCE(?, functionId),
           updatedAt = ?
       WHERE id = ?`,
      [
        input.title ?? null,
        input.description ?? null,
        input.issueNo ?? null,
        input.status ?? null,
        input.priority ?? null,
        input.severity ?? null,
        input.category ?? null,
        input.detectionPhase ?? null,
        input.reporterId ?? null,
        input.assigneeId ?? null,
        input.dueDate ?? null,
        input.closeReason ?? null,
        input.closedBy ?? null,
        input.completedAt ?? null,
        input.containment ?? null,
        input.rootCause ?? null,
        input.correctiveAction ?? null,
        input.functionId ?? null,
        new Date().toISOString(), id,
      ],
    )

    return this.getById(id)!
  }

  updateStatus(id: string, status: IssueStatus, userId: string): Issue {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    // 如果转为 resolved/closed，自动记录完成时间
    const now = new Date().toISOString()
    if (status === 'resolved' || status === 'closed') {
      db.run('UPDATE issues SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
        [status, now, now, id])
    } else {
      db.run('UPDATE issues SET status = ?, updatedAt = ? WHERE id = ?',
        [status, now, id])
    }

    return this.getById(id)!
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const issue = this.getById(id)
    if (!issue) throw new NotFoundError('Issue')
    const members = listService.getMembers(issue.listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    db.run('DELETE FROM checkpoints WHERE issueId = ?', id)
    db.run('DELETE FROM issueListLinks WHERE issueId = ?', id)
    db.run('DELETE FROM pushRecords WHERE issueId = ?', id)
    db.run('DELETE FROM issues WHERE id = ?', id)
  }

  // ── 链接关注系数 ──
  setAttentionLevel(issueId: string, listId: string, level: number, userId: string): void {
    const db = getDb()
    const link = db.get('SELECT * FROM issueListLinks WHERE issueId = ? AND listId = ?',
      [issueId, listId]) as Record<string, unknown> | undefined
    if (!link) throw new NotFoundError('链接记录')

    const attentionLevel = normalizeAttentionLevel(level)
    const now = new Date().toISOString()
    db.run(
      `UPDATE issueListLinks SET
        attentionLevel = ?,
        attentionUpdatedAt = ?,
        attentionUpdatedBy = ?
       WHERE issueId = ? AND listId = ?`,
      [attentionLevel, now, userId, issueId, listId],
    )
  }

  /** @deprecated 兼容：设为不关注(0) */
  voidLink(issueId: string, listId: string, userId: string): void {
    this.setAttentionLevel(issueId, listId, 0, userId)
  }

  /** @deprecated 兼容：恢复默认三星关注 */
  unvoidLink(issueId: string, listId: string, userId: string): void {
    this.setAttentionLevel(issueId, listId, DEFAULT_ATTENTION_LEVEL, userId)
  }

  reorder(listId: string, input: ReorderInput, userId: string): void {
    const db = getDb()
    const members = listService.getMembers(listId)
    const role = checkListAccess(userId, members)
    if (!canModifyIssue(role)) throw new ForbiddenError()

    const now = new Date().toISOString()
    db.exec('BEGIN TRANSACTION')
    try {
      input.issueIds.forEach((issueId, index) => {
        db.run('UPDATE issues SET sortOrder = ?, updatedAt = ? WHERE id = ?', [index, now, issueId])
      })
      db.exec('COMMIT')
    } catch (err) {
      if (db.inTransaction) db.exec('ROLLBACK')
      throw err
    }
  }
}
