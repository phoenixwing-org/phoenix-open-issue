import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canManageList, canDeleteList } from '@phoenix-wing/open-issue-core'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput } from '@phoenix-wing/open-issue-core'

export class IssueListService {
  getMyLists(userId: string): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT DISTINCT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM issues WHERE listId = l.id) as issueCount,
        u.displayName as ownerName
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.archived = 0
      ORDER BY l.updatedAt DESC
    `, [userId, userId]) as IssueList[]
  }

  getAllLists(): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM issues WHERE listId = l.id) as issueCount,
        u.displayName as ownerName
      FROM issueLists l LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.archived = 0 ORDER BY l.updatedAt DESC
    `) as IssueList[]
  }

  getArchivedLists(): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM issues WHERE listId = l.id) as issueCount,
        u.displayName as ownerName
      FROM issueLists l LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.archived = 1 ORDER BY l.updatedAt DESC
    `) as IssueList[]
  }

  archiveList(id: string, archived: boolean, userId: string): IssueList {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')
    db.run('UPDATE issueLists SET archived = ?, updatedAt = ? WHERE id = ?',
      [archived ? 1 : 0, new Date().toISOString(), id])
    return db.get('SELECT * FROM issueLists WHERE id = ?', id) as IssueList
  }

  getById(id: string): IssueList | undefined {
    const db = getDb()
    return db.get('SELECT * FROM issueLists WHERE id = ?', id) as IssueList | undefined
  }

  create(input: CreateListInput, ownerId: string): IssueList {
    const db = getDb()
    const listId = uuid()
    const memberId = uuid()
    const now = new Date().toISOString()

    db.run(
      `INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [listId, input.name, input.description ?? '', input.listType, ownerId, input.orgUnitId ?? null, now, now],
    )

    // owner 自动成为成员
    db.run(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
      [memberId, listId, ownerId, 'owner'],
    )

    return db.get('SELECT * FROM issueLists WHERE id = ?', listId) as IssueList
  }

  update(id: string, input: UpdateListInput, userId: string): IssueList {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canManageList(role)) throw new ForbiddenError()

    db.run(
      `UPDATE issueLists SET name = COALESCE(?, name), description = COALESCE(?, description), updatedAt = ?
       WHERE id = ?`,
      [input.name ?? null, input.description ?? null, new Date().toISOString(), id],
    )

    return db.get('SELECT * FROM issueLists WHERE id = ?', id) as IssueList
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canDeleteList(role)) throw new ForbiddenError('只有列表所有者可以删除')

    // 手动级联删除
    const issues = db.all('SELECT id FROM issues WHERE listId = ?', id) as { id: string }[]
    for (const issue of issues) {
      db.run('DELETE FROM checkpoints WHERE issueId = ?', issue.id)
    }
    db.run('DELETE FROM issues WHERE listId = ?', id)
    db.run('DELETE FROM issueListMembers WHERE listId = ?', id)
    db.run('DELETE FROM issueLists WHERE id = ?', id)
  }

  getMembers(listId: string): IssueListMember[] {
    const db = getDb()
    return db.all('SELECT * FROM issueListMembers WHERE listId = ?', listId) as IssueListMember[]
  }

  getMembersWithUser(listId: string): MemberWithUser[] {
    const db = getDb()
    return db.all(`
      SELECT m.*, u.username, u.displayName
      FROM issueListMembers m
      JOIN users u ON u.id = m.userId
      WHERE m.listId = ?
      ORDER BY m.joinedAt
    `, listId) as MemberWithUser[]
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
    db.run(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
      [id, listId, userId, role],
    )
    return db.get('SELECT * FROM issueListMembers WHERE id = ?', id) as IssueListMember
  }

  removeMember(listId: string, targetUserId: string, actorId: string): void {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()
    // 不能移除 owner
    const target = members.find(m => m.userId === targetUserId)
    if (target?.role === 'owner') throw new ForbiddenError('不能移除列表所有者')

    db.run('DELETE FROM issueListMembers WHERE listId = ? AND userId = ?', [listId, targetUserId])
  }
}
