import { getDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canManageList, canAddMember, canDeleteListAsUser } from '@open-issue/core'
import { isUserSystemAdmin, assertSystemAdmin } from '../utils/admin.js'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput, MemberRole } from '@open-issue/core'

const NOT_DELETED = 'l.isDeleted = 0'

const LIST_ENRICH_SELECT = `
  (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
  (SELECT COUNT(*) FROM (
    SELECT id FROM issues WHERE listId = l.id
    UNION
    SELECT issueId FROM issueListLinks WHERE listId = l.id AND COALESCE(attentionLevel, CASE WHEN voided = 1 THEN 0 ELSE 3 END) > 0
  )) as issueCount,
  COALESCE(u.displayName, u.username) as ownerName
`

export class IssueListService {
  /** 修正主负责人 ownerId；允许多个 owner 成员并存 */
  syncOwnerIntegrity(listId: string): void {
    const db = getDb()
    const list = db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', listId) as IssueList | undefined
    if (!list) return

    const members = this.getMembers(listId)
    if (!members.length) return

    const ownerMembers = members.filter(m => m.role === 'owner')
    const ownerUserExists = !!db.get('SELECT id FROM users WHERE id = ?', list.ownerId)
    const now = new Date().toISOString()

    let targetOwnerId = list.ownerId

    if (!list.ownerId || !ownerUserExists) {
      targetOwnerId = ownerMembers[0]?.userId ?? members[0].userId
      db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [targetOwnerId, now, listId])
    }

    // 主负责人必须是 owner 成员（不取消其他 owner）
    const primaryMember = members.find(m => m.userId === targetOwnerId)
    if (!primaryMember) {
      db.run(
        'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
        [generateId(), listId, targetOwnerId, 'owner'],
      )
    } else if (primaryMember.role !== 'owner') {
      db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?', ['owner', listId, targetOwnerId])
    }
  }

  private enrichLists(lists: IssueList[], userId?: string): IssueList[] {
    for (const list of lists) {
      this.syncOwnerIntegrity(list.id)
    }
    if (!lists.length) return lists
    const db = getDb()
    const ids = lists.map(l => l.id)
    const placeholders = ids.map(() => '?').join(',')
    const enriched = db.all(`
      SELECT l.*, ${LIST_ENRICH_SELECT},
        ${userId ? `(SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole` : 'NULL as myRole'}
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id IN (${placeholders})
      ORDER BY l.updatedAt DESC
    `, userId ? [userId, ...ids] : ids) as IssueList[]
    return enriched
  }

  getEnrichedById(id: string, userId?: string): IssueList | undefined {
    this.syncOwnerIntegrity(id)
    const db = getDb()
    return db.get(`
      SELECT l.*, ${LIST_ENRICH_SELECT},
        ${userId ? `(SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole` : 'NULL as myRole'}
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id = ? AND l.isDeleted = 0
    `, userId ? [userId, id] : [id]) as IssueList | undefined
  }

  private assignOwner(listId: string, newOwnerId: string, previousOwnerId: string): void {
    const db = getDb()
    const user = db.get('SELECT id FROM users WHERE id = ?', newOwnerId) as { id: string } | undefined
    if (!user) throw new NotFoundError('用户')

    const members = this.getMembers(listId)
    const now = new Date().toISOString()
    const existing = members.find(m => m.userId === newOwnerId)

    db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [newOwnerId, now, listId])

    if (!existing) {
      db.run(
        'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
        [generateId(), listId, newOwnerId, 'owner'],
      )
    } else if (existing.role !== 'owner') {
      db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?', ['owner', listId, newOwnerId])
    }
  }

  getMyLists(userId: string): IssueList[] {
    const db = getDb()
    const lists = db.all(`
      SELECT DISTINCT l.*
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.archived = 0 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `, [userId, userId]) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  getAllLists(userId: string): IssueList[] {
    assertSystemAdmin(userId)
    const db = getDb()
    const lists = db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.archived = 0 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  getArchivedLists(userId: string): IssueList[] {
    const db = getDb()
    const lists = db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.archived = 1 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  getDeletedLists(userId: string): IssueList[] {
    assertSystemAdmin(userId)
    const db = getDb()
    const lists = db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.isDeleted = 1
      ORDER BY l.deletedAt DESC, l.updatedAt DESC
    `) as IssueList[]
    return this.enrichDeletedLists(lists)
  }

  restoreList(id: string, userId: string): IssueList {
    assertSystemAdmin(userId)
    const db = getDb()
    const list = db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 1', id) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    const now = new Date().toISOString()
    db.run(
      'UPDATE issueLists SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?',
      [now, id],
    )
    this.syncOwnerIntegrity(id)
    const enriched = this.getEnrichedById(id, userId)
    if (!enriched) throw new NotFoundError('列表')
    return enriched
  }

  private enrichDeletedLists(lists: IssueList[]): IssueList[] {
    if (!lists.length) return lists
    const db = getDb()
    const ids = lists.map(l => l.id)
    const placeholders = ids.map(() => '?').join(',')
    return db.all(`
      SELECT l.*, ${LIST_ENRICH_SELECT}, NULL as myRole
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id IN (${placeholders})
      ORDER BY l.deletedAt DESC, l.updatedAt DESC
    `, ids) as IssueList[]
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
    if (!canManageList(role) && !isUserSystemAdmin(userId)) throw new ForbiddenError()

    const now = new Date().toISOString()
    db.run(
      `UPDATE issueLists SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        listType = COALESCE(?, listType),
        updatedAt = ?
       WHERE id = ?`,
      [input.name ?? null, input.description ?? null, input.listType ?? null, now, id],
    )

    if (input.ownerId && input.ownerId !== list.ownerId) {
      if (!isUserSystemAdmin(userId) && role !== 'owner' && role !== 'admin') {
        throw new ForbiddenError('只有管理员或列表所有者可以变更负责人')
      }
      this.assignOwner(id, input.ownerId, list.ownerId)
    }

    const enriched = this.getEnrichedById(id, userId)
    if (!enriched) throw new NotFoundError('列表')
    return enriched
  }

  delete(id: string, userId: string): void {
    const db = getDb()
    const list = db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', id) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(id)
    const role = checkListAccess(userId, members)
    const user = db.get('SELECT systemRole, username FROM users WHERE id = ?', userId) as { systemRole?: string; username?: string }
    if (!canDeleteListAsUser(role, user, list.ownerId, userId)) {
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
    const sysAdmin = isUserSystemAdmin(actorId)
    if (!sysAdmin && !canAddMember(actorRole)) throw new ForbiddenError('只有所有者或管理员可以添加成员')

    if (role === 'owner' && !sysAdmin && actorRole !== 'owner' && actorRole !== 'admin') {
      throw new ForbiddenError('只有所有者或管理员可以添加所有者')
    }

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
    const list = this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = isUserSystemAdmin(actorId)
    if (!sysAdmin && !canAddMember(actorRole)) throw new ForbiddenError('只有所有者或管理员可以移除成员')

    const target = members.find(m => m.userId === targetUserId)
    if (!target) throw new NotFoundError('成员')

    if (list.ownerId === targetUserId) {
      throw new ForbiddenError('主负责人不可移除，请先设其他成员为主负责人')
    }

    if (target.role === 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) throw new ForbiddenError('至少需要保留一名所有者')
    }

    db.run('DELETE FROM issueListMembers WHERE listId = ? AND userId = ?', [listId, targetUserId])
  }

  /** 更换主负责人；目标必须是成员；不改动原主负责人的成员权限级别 */
  transferOwner(listId: string, newOwnerId: string, actorId: string): IssueList {
    const db = getDb()
    const list = this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = isUserSystemAdmin(actorId)
    if (!sysAdmin && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以转让主负责人')
    }

    const newOwner = members.find(m => m.userId === newOwnerId)
    if (!newOwner) throw new NotFoundError('目标用户不是列表成员，请先添加为成员')

    const now = new Date().toISOString()
    db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [newOwnerId, now, listId])

    if (newOwner.role !== 'owner') {
      db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
        ['owner', listId, newOwnerId])
    }

    console.log(`🔁 [TRANSFER] list "${list.name}" primary owner → "${newOwnerId}"`)
    return db.get('SELECT * FROM issueLists WHERE id = ?', listId) as IssueList
  }

  updateMemberRole(listId: string, targetUserId: string, newRole: MemberRole, actorId: string): IssueListMember {
    const db = getDb()
    const list = this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = isUserSystemAdmin(actorId)
    if (!sysAdmin && !canAddMember(actorRole)) throw new ForbiddenError('只有所有者或管理员可以修改成员权限')

    const target = members.find(m => m.userId === targetUserId)
    if (!target) throw new NotFoundError('成员')

    if ((newRole === 'owner' || target.role === 'owner') && !sysAdmin && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以管理所有者角色')
    }

    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) throw new ForbiddenError('至少需要保留一名所有者')
    }

    db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
      [newRole, listId, targetUserId])

    if (list.ownerId === targetUserId && newRole !== 'owner') {
      const otherOwner = members.find(m => m.role === 'owner' && m.userId !== targetUserId)
      if (otherOwner) {
        db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?',
          [otherOwner.userId, new Date().toISOString(), listId])
      }
    }

    return db.get('SELECT * FROM issueListMembers WHERE listId = ? AND userId = ?',
      [listId, targetUserId]) as IssueListMember
  }
}
