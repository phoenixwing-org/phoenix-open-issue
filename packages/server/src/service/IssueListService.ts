import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canManageList, canDeleteList } from '@phoenix-wing/open-issue-core'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput } from '@phoenix-wing/open-issue-core'

export class IssueListService {
  getMyLists(userId: string): IssueList[] {
    const db = getDb()
    return db.prepare(`
      SELECT DISTINCT l.* FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.archived = 0
      ORDER BY l.updatedAt DESC
    `).all(userId, userId) as IssueList[]
  }

  getAllLists(): IssueList[] {
    const db = getDb()
    return db.prepare('SELECT * FROM issueLists WHERE archived = 0 ORDER BY updatedAt DESC').all() as IssueList[]
  }

  getArchivedLists(): IssueList[] {
    const db = getDb()
    return db.prepare('SELECT * FROM issueLists WHERE archived = 1 ORDER BY updatedAt DESC').all() as IssueList[]
  }

  archiveList(id: string, archived: boolean, userId: string): IssueList {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')
    db.prepare('UPDATE issueLists SET archived = ?, updatedAt = ? WHERE id = ?')
      .run(archived ? 1 : 0, new Date().toISOString(), id)
    return db.prepare('SELECT * FROM issueLists WHERE id = ?').get(id) as IssueList
  }

  getById(id: string): IssueList | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM issueLists WHERE id = ?').get(id) as IssueList | undefined
  }

  create(input: CreateListInput, ownerId: string): IssueList {
    const db = getDb()
    const listId = uuid()
    const memberId = uuid()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(listId, input.name, input.description ?? '', input.listType, ownerId, input.orgUnitId ?? null, now, now)

    // owner 自动成为成员
    db.prepare(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
    ).run(memberId, listId, ownerId, 'owner')

    return db.prepare('SELECT * FROM issueLists WHERE id = ?').get(listId) as IssueList
  }

  update(id: string, input: UpdateListInput, userId: string): IssueList {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canManageList(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE issueLists SET name = COALESCE(?, name), description = COALESCE(?, description), updatedAt = ?
       WHERE id = ?`,
    ).run(input.name ?? null, input.description ?? null, new Date().toISOString(), id)

    return db.prepare('SELECT * FROM issueLists WHERE id = ?').get(id) as IssueList
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canDeleteList(role)) throw new ForbiddenError('只有列表所有者可以删除')

    // 手动级联删除
    const issues = db.prepare('SELECT id FROM issues WHERE listId = ?').all(id) as { id: string }[]
    for (const issue of issues) {
      db.prepare('DELETE FROM checkpoints WHERE issueId = ?').run(issue.id)
    }
    db.prepare('DELETE FROM issues WHERE listId = ?').run(id)
    db.prepare('DELETE FROM issueListMembers WHERE listId = ?').run(id)
    db.prepare('DELETE FROM issueLists WHERE id = ?').run(id)
  }

  getMembers(listId: string): IssueListMember[] {
    const db = getDb()
    return db.prepare('SELECT * FROM issueListMembers WHERE listId = ?').all(listId) as IssueListMember[]
  }

  getMembersWithUser(listId: string): MemberWithUser[] {
    const db = getDb()
    return db.prepare(`
      SELECT m.*, u.username, u.displayName
      FROM issueListMembers m
      JOIN users u ON u.id = m.userId
      WHERE m.listId = ?
      ORDER BY m.joinedAt
    `).all(listId) as MemberWithUser[]
  }

  addMember(listId: string, userId: string, role: string, actorId: string): IssueListMember {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()

    // 检查是否已在列表中
    const existing = members.find(m => m.userId === userId)
    if (existing) return existing

    const id = uuid()
    db.prepare(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
    ).run(id, listId, userId, role)
    return db.prepare('SELECT * FROM issueListMembers WHERE id = ?').get(id) as IssueListMember
  }

  removeMember(listId: string, targetUserId: string, actorId: string): void {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()
    // 不能移除 owner
    const target = members.find(m => m.userId === targetUserId)
    if (target?.role === 'owner') throw new ForbiddenError('不能移除列表所有者')

    db.prepare('DELETE FROM issueListMembers WHERE listId = ? AND userId = ?').run(listId, targetUserId)
  }
}
