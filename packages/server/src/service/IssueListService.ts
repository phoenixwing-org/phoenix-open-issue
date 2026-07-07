import { getDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canManageList, canDeleteListAsUser } from '@open-issue/core'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput, MemberRole } from '@open-issue/core'

const NOT_DELETED = 'l.isDeleted = 0'

export class IssueListService {
  getMyLists(userId: string): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT DISTINCT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM (
          SELECT id FROM issues WHERE listId = l.id
          UNION
          SELECT issueId FROM issueListLinks WHERE listId = l.id AND voided = 0
        )) as issueCount,
        u.displayName as ownerName,
        (SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.archived = 0 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `, [userId, userId, userId]) as IssueList[]
  }

  getAllLists(userId: string): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM (
          SELECT id FROM issues WHERE listId = l.id
          UNION
          SELECT issueId FROM issueListLinks WHERE listId = l.id AND voided = 0
        )) as issueCount,
        u.displayName as ownerName,
        (SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole
      FROM issueLists l LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.archived = 0 AND ${NOT_DELETED} ORDER BY l.updatedAt DESC
    `, userId) as IssueList[]
  }

  getArchivedLists(userId: string): IssueList[] {
    const db = getDb()
    return db.all(`
      SELECT l.*,
        (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
        (SELECT COUNT(*) FROM (
          SELECT id FROM issues WHERE listId = l.id
          UNION
          SELECT issueId FROM issueListLinks WHERE listId = l.id AND voided = 0
        )) as issueCount,
        u.displayName as ownerName,
        (SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole
      FROM issueLists l LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.archived = 1 AND ${NOT_DELETED} ORDER BY l.updatedAt DESC
    `, userId) as IssueList[]
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
    return db.get(`SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0`, id) as IssueList | undefined
  }

  create(input: CreateListInput, ownerId: string): IssueList {
    const db = getDb()
    const listId = generateId()
    const memberId = generateId()
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

  delete(id: string, userId: string, username: string): void {
    const db = getDb()
    const list = db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', id) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canDeleteListAsUser(role, username, list.ownerId, userId)) {
      throw new ForbiddenError('只有系统管理员或列表所有者可以删除')
    }

    const now = new Date().toISOString()
    db.run(
      'UPDATE issueLists SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?',
      [now, now, id],
    )
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

    const id = generateId()
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

    const target = members.find(m => m.userId === targetUserId)
    if (!target) throw new NotFoundError('成员')

    if (target.role === 'owner') {
      // 允许移除 owner，但至少保留一名
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) throw new ForbiddenError('至少需要保留一名所有者')
      // 不允许移除自己（用转让功能代替）
      if (targetUserId === actorId) throw new ForbiddenError('不能移除自己，请使用转让功能')
    }

    db.run('DELETE FROM issueListMembers WHERE listId = ? AND userId = ?', [listId, targetUserId])
  }

  // ── Feature 3: Owner 转移 ──
  transferOwner(listId: string, newOwnerId: string, actorId: string): IssueList {
    const db = getDb()
    const list = this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (actorRole !== 'owner') throw new ForbiddenError('只有所有者可以转让列表')

    const newOwner = members.find(m => m.userId === newOwnerId)
    if (!newOwner) throw new NotFoundError('目标用户不是列表成员')

    const now = new Date().toISOString()

    // 更新 issueLists.ownerId
    db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?',
      [newOwnerId, now, listId])

    // actor 降级为 admin（如果转让给自己则保持不变）
    if (actorId !== newOwnerId) {
      db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
        ['admin', listId, actorId])
    }

    // newOwner 升级为 owner
    db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
      ['owner', listId, newOwnerId])

    console.log(`🔁 [TRANSFER] list "${list.name}" owner → "${newOwnerId}"`)
    return db.get('SELECT * FROM issueLists WHERE id = ?', listId) as IssueList
  }

  updateMemberRole(listId: string, targetUserId: string, newRole: MemberRole, actorId: string): IssueListMember {
    const db = getDb()
    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    if (!canManageList(actorRole)) throw new ForbiddenError()

    const target = members.find(m => m.userId === targetUserId)
    if (!target) throw new NotFoundError('成员')

    // 只有 owner 可以授予/降级 owner 角色
    if ((newRole === 'owner' || target.role === 'owner') && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以管理所有者角色')
    }

    // 降级最后一个 owner 时阻止
    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) throw new ForbiddenError('至少需要保留一名所有者')
    }

    db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
      [newRole, listId, targetUserId])
    return db.get('SELECT * FROM issueListMembers WHERE listId = ? AND userId = ?',
      [listId, targetUserId]) as IssueListMember
  }
}
