import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, BadRequestError } from '../utils/errors.js'
import { generateId, DEFAULT_ATTENTION_LEVEL, normalizeAttentionLevel, canPerformListAction } from '@open-issue/core'
import type { Issue, CreateIssueInput, UpdateIssueInput, ReorderInput, IssueStatus } from '@open-issue/core'
import { assertIssueReadableAsync, assertListActionAsync, getActiveUserAsync, getListRoleAsync } from '../utils/access.js'

export class IssueService {
  async getIssues(listId: string, userId: string, opts: {
    status?: string
    priority?: string
    search?: string
    sort?: string
    page?: number
    size?: number
  } = {}): Promise<{ items: Issue[]; total: number }> {
    const db = getAsyncDb()

    const currentRole = await assertListActionAsync(db, listId, userId, 'read', '无权访问此列表')
    const user = await getActiveUserAsync(db, userId)

    const { status, priority, search, sort, page = 1, size = 50 } = opts
    const params: unknown[] = [listId]
    const conditions: string[] = []

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
    const fromJoin = `FROM issues i JOIN issueListLinks il ON i.id = il.issueId AND il.listId = ? LEFT JOIN issueLists origin ON i.listId = origin.id LEFT JOIN poiFunctions f ON i.functionId = f.id`
    const total = await db.get(`SELECT COUNT(*) as count FROM issues i JOIN issueListLinks il ON i.id = il.issueId AND il.listId = ?${where}`, [listId, ...params.slice(1)]) as { count: number }

    // 排序：默认关注度 → 优先级；sort 支持 "field:dir" 或 "field:dir,field2:dir2"
    const SEVERITY_ORDER = "CASE i.severity WHEN 'fatal' THEN 1 WHEN 'major' THEN 2 WHEN 'minor' THEN 3 WHEN 'trivial' THEN 4 ELSE 5 END"
    const PRIORITY_ORDER = "CASE i.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END"
    const STATUS_ORDER = "CASE i.status WHEN 'open' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'resolved' THEN 3 WHEN 'closed' THEN 4 WHEN 'cancelled' THEN 5 ELSE 6 END"

    const defaultOrder = `il.attentionLevel DESC, ${PRIORITY_ORDER} ASC, i.createdAt DESC`

    function orderClause(field: string, dir: 'ASC' | 'DESC'): string | null {
      switch (field) {
        case 'attention': return `il.attentionLevel ${dir}`
        case 'createdAt': return `i.createdAt ${dir}`
        case 'severity': return `${SEVERITY_ORDER} ${dir}`
        case 'priority': return `${PRIORITY_ORDER} ${dir}`
        case 'status': return `${STATUS_ORDER} ${dir}`
        case 'title': return `i.title ${dir}`
        case 'issueNo': return `i.issueNo ${dir}`
        case 'dueDate': return `COALESCE(i.dueDate,'9999') ${dir}`
        case 'sortOrder': return `i.sortOrder ASC`
        default: return null
      }
    }

    let orderBy = defaultOrder
    if (sort) {
      const segments = sort.split(',').map(s => s.trim()).filter(Boolean)
      const parts: string[] = []
      for (const seg of segments) {
        const [field, dirRaw] = seg.split(':')
        const dir = (dirRaw || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC'
        const clause = orderClause(field, dir)
        if (clause) parts.push(clause)
      }
      if (parts.length) {
        parts.push('i.createdAt DESC')
        orderBy = parts.join(', ')
      }
    }

    const offset = (page - 1) * size
    const allParams = [...params, size, offset]
    const items = await db.all(
      `SELECT i.*,
        (SELECT role FROM issueListMembers WHERE listId = i.listId AND userId = ?) as "_originRole",
        il.attentionLevel as _attentionLevel,
        origin.name AS "originListName",
        f.functionName as _functionName, f.platform as _functionPlatform, f.externalId as _functionExternalId ${fromJoin}${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [userId, ...allParams],
    ) as (Issue & { _attentionLevel: number; _originRole: import('@open-issue/core').MemberRole | null })[]

    return {
      items: items.map(item => Object.assign(item, {
        _canModify: canPerformListAction(user, item._originRole, 'modify-issue'),
        _canSetAttention: canPerformListAction(user, currentRole, 'modify-issue'),
        _canPush: item.listId === listId && canPerformListAction(user, currentRole, 'push'),
      })),
      total: total.count,
    }
  }

  private async getRawById(id: string): Promise<Issue | undefined> {
    const db = getAsyncDb()
    return await db.get(
      `SELECT i.*, origin.name AS "originListName", f.functionName as _functionName, f.platform as _functionPlatform, f.externalId as _functionExternalId
       FROM issues i
       LEFT JOIN issueLists origin ON i.listId = origin.id
       LEFT JOIN poiFunctions f ON i.functionId = f.id
       WHERE i.id = ?`,
      [id],
    ) as (Issue & { _functionName: string | null }) | undefined
  }

  async getById(id: string, userId: string): Promise<Issue | undefined> {
    const issue = await this.getRawById(id)
    if (!issue) return undefined
    const db = getAsyncDb()
    await assertIssueReadableAsync(db, id, userId)
    const [user, role] = await Promise.all([
      getActiveUserAsync(db, userId),
      getListRoleAsync(db, issue.listId, userId),
    ])
    return Object.assign(issue, {
      _canModify: canPerformListAction(user, role, 'modify-issue'),
      _canPush: canPerformListAction(user, role, 'push'),
    })
  }

  async create(listId: string, input: CreateIssueInput, userId: string): Promise<Issue> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'create-issue')

    const id = generateId()
    const now = new Date().toISOString()

    const year = input.issueNo
      ? parseInt(input.issueNo.split('-')[1], 10) || new Date().getFullYear()
      : new Date().getFullYear()

    // Issue 与主列表链接必须同时成功；自动编号遇到并发冲突时重试。
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await db.transaction(async tx => {
          const maxSort = await tx.get<{ m: number | null }>('SELECT MAX(sortOrder) as m FROM issues WHERE listId = ?', [listId])
          const sortOrder = (maxSort?.m ?? 0) + 1
          let issueNo = input.issueNo
          if (!issueNo) {
            const maxRow = await tx.get<{ issueNo: string }>(
              'SELECT issueNo FROM issues WHERE issueNo LIKE ? ORDER BY issueNo DESC LIMIT 1',
              [`ISS-${year}-%`],
            )
            const num = maxRow ? (parseInt(maxRow.issueNo.split('-')[2], 10) || 0) + 1 : 1
            issueNo = `ISS-${year}-${String(num).padStart(4, '0')}`
          }

          await tx.run(
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
          await tx.run(
            'INSERT INTO issueListLinks (id, issueId, listId, linkedBy, attentionLevel) VALUES (?, ?, ?, ?, ?)',
            [generateId(), id, listId, userId, DEFAULT_ATTENTION_LEVEL],
          )
        })
        return await this.getRawById(id) as Issue
      } catch (error) {
        const concurrentNumberConflict = !input.issueNo && /unique|duplicate/i.test(String(error))
        if (!concurrentNumberConflict || attempt === 2) throw error
      }
    }
    throw new Error('Issue 创建失败')
  }

  async update(id: string, input: UpdateIssueInput, userId: string): Promise<Issue> {
    const db = getAsyncDb()
    const issue = await this.getRawById(id)
    if (!issue) throw new NotFoundError('Issue')
    await assertListActionAsync(db, issue.listId, userId, 'modify-issue')

    await db.run(
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

    return await this.getRawById(id) as Issue
  }

  async updateStatus(id: string, status: IssueStatus, userId: string): Promise<Issue> {
    const db = getAsyncDb()
    const issue = await this.getRawById(id)
    if (!issue) throw new NotFoundError('Issue')
    await assertListActionAsync(db, issue.listId, userId, 'modify-issue')

    // 如果转为 resolved/closed，自动记录完成时间
    const now = new Date().toISOString()
    if (status === 'resolved' || status === 'closed') {
      await db.run('UPDATE issues SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?',
        [status, now, now, id])
    } else {
      await db.run('UPDATE issues SET status = ?, updatedAt = ? WHERE id = ?',
        [status, now, id])
    }

    return await this.getRawById(id) as Issue
  }

  async delete(id: string, userId: string): Promise<void> {
    const db = getAsyncDb()
    const issue = await this.getRawById(id)
    if (!issue) throw new NotFoundError('Issue')
    await assertListActionAsync(db, issue.listId, userId, 'modify-issue')

    const now = new Date().toISOString()
    await db.run(
      `UPDATE issues SET status = 'cancelled', closeReason = 'cancelled', updatedAt = ? WHERE id = ?`,
      [now, id],
    )
  }

  // ── 链接关注系数 ──
  async setAttentionLevel(issueId: string, listId: string, level: number, userId: string): Promise<void> {
    const db = getAsyncDb()
    const link = await db.get('SELECT * FROM issueListLinks WHERE issueId = ? AND listId = ?',
      [issueId, listId]) as Record<string, unknown> | undefined
    if (!link) throw new NotFoundError('链接记录')
    await assertListActionAsync(db, listId, userId, 'modify-issue', '无权调整此列表中的关注度')

    const attentionLevel = normalizeAttentionLevel(level)
    const now = new Date().toISOString()
    await db.run(
      `UPDATE issueListLinks SET
        attentionLevel = ?,
        attentionUpdatedAt = ?,
        attentionUpdatedBy = ?
       WHERE issueId = ? AND listId = ?`,
      [attentionLevel, now, userId, issueId, listId],
    )
  }

  async reorder(listId: string, input: ReorderInput, userId: string): Promise<void> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, userId, 'modify-issue')

    const now = new Date().toISOString()
    await db.transaction(async tx => {
      for (const [index, issueId] of input.issueIds.entries()) {
        const result = await tx.run(
          `UPDATE issues SET sortOrder = ?, updatedAt = ?
           WHERE id = ? AND EXISTS (
             SELECT 1 FROM issueListLinks WHERE issueId = issues.id AND listId = ?
           )`,
          [index, now, issueId, listId],
        )
        if (result.changes !== 1) throw new BadRequestError('排序数据包含不属于当前列表的 Issue')
      }
    })
  }
}
