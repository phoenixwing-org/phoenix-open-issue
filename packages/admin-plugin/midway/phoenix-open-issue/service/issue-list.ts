import { randomUUID } from 'node:crypto';
import { Inject, Provide } from '@midwayjs/core';
import { Context } from '@midwayjs/koa';
import { InjectDataSource, InjectEntityModel } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { DataSource, In, Repository } from 'typeorm';
import {
  canManageIssueList,
  enrichIssueLists,
  normalizeHostUserId,
  normalizeIssueListUpdateInput,
  normalizeIssueListMemberRole,
  normalizeNewIssueListInput,
  type IssueListUpdateInput,
  type IssueListMemberRole,
  type NewIssueListInput,
} from '../domain/issue-list';
import { OpenIssueListEntity } from '../entity/issue-list';
import { OpenIssueListLinkEntity } from '../entity/issue-list-link';
import { OpenIssueListMemberEntity } from '../entity/issue-list-member';
import { OpenIssueHostUserService } from './host-user';

type ListResult = OpenIssueListEntity & {
  memberCount: number;
  issueCount: number;
  myRole: IssueListMemberRole | null;
  ownerName?: string;
};

type MemberResult = OpenIssueListMemberEntity & {
  username: string;
  displayName: string | null;
};

function queryFlag(value: unknown): boolean {
  return value === true || value === 'true' || value === 1 || value === '1';
}

@Provide()
export class OpenIssueListService {
  @Inject()
  ctx: Context;

  @InjectEntityModel(OpenIssueListEntity)
  listRepository: Repository<OpenIssueListEntity>;

  @InjectEntityModel(OpenIssueListMemberEntity)
  memberRepository: Repository<OpenIssueListMemberEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  issueLinkRepository: Repository<OpenIssueListLinkEntity>;

  @InjectDataSource()
  dataSource: DataSource;

  @Inject()
  hostUserService: OpenIssueHostUserService;

  private actorId(): string {
    const value = this.ctx.admin?.userId;
    if (value === undefined || value === null)
      throw new CoolCommException('登录身份无效', 401);
    return String(value);
  }

  private isHostRoot(): boolean {
    return this.ctx.admin?.username === 'admin';
  }

  private failInput(error: unknown): never {
    const message = error instanceof Error ? error.message : '请求数据无效';
    throw new CoolCommException(message, 400);
  }

  private async visibleLists(options: {
    includeArchived?: unknown;
    includeDeleted?: unknown;
    archivedOnly?: boolean;
    deletedOnly?: boolean;
    all?: boolean;
  }): Promise<ListResult[]> {
    const actorId = this.actorId();
    // all/deleted endpoints are isolated behind list:admin in the manifest;
    // ordinary list reads still apply the plugin-owned membership boundary.
    const globalScope = Boolean(
      options.all || options.deletedOnly || this.isHostRoot()
    );

    const memberListIds = globalScope
      ? []
      : (
          await this.memberRepository.find({
            select: { listId: true },
            where: { userId: actorId },
          })
        ).map(item => item.listId);

    const query = this.listRepository.createQueryBuilder('list');
    if (!globalScope) {
      if (memberListIds.length > 0) {
        query.andWhere(
          '(list.ownerId = :actorId OR list.id IN (:...memberListIds))',
          {
            actorId,
            memberListIds,
          }
        );
      } else {
        query.andWhere('list.ownerId = :actorId', { actorId });
      }
    }

    if (options.deletedOnly) query.andWhere('list.isDeleted = 1');
    else if (!queryFlag(options.includeDeleted))
      query.andWhere('list.isDeleted = 0');

    if (options.archivedOnly) query.andWhere('list.archived = 1');
    else if (!queryFlag(options.includeArchived))
      query.andWhere('list.archived = 0');

    query.orderBy(
      options.deletedOnly ? 'list.deletedAt' : 'list.updatedAt',
      'DESC'
    );
    return this.enrich(await query.getMany(), actorId);
  }

  private async enrich(
    lists: OpenIssueListEntity[],
    actorId = this.actorId()
  ): Promise<ListResult[]> {
    if (lists.length === 0) return [];
    const members = await this.memberRepository.find({
      where: { listId: In(lists.map(item => item.id)) },
    });
    const issueCounts = Object.fromEntries(
      (
        await this.issueLinkRepository
          .createQueryBuilder('link')
          .select('link.listId', 'listId')
          .addSelect('COUNT(*)', 'count')
          .where('link.listId IN (:...listIds)', {
            listIds: lists.map(item => item.id),
          })
          .groupBy('link.listId')
          .getRawMany<{ listId: string; count: string }>()
      ).map(item => [item.listId, Number(item.count)])
    );
    const ownerNames = await this.hostUserService.names(
      lists.map(item => item.ownerId)
    );
    return enrichIssueLists(lists, members, actorId, issueCounts).map(list => ({
      ...list,
      ownerName:
        ownerNames.get(list.ownerId) ?? `未知用户（ID ${list.ownerId}）`,
    })) as ListResult[];
  }

  private async requiredList(
    id: string,
    includeDeleted = false
  ): Promise<OpenIssueListEntity> {
    const list = await this.listRepository.findOneBy({ id });
    if (!list || (!includeDeleted && list.isDeleted === 1)) {
      throw new CoolCommException('列表不存在', 404);
    }
    return list;
  }

  private async roleFor(list: OpenIssueListEntity, actorId = this.actorId()) {
    if (list.ownerId === actorId) return 'owner' as const;
    return (
      (
        await this.memberRepository.findOneBy({
          listId: list.id,
          userId: actorId,
        })
      )?.role ?? null
    );
  }

  private async assertReadable(list: OpenIssueListEntity) {
    if (this.isHostRoot()) return;
    if (!(await this.roleFor(list)))
      throw new CoolCommException('无权查看此列表', 403);
  }

  private async assertManageable(list: OpenIssueListEntity) {
    if (!canManageIssueList(await this.roleFor(list), this.isHostRoot())) {
      throw new CoolCommException('无权管理此列表', 403);
    }
  }

  async myLists(includeArchived: unknown) {
    return this.visibleLists({ includeArchived });
  }

  async allLists(includeArchived: unknown, includeDeleted: unknown) {
    return this.visibleLists({ includeArchived, includeDeleted, all: true });
  }

  async archivedLists() {
    return this.visibleLists({ includeArchived: true, archivedOnly: true });
  }

  async deletedLists() {
    return this.visibleLists({
      includeDeleted: true,
      includeArchived: true,
      deletedOnly: true,
    });
  }

  async get(id: string): Promise<ListResult> {
    const list = await this.requiredList(id);
    await this.assertReadable(list);
    return (await this.enrich([list]))[0];
  }

  async create(value: unknown): Promise<ListResult> {
    let input: NewIssueListInput;
    try {
      input = normalizeNewIssueListInput(value);
    } catch (error) {
      this.failInput(error);
    }

    const actorId = this.actorId();
    const id = randomUUID();
    const now = new Date().toISOString();
    const list = this.listRepository.create({
      id,
      ...input,
      ownerId: actorId,
      archived: 0,
      isDeleted: 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    });
    const member = this.memberRepository.create({
      id: randomUUID(),
      listId: id,
      userId: actorId,
      role: 'owner',
      joinedAt: now,
    });

    await this.dataSource.transaction(async manager => {
      await manager.save(OpenIssueListEntity, list);
      await manager.save(OpenIssueListMemberEntity, member);
    });
    return (await this.enrich([list], actorId))[0];
  }

  async update(id: string, value: unknown): Promise<ListResult> {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    let input: IssueListUpdateInput;
    try {
      input = normalizeIssueListUpdateInput(value);
    } catch (error) {
      this.failInput(error);
    }

    if (input.ownerId && input.ownerId !== list.ownerId) {
      await this.applyOwnerTransfer(list, normalizeHostUserId(input.ownerId));
      delete input.ownerId;
    }
    Object.assign(list, input, { updatedAt: new Date().toISOString() });
    await this.listRepository.save(list);
    return (await this.enrich([list]))[0];
  }

  private async applyOwnerTransfer(list: OpenIssueListEntity, ownerId: string) {
    const now = new Date().toISOString();
    await this.dataSource.transaction(async manager => {
      list.ownerId = ownerId;
      list.updatedAt = now;
      await manager.save(OpenIssueListEntity, list);
      const repository = manager.getRepository(OpenIssueListMemberEntity);
      const existing = await repository.findOneBy({
        listId: list.id,
        userId: ownerId,
      });
      if (existing) {
        existing.role = 'owner';
        await repository.save(existing);
      } else {
        await repository.save(
          repository.create({
            id: randomUUID(),
            listId: list.id,
            userId: ownerId,
            role: 'owner',
            joinedAt: now,
          })
        );
      }
    });
  }

  private async decorateMembers(
    members: OpenIssueListMemberEntity[]
  ): Promise<MemberResult[]> {
    const identities = await this.hostUserService.identities(
      members.map(member => member.userId)
    );
    return members.map(member => {
      const user = identities.get(member.userId);
      return {
        ...member,
        username: user?.username ?? '',
        displayName: user?.displayName ?? null,
      };
    });
  }

  async transferOwner(id: string, value: unknown): Promise<ListResult> {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    let ownerId: string;
    try {
      ownerId = normalizeHostUserId(value);
    } catch (error) {
      this.failInput(error);
    }
    if (ownerId !== list.ownerId) await this.applyOwnerTransfer(list, ownerId);
    return (await this.enrich([list]))[0];
  }

  async addMember(id: string, userValue: unknown, roleValue: unknown) {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    let userId: string;
    let role: IssueListMemberRole;
    try {
      userId = normalizeHostUserId(userValue);
      role = normalizeIssueListMemberRole(roleValue ?? 'editor');
    } catch (error) {
      this.failInput(error);
    }
    const existing = await this.memberRepository.findOneBy({
      listId: id,
      userId,
    });
    if (existing) throw new CoolCommException('该用户已经是列表成员', 400);
    const member = this.memberRepository.create({
      id: randomUUID(),
      listId: id,
      userId,
      role,
      joinedAt: new Date().toISOString(),
    });
    await this.memberRepository.save(member);
    return (await this.decorateMembers([member]))[0];
  }

  async removeMember(id: string, userValue: unknown): Promise<void> {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    let userId: string;
    try {
      userId = normalizeHostUserId(userValue);
    } catch (error) {
      this.failInput(error);
    }
    if (userId === list.ownerId) {
      throw new CoolCommException('不能移除当前负责人，请先转移负责人', 400);
    }
    const result = await this.memberRepository.delete({ listId: id, userId });
    if (result.affected !== 1)
      throw new CoolCommException('列表成员不存在', 404);
  }

  async updateMemberRole(id: string, userValue: unknown, roleValue: unknown) {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    let userId: string;
    let role: IssueListMemberRole;
    try {
      userId = normalizeHostUserId(userValue);
      role = normalizeIssueListMemberRole(roleValue);
    } catch (error) {
      this.failInput(error);
    }
    if (userId === list.ownerId && role !== 'owner') {
      throw new CoolCommException('不能降低当前负责人的角色', 400);
    }
    const member = await this.memberRepository.findOneBy({
      listId: id,
      userId,
    });
    if (!member) throw new CoolCommException('列表成员不存在', 404);
    member.role = role;
    await this.memberRepository.save(member);
    return (await this.decorateMembers([member]))[0];
  }

  async archive(id: string, archived: unknown): Promise<ListResult> {
    const list = await this.requiredList(id);
    await this.assertManageable(list);
    list.archived = queryFlag(archived) ? 1 : 0;
    list.updatedAt = new Date().toISOString();
    await this.listRepository.save(list);
    return (await this.enrich([list]))[0];
  }

  async delete(id: string): Promise<void> {
    const list = await this.requiredList(id);
    const role = await this.roleFor(list);
    if (!this.isHostRoot() && role !== 'owner') {
      throw new CoolCommException('只有 Host 管理员或列表负责人可以删除', 403);
    }
    const now = new Date().toISOString();
    list.isDeleted = 1;
    list.deletedAt = now;
    list.updatedAt = now;
    await this.listRepository.save(list);
  }

  async restore(id: string): Promise<ListResult> {
    const list = await this.requiredList(id, true);
    if (list.isDeleted !== 1)
      throw new CoolCommException('列表未处于删除状态', 400);
    list.isDeleted = 0;
    list.deletedAt = null;
    list.updatedAt = new Date().toISOString();
    await this.listRepository.save(list);
    return (await this.enrich([list]))[0];
  }

  async members(id: string) {
    const list = await this.requiredList(id);
    await this.assertReadable(list);
    return this.decorateMembers(
      await this.memberRepository.find({
        where: { listId: id },
        order: { joinedAt: 'ASC' },
      })
    );
  }
}
