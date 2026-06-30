import { getDb } from '../db/connection.js'
import { v4 as uuid } from 'uuid'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { checkListAccess, canManageList, canDeleteList } from '@phoenix-wing/open-issue-core'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput } from '@phoenix-wing/open-issue-core'

export class IssueListService {
  getMyLists(userId: string): IssueList[] {
    const db = getDb()
    // 我创建的 + 我作为成员的
    return db.prepare(`
      SELECT DISTINCT l.* FROM issue_lists l
      LEFT JOIN issue_list_members m ON m.list_id = l.id
      WHERE l.owner_id = ? OR m.user_id = ?
      ORDER BY l.updated_at DESC
    `).all(userId, userId) as IssueList[]
  }

  getById(id: string): IssueList | undefined {
    const db = getDb()
    return db.prepare('SELECT * FROM issue_lists WHERE id = ?').get(id) as IssueList | undefined
  }

  create(input: CreateListInput, ownerId: string): IssueList {
    const db = getDb()
    const listId = uuid()
    const memberId = uuid()
    const now = new Date().toISOString()

    db.prepare(
      `INSERT INTO issue_lists (id, name, description, list_type, owner_id, org_unit_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(listId, input.name, input.description ?? '', input.list_type, ownerId, input.org_unit_id ?? null, now, now)

    // owner 自动成为成员
    db.prepare(
      'INSERT INTO issue_list_members (id, list_id, user_id, role) VALUES (?, ?, ?, ?)',
    ).run(memberId, listId, ownerId, 'owner')

    return db.prepare('SELECT * FROM issue_lists WHERE id = ?').get(listId) as IssueList
  }

  update(id: string, input: UpdateListInput, userId: string): IssueList {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canManageList(role)) throw new ForbiddenError()

    db.prepare(
      `UPDATE issue_lists SET name = COALESCE(?, name), description = COALESCE(?, description), updated_at = ?
       WHERE id = ?`,
    ).run(input.name ?? null, input.description ?? null, new Date().toISOString(), id)

    return db.prepare('SELECT * FROM issue_lists WHERE id = ?').get(id) as IssueList
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const list = this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canDeleteList(role)) throw new ForbiddenError('只有列表所有者可以删除')

    // 手动级联删除
    const issues = db.prepare('SELECT id FROM issues WHERE list_id = ?').all(id) as { id: string }[]
    for (const issue of issues) {
      db.prepare('DELETE FROM checkpoints WHERE issue_id = ?').run(issue.id)
    }
    db.prepare('DELETE FROM issues WHERE list_id = ?').run(id)
    db.prepare('DELETE FROM issue_list_members WHERE list_id = ?').run(id)
    db.prepare('DELETE FROM issue_lists WHERE id = ?').run(id)
  }

  getMembers(listId: string): IssueListMember[] {
    const db = getDb()
    return db.prepare('SELECT * FROM issue_list_members WHERE list_id = ?').all(listId) as IssueListMember[]
  }

  getMembersWithUser(listId: string): MemberWithUser[] {
    const db = getDb()
    return db.prepare(`
      SELECT m.*, u.username, u.display_name
      FROM issue_list_members m
      JOIN users u ON u.id = m.user_id
      WHERE m.list_id = ?
      ORDER BY m.joined_at
    `).all(listId) as MemberWithUser[]
  }

  addMember(listId: string, userId: string, role: string, actorId: string): IssueListMember {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()

    // 检查是否已在列表中
    const existing = members.find(m => m.user_id === userId)
    if (existing) return existing

    const id = uuid()
    db.prepare(
      'INSERT INTO issue_list_members (id, list_id, user_id, role) VALUES (?, ?, ?, ?)',
    ).run(id, listId, userId, role)
    return db.prepare('SELECT * FROM issue_list_members WHERE id = ?').get(id) as IssueListMember
  }

  removeMember(listId: string, targetUserId: string, actorId: string): void {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()
    // 不能移除 owner
    const target = members.find(m => m.user_id === targetUserId)
    if (target?.role === 'owner') throw new ForbiddenError('不能移除列表所有者')

    db.prepare('DELETE FROM issue_list_members WHERE list_id = ? AND user_id = ?').run(listId, targetUserId)
  }
}
