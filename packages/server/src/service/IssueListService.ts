import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError } from '../utils/errors.js'
import { generateId, checkListAccess, canManageList, canAddMember, canDeleteListAsUser } from '@open-issue/core'
import { isUserSystemAdminAsync, assertSystemAdminAsync } from '../utils/admin.js'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput, MemberRole } from '@open-issue/core'

const NOT_DELETED = 'l.isDeleted = 0'

const LIST_ENRICH_SELECT = `
  (SELECT COUNT(*) FROM issueListMembers WHERE listId = l.id) as memberCount,
  (SELECT COUNT(*) FROM (
    SELECT id FROM issues WHERE listId = l.id
    UNION
    SELECT issueId FROM issueListLinks WHERE listId = l.id AND attentionLevel > 0
  )) as issueCount,
  COALESCE(u.displayName, u.username) as ownerName
`

export class IssueListService {
  /** 修正主负责人 ownerId；允许多个 owner 成员并存 */
  async syncOwnerIntegrity(listId: string): Promise<void> {
    const db = getAsyncDb()
    const list = await db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', [listId]) as IssueList | undefined
    if (!list) return

    const members = await this.getMembers(listId)
    if (!members.length) return

    const ownerMembers = members.filter(m => m.role === 'owner')
    const ownerUserExists = !!await db.get('SELECT id FROM users WHERE id = ?', [list.ownerId])
    const now = new Date().toISOString()

    let targetOwnerId = list.ownerId

    if (!list.ownerId || !ownerUserExists) {
      targetOwnerId = ownerMembers[0]?.userId ?? members[0].userId
      await db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [targetOwnerId, now, listId])
    }

    // 主负责人必须是 owner 成员（不取消其他 owner）
    const primaryMember = members.find(m => m.userId === targetOwnerId)
    if (!primaryMember) {
      await db.run(
        'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
        [generateId(), listId, targetOwnerId, 'owner'],
      )
    } else if (primaryMember.role !== 'owner') {
      await db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?', ['owner', listId, targetOwnerId])
    }
  }

  private async enrichLists(lists: IssueList[], userId?: string): Promise<IssueList[]> {
    for (const list of lists) {
      await this.syncOwnerIntegrity(list.id)
    }
    if (!lists.length) return lists
    const db = getAsyncDb()
    const ids = lists.map(l => l.id)
    const placeholders = ids.map(() => '?').join(',')
    const enriched = await db.all(`
      SELECT l.*, ${LIST_ENRICH_SELECT},
        ${userId ? `(SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole` : 'NULL as myRole'}
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id IN (${placeholders})
      ORDER BY l.updatedAt DESC
    `, userId ? [userId, ...ids] : ids) as IssueList[]
    return enriched
  }

  async getEnrichedById(id: string, userId?: string): Promise<IssueList | undefined> {
    await this.syncOwnerIntegrity(id)
    const db = getAsyncDb()
    return await db.get(`
      SELECT l.*, ${LIST_ENRICH_SELECT},
        ${userId ? `(SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole` : 'NULL as myRole'}
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id = ? AND l.isDeleted = 0
    `, userId ? [userId, id] : [id]) as IssueList | undefined
  }

  private async assignOwner(listId: string, newOwnerId: string, previousOwnerId: string): Promise<void> {
    const db = getAsyncDb()
    const user = await db.get('SELECT id FROM users WHERE id = ?', [newOwnerId]) as { id: string } | undefined
    if (!user) throw new NotFoundError('用户')

    const members = await this.getMembers(listId)
    const now = new Date().toISOString()
    const existing = members.find(m => m.userId === newOwnerId)

    await db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [newOwnerId, now, listId])

    if (!existing) {
      await db.run(
        'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
        [generateId(), listId, newOwnerId, 'owner'],
      )
    } else if (existing.role !== 'owner') {
      await db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?', ['owner', listId, newOwnerId])
    }
  }

  async getMyLists(userId: string): Promise<IssueList[]> {
    const db = getAsyncDb()
    const lists = await db.all(`
      SELECT DISTINCT l.*
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE (l.ownerId = ? OR m.userId = ?) AND l.archived = 0 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `, [userId, userId]) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  async getAllLists(userId: string): Promise<IssueList[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, userId)
    const lists = await db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.archived = 0 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  async getArchivedLists(userId: string): Promise<IssueList[]> {
    const db = getAsyncDb()
    const lists = await db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.archived = 1 AND ${NOT_DELETED}
      ORDER BY l.updatedAt DESC
    `) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  async getDeletedLists(userId: string): Promise<IssueList[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, userId)
    const lists = await db.all(`
      SELECT l.* FROM issueLists l
      WHERE l.isDeleted = 1
      ORDER BY l.deletedAt DESC, l.updatedAt DESC
    `) as IssueList[]
    return this.enrichDeletedLists(lists)
  }

  async restoreList(id: string, userId: string): Promise<IssueList> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, userId)
    const list = await db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 1', [id]) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    const now = new Date().toISOString()
    await db.run(
      'UPDATE issueLists SET isDeleted = 0, deletedAt = NULL, updatedAt = ? WHERE id = ?',
      [now, id],
    )
    await this.syncOwnerIntegrity(id)
    const enriched = await this.getEnrichedById(id, userId)
    if (!enriched) throw new NotFoundError('列表')
    return enriched
  }

  private async enrichDeletedLists(lists: IssueList[]): Promise<IssueList[]> {
    if (!lists.length) return lists
    const db = getAsyncDb()
    const ids = lists.map(l => l.id)
    const placeholders = ids.map(() => '?').join(',')
    return await db.all(`
      SELECT l.*, ${LIST_ENRICH_SELECT}, NULL as myRole
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id IN (${placeholders})
      ORDER BY l.deletedAt DESC, l.updatedAt DESC
    `, ids) as IssueList[]
  }

  async archiveList(id: string, archived: boolean, userId: string): Promise<IssueList> {
    const db = getAsyncDb()
    const list = await this.getById(id)
    if (!list) throw new NotFoundError('列表')
    await db.run('UPDATE issueLists SET archived = ?, updatedAt = ? WHERE id = ?',
      [archived ? 1 : 0, new Date().toISOString(), id])
    return await db.get('SELECT * FROM issueLists WHERE id = ?', [id]) as IssueList
  }

  async getById(id: string): Promise<IssueList | undefined> {
    const db = getAsyncDb()
    return await db.get(`SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0`, [id]) as IssueList | undefined
  }

  async create(input: CreateListInput, ownerId: string): Promise<IssueList> {
    const db = getAsyncDb()
    const listId = generateId()
    const memberId = generateId()
    const now = new Date().toISOString()

    await db.run(
      `INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [listId, input.name, input.description ?? '', input.listType, ownerId, input.orgUnitId ?? null, now, now],
    )

    // owner 自动成为成员
    await db.run(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
      [memberId, listId, ownerId, 'owner'],
    )

    return await db.get('SELECT * FROM issueLists WHERE id = ?', [listId]) as IssueList
  }

  async update(id: string, input: UpdateListInput, userId: string): Promise<IssueList> {
    const db = getAsyncDb()
    const list = await this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(id)
    const role = checkListAccess(userId, members)
    if (!canManageList(role) && !await isUserSystemAdminAsync(db, userId)) throw new ForbiddenError()

    const now = new Date().toISOString()
    await db.run(
      `UPDATE issueLists SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        listType = COALESCE(?, listType),
        updatedAt = ?
       WHERE id = ?`,
      [input.name ?? null, input.description ?? null, input.listType ?? null, now, id],
    )

    if (input.ownerId && input.ownerId !== list.ownerId) {
      if (!await isUserSystemAdminAsync(db, userId) && role !== 'owner' && role !== 'admin') {
        throw new ForbiddenError('只有管理员或列表所有者可以变更负责人')
      }
      await this.assignOwner(id, input.ownerId, list.ownerId)
    }

    const enriched = await this.getEnrichedById(id, userId)
    if (!enriched) throw new NotFoundError('列表')
    return enriched
  }

  async delete(id: string, userId: string): Promise<void> {
    const db = getAsyncDb()
    const list = await db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', [id]) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(id)
    const role = checkListAccess(userId, members)
    const user = await db.get('SELECT systemRole, username FROM users WHERE id = ?', [userId]) as { systemRole?: string; username?: string }
    if (!canDeleteListAsUser(role, user, list.ownerId, userId)) {
      throw new ForbiddenError('只有系统管理员或列表所有者可以删除')
    }

    const now = new Date().toISOString()
    await db.run(
      'UPDATE issueLists SET isDeleted = 1, deletedAt = ?, updatedAt = ? WHERE id = ?',
      [now, now, id],
    )
  }

  async getMembers(listId: string): Promise<IssueListMember[]> {
    const db = getAsyncDb()
    return await db.all('SELECT * FROM issueListMembers WHERE listId = ?', [listId]) as IssueListMember[]
  }

  async getMembersWithUser(listId: string): Promise<MemberWithUser[]> {
    const db = getAsyncDb()
    return await db.all(`
      SELECT m.*, u.username, u.displayName
      FROM issueListMembers m
      JOIN users u ON u.id = m.userId
      WHERE m.listId = ?
      ORDER BY m.joinedAt
    `, [listId]) as MemberWithUser[]
  }

  async addMember(listId: string, userId: string, role: string, actorId: string): Promise<IssueListMember> {
    const db = getAsyncDb()
    const members = await this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)
    if (!sysAdmin && !canAddMember(actorRole)) throw new ForbiddenError('只有所有者或管理员可以添加成员')

    if (role === 'owner' && !sysAdmin && actorRole !== 'owner' && actorRole !== 'admin') {
      throw new ForbiddenError('只有所有者或管理员可以添加所有者')
    }

    const existing = members.find(m => m.userId === userId)
    if (existing) return existing

    const id = generateId()
    await db.run(
      'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
      [id, listId, userId, role],
    )
    return await db.get('SELECT * FROM issueListMembers WHERE id = ?', [id]) as IssueListMember
  }

  async removeMember(listId: string, targetUserId: string, actorId: string): Promise<void> {
    const db = getAsyncDb()
    const list = await this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)
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

    await db.run('DELETE FROM issueListMembers WHERE listId = ? AND userId = ?', [listId, targetUserId])
  }

  /** 更换主负责人；目标必须是成员；不改动原主负责人的成员权限级别 */
  async transferOwner(listId: string, newOwnerId: string, actorId: string): Promise<IssueList> {
    const db = getAsyncDb()
    const list = await this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)
    if (!sysAdmin && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以转让主负责人')
    }

    const newOwner = members.find(m => m.userId === newOwnerId)
    if (!newOwner) throw new NotFoundError('目标用户不是列表成员，请先添加为成员')

    const now = new Date().toISOString()
    await db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [newOwnerId, now, listId])

    if (newOwner.role !== 'owner') {
      await db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
        ['owner', listId, newOwnerId])
    }

    console.log(`🔁 [TRANSFER] list "${list.name}" primary owner → "${newOwnerId}"`)
    return await db.get('SELECT * FROM issueLists WHERE id = ?', [listId]) as IssueList
  }

  async updateMemberRole(listId: string, targetUserId: string, newRole: MemberRole, actorId: string): Promise<IssueListMember> {
    const db = getAsyncDb()
    const list = await this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(listId)
    const actorRole = checkListAccess(actorId, members)
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)
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

    await db.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
      [newRole, listId, targetUserId])

    if (list.ownerId === targetUserId && newRole !== 'owner') {
      const otherOwner = members.find(m => m.role === 'owner' && m.userId !== targetUserId)
      if (otherOwner) {
        await db.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?',
          [otherOwner.userId, new Date().toISOString(), listId])
      }
    }

    return await db.get('SELECT * FROM issueListMembers WHERE listId = ? AND userId = ?',
      [listId, targetUserId]) as IssueListMember
  }
}
