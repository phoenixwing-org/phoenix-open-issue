import { getAsyncDb } from '../db/connection.js'
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors.js'
import { generateId } from '@open-issue/core'
import { isUserSystemAdminAsync, assertSystemAdminAsync } from '../utils/admin.js'
import { assertListActionAsync, assertSystemCanWriteAsync } from '../utils/access.js'
import type { IssueList, IssueListMember, MemberWithUser, CreateListInput, UpdateListInput, MemberRole } from '@open-issue/core'
import type { PnwDbExecutor } from '../db/pnw/pnwDbTypes.js'

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

  async getEnrichedById(id: string, userId: string): Promise<IssueList | undefined> {
    const db = getAsyncDb()
    const list = await this.getById(id)
    if (!list) return undefined
    await assertListActionAsync(db, id, userId, 'read', '无权访问此列表')
    return await db.get(`
      SELECT l.*, ${LIST_ENRICH_SELECT},
        ${userId ? `(SELECT role FROM issueListMembers WHERE listId = l.id AND userId = ?) as myRole` : 'NULL as myRole'}
      FROM issueLists l
      LEFT JOIN users u ON u.id = l.ownerId
      WHERE l.id = ? AND l.isDeleted = 0
    `, [userId, id]) as IssueList | undefined
  }

  private async assignOwner(db: PnwDbExecutor, listId: string, newOwnerId: string): Promise<void> {
    const user = await db.get('SELECT id FROM users WHERE id = ?', [newOwnerId]) as { id: string } | undefined
    if (!user) throw new NotFoundError('用户')

    const members = await db.all<IssueListMember>('SELECT * FROM issueListMembers WHERE listId = ?', [listId])
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

  async getMyLists(userId: string, includeArchived = false): Promise<IssueList[]> {
    const db = getAsyncDb()
    const lists = await db.all(`
      SELECT DISTINCT l.*
      FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE (l.ownerId = ? OR m.userId = ?)
        AND ${NOT_DELETED}
        ${includeArchived ? '' : 'AND l.archived = 0'}
      ORDER BY l.updatedAt DESC
    `, [userId, userId]) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  async getAllLists(userId: string, includeArchived = false, includeDeleted = false): Promise<IssueList[]> {
    const db = getAsyncDb()
    await assertSystemAdminAsync(db, userId)
    const lists = await db.all(`
      SELECT l.* FROM issueLists l
      WHERE 1 = 1
        ${includeDeleted ? '' : `AND ${NOT_DELETED}`}
        ${includeArchived ? '' : 'AND l.archived = 0'}
      ORDER BY l.updatedAt DESC
    `) as IssueList[]
    return this.enrichLists(lists, userId)
  }

  async getArchivedLists(userId: string): Promise<IssueList[]> {
    const db = getAsyncDb()
    const systemAdmin = await isUserSystemAdminAsync(db, userId)
    const lists = await db.all(`
      SELECT DISTINCT l.* FROM issueLists l
      LEFT JOIN issueListMembers m ON m.listId = l.id
      WHERE l.archived = 1 AND ${NOT_DELETED}
        AND (? = 1 OR l.ownerId = ? OR m.userId = ?)
      ORDER BY l.updatedAt DESC
    `, [systemAdmin ? 1 : 0, userId, userId]) as IssueList[]
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
    await assertListActionAsync(db, id, userId, 'manage-list', '无权归档或恢复此列表')
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
    await assertSystemCanWriteAsync(db, ownerId)
    const listId = generateId()
    const memberId = generateId()
    const now = new Date().toISOString()

    await db.transaction(async tx => {
      await tx.run(
        `INSERT INTO issueLists (id, name, description, listType, ownerId, orgUnitId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [listId, input.name, input.description ?? '', input.listType, ownerId, input.orgUnitId ?? null, now, now],
      )

      // owner 自动成为成员，与列表创建保持原子性
      await tx.run(
        'INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)',
        [memberId, listId, ownerId, 'owner'],
      )
    })

    return await db.get('SELECT * FROM issueLists WHERE id = ?', [listId]) as IssueList
  }

  async update(id: string, input: UpdateListInput, userId: string): Promise<IssueList> {
    const db = getAsyncDb()
    const list = await this.getById(id)
    if (!list) throw new NotFoundError('列表')

    const role = await assertListActionAsync(db, id, userId, 'manage-list')
    const ownerWillChange = Boolean(input.ownerId && input.ownerId !== list.ownerId)
    if (ownerWillChange && !await isUserSystemAdminAsync(db, userId) && role !== 'owner' && role !== 'admin') {
      throw new ForbiddenError('只有管理员或列表所有者可以变更负责人')
    }

    const now = new Date().toISOString()
    await db.transaction(async tx => {
      await tx.run(
        `UPDATE issueLists SET
          name = COALESCE(?, name),
          description = COALESCE(?, description),
          listType = COALESCE(?, listType),
          updatedAt = ?
         WHERE id = ?`,
        [input.name ?? null, input.description ?? null, input.listType ?? null, now, id],
      )

      if (ownerWillChange) {
        await this.assignOwner(tx, id, input.ownerId!)
      }
    })

    const enriched = await this.getEnrichedById(id, userId)
    if (!enriched) throw new NotFoundError('列表')
    return enriched
  }

  async delete(id: string, userId: string): Promise<void> {
    const db = getAsyncDb()
    const list = await db.get('SELECT * FROM issueLists WHERE id = ? AND isDeleted = 0', [id]) as IssueList | undefined
    if (!list) throw new NotFoundError('列表')

    await assertListActionAsync(db, id, userId, 'delete-list', '只有系统管理员或列表所有者可以删除')

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

  async getMembersWithUser(listId: string, actorId: string): Promise<MemberWithUser[]> {
    const db = getAsyncDb()
    await assertListActionAsync(db, listId, actorId, 'read', '无权查看此列表成员')
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
    if (!['owner', 'admin', 'editor', 'reporter', 'viewer'].includes(role)) {
      throw new BadRequestError('无效的列表成员角色')
    }
    const members = await this.getMembers(listId)
    const actorRole = await assertListActionAsync(db, listId, actorId, 'manage-members', '只有所有者或管理员可以添加成员')
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)

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
    const actorRole = await assertListActionAsync(db, listId, actorId, 'manage-members', '只有所有者或管理员可以移除成员')
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)

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
    const actorRole = await assertListActionAsync(db, listId, actorId, 'manage-members', '只有所有者可以转让主负责人')
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)
    if (!sysAdmin && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以转让主负责人')
    }

    const newOwner = members.find(m => m.userId === newOwnerId)
    if (!newOwner) throw new NotFoundError('目标用户不是列表成员，请先添加为成员')

    const now = new Date().toISOString()
    await db.transaction(async tx => {
      await tx.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?', [newOwnerId, now, listId])
      if (newOwner.role !== 'owner') {
        await tx.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
          ['owner', listId, newOwnerId])
      }
    })

    console.log(`🔁 [TRANSFER] list "${list.name}" primary owner → "${newOwnerId}"`)
    return await db.get('SELECT * FROM issueLists WHERE id = ?', [listId]) as IssueList
  }

  async updateMemberRole(listId: string, targetUserId: string, newRole: MemberRole, actorId: string): Promise<IssueListMember> {
    const db = getAsyncDb()
    if (!['owner', 'admin', 'editor', 'reporter', 'viewer'].includes(newRole)) {
      throw new BadRequestError('无效的列表成员角色')
    }
    const list = await this.getById(listId)
    if (!list) throw new NotFoundError('列表')

    const members = await this.getMembers(listId)
    const actorRole = await assertListActionAsync(db, listId, actorId, 'manage-members', '只有所有者或管理员可以修改成员权限')
    const sysAdmin = await isUserSystemAdminAsync(db, actorId)

    const target = members.find(m => m.userId === targetUserId)
    if (!target) throw new NotFoundError('成员')

    if ((newRole === 'owner' || target.role === 'owner') && !sysAdmin && actorRole !== 'owner') {
      throw new ForbiddenError('只有所有者可以管理所有者角色')
    }

    if (target.role === 'owner' && newRole !== 'owner') {
      const ownerCount = members.filter(m => m.role === 'owner').length
      if (ownerCount <= 1) throw new ForbiddenError('至少需要保留一名所有者')
    }

    const otherOwner = list.ownerId === targetUserId && newRole !== 'owner'
      ? members.find(m => m.role === 'owner' && m.userId !== targetUserId)
      : undefined
    await db.transaction(async tx => {
      await tx.run('UPDATE issueListMembers SET role = ? WHERE listId = ? AND userId = ?',
        [newRole, listId, targetUserId])
      if (otherOwner) {
        await tx.run('UPDATE issueLists SET ownerId = ?, updatedAt = ? WHERE id = ?',
          [otherOwner.userId, new Date().toISOString(), listId])
      }
    })

    return await db.get('SELECT * FROM issueListMembers WHERE listId = ? AND userId = ?',
      [listId, targetUserId]) as IssueListMember
  }
}
