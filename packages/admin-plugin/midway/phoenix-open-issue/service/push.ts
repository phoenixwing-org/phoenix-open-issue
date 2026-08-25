import { randomUUID } from "node:crypto";
import { Inject, Provide } from "@midwayjs/core";
import { InjectDataSource, InjectEntityModel } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { DataSource, In, Repository } from "typeorm";
import {
  normalizeDashboardLimit,
  normalizeDashboardScope,
  normalizePushAction,
  normalizePushInput,
} from "../domain/push";
import { OpenIssueEntity } from "../entity/issue";
import { OpenIssueListEntity } from "../entity/issue-list";
import { OpenIssueListLinkEntity } from "../entity/issue-list-link";
import { OpenIssueListMemberEntity } from "../entity/issue-list-member";
import { OpenIssuePushRecordEntity } from "../entity/push-record";
import { OpenIssueAccessService } from "./access";
import { OpenIssueHostUserService } from "./host-user";

@Provide()
export class OpenIssuePushService {
  @Inject()
  access: OpenIssueAccessService;

  @Inject()
  hostUsers: OpenIssueHostUserService;

  @InjectEntityModel(OpenIssuePushRecordEntity)
  pushRepository: Repository<OpenIssuePushRecordEntity>;

  @InjectEntityModel(OpenIssueEntity)
  issueRepository: Repository<OpenIssueEntity>;

  @InjectEntityModel(OpenIssueListEntity)
  listRepository: Repository<OpenIssueListEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  @InjectEntityModel(OpenIssueListMemberEntity)
  memberRepository: Repository<OpenIssueListMemberEntity>;

  @InjectDataSource()
  dataSource: DataSource;

  private failInput(error: unknown): never {
    throw new CoolCommException(
      error instanceof Error ? error.message : "请求数据无效",
      400
    );
  }

  private async listMemberIds(listId: string): Promise<string[]> {
    const list = await this.access.requiredList(listId);
    const members = await this.memberRepository.find({ where: { listId } });
    return [...new Set([list.ownerId, ...members.map(item => item.userId)])];
  }

  private validation(fromMembers: string[], toMembers: string[]) {
    const toSet = new Set(toMembers);
    const overlapUserIds = fromMembers.filter(id => toSet.has(id));
    const total = Math.max(fromMembers.length, toMembers.length, 1);
    const overlapPercent = Math.round((overlapUserIds.length / total) * 100);
    const canPush = overlapUserIds.length > 0;
    return {
      valid: canPush,
      overlapUserIds,
      overlapPercent,
      canPush,
      message: canPush
        ? `可推送：${overlapUserIds.length} 个共同成员（${overlapPercent}%）`
        : "无法推送：源列表和目标列表没有共同成员",
    };
  }

  async preview(fromListId: string, toListId: string) {
    if (!fromListId || !toListId || fromListId === toListId)
      throw new CoolCommException("请选择不同的源列表和目标列表", 400);
    await this.access.assertListModifiable(fromListId);
    await this.access.assertListReadable(toListId);
    return this.validation(
      await this.listMemberIds(fromListId),
      await this.listMemberIds(toListId)
    );
  }

  async push(value: unknown) {
    let input;
    try {
      input = normalizePushInput(value);
    } catch (error) {
      this.failInput(error);
    }
    await this.access.assertListModifiable(input.fromListId);
    let validation;
    if (input.targetType === "list") {
      await this.access.assertListReadable(input.toListId!);
      validation = this.validation(
        await this.listMemberIds(input.fromListId),
        await this.listMemberIds(input.toListId!)
      );
      if (!validation.canPush)
        throw new CoolCommException(validation.message, 403);
    } else {
      if (input.toUserId === this.access.actorId())
        throw new CoolCommException("不能推送给自己", 400);
      await this.hostUsers.assertActive(input.toUserId!);
      validation = {
        valid: true,
        overlapUserIds: [],
        overlapPercent: 0,
        canPush: true,
        message: "可推送：接收人接受时选择其有管理权限的目标列表",
      };
    }

    const linked = await this.linkRepository.find({
      where: { issueId: In(input.issueIds), listId: input.fromListId },
    });
    if (new Set(linked.map(item => item.issueId)).size !== input.issueIds.length)
      throw new CoolCommException("推送数据包含不属于源列表的 Issue", 400);

    const now = new Date().toISOString();
    const actorId = this.access.actorId();
    const records = input.issueIds.map(issueId =>
      this.pushRepository.create({
        id: randomUUID(),
        fromListId: input.fromListId,
        targetType: input.targetType,
        toListId: input.toListId,
        toUserId: input.toUserId,
        issueId,
        pushedBy: actorId,
        pushedAt: now,
        status: "pending",
        handledBy: null,
        handledAt: null,
        rejectReason: null,
        note: input.note,
      })
    );
    await this.pushRepository.save(records);
    return { records, validation };
  }

  private async decorate(records: OpenIssuePushRecordEntity[]) {
    if (!records.length) return [];
    const issueIds = [...new Set(records.map(item => item.issueId))];
    const listIds = [
      ...new Set(
        records
          .flatMap(item => [item.fromListId, item.toListId])
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const [issues, lists, names] = await Promise.all([
      this.issueRepository.findBy({ id: In(issueIds) }),
      this.listRepository.findBy({ id: In(listIds) }),
      this.hostUsers.names(
        records.flatMap(item => [item.pushedBy, item.toUserId])
      ),
    ]);
    const issueMap = new Map(issues.map(issue => [issue.id, issue]));
    const listMap = new Map(lists.map(list => [list.id, list]));
    const actorId = this.access.actorId();
    return Promise.all(
      records.map(async record => {
        let canHandle = false;
        if (record.status === "pending") {
          if (this.access.isHostRoot()) canHandle = true;
          else if (record.targetType === "user")
            canHandle = record.toUserId === actorId;
          else if (record.toListId) {
            const role = await this.access.roleFor(record.toListId);
            canHandle = role === "owner" || role === "admin";
          }
        }
        return {
          ...record,
          issueTitle: issueMap.get(record.issueId)?.title ?? record.issueId,
          fromListName:
            listMap.get(record.fromListId)?.name ?? record.fromListId,
          toListName: record.toListId
            ? listMap.get(record.toListId)?.name ?? record.toListId
            : null,
          toUserName: record.toUserId
            ? names.get(record.toUserId) ??
              `未知用户（ID ${record.toUserId}）`
            : null,
          pushedByName:
            names.get(record.pushedBy) ??
            `未知用户（ID ${record.pushedBy}）`,
          _canHandle: canHandle,
          _canWithdraw:
            record.status === "pending" && record.pushedBy === actorId,
        };
      })
    );
  }

  private async visibleRecords() {
    const records = await this.pushRepository.find({
      order: { pushedAt: "DESC" },
    });
    if (this.access.isHostRoot()) return records;
    const actorId = this.access.actorId();
    const memberships = await this.memberRepository.find({
      where: { userId: actorId },
    });
    const owned = await this.listRepository.find({
      where: { ownerId: actorId, isDeleted: 0 },
    });
    const listIds = new Set([
      ...memberships.map(item => item.listId),
      ...owned.map(item => item.id),
    ]);
    return records.filter(
      record =>
        record.pushedBy === actorId ||
        record.toUserId === actorId ||
        listIds.has(record.fromListId) ||
        (record.toListId ? listIds.has(record.toListId) : false)
    );
  }

  async history() {
    return this.decorate(await this.visibleRecords());
  }

  async listHistory(listId: string) {
    await this.access.assertListReadable(listId);
    return this.decorate(
      await this.pushRepository
        .createQueryBuilder("record")
        .where("record.fromListId = :listId OR record.toListId = :listId", {
          listId,
        })
        .orderBy("record.pushedAt", "DESC")
        .getMany()
    );
  }

  async incoming(listId: string) {
    await this.access.assertListReadable(listId);
    return this.decorate(
      await this.pushRepository.find({
        where: { toListId: listId, targetType: "list", status: "pending" },
        order: { pushedAt: "DESC" },
      })
    );
  }

  private async required(id: string) {
    const record = await this.pushRepository.findOneBy({ id });
    if (!record) throw new CoolCommException("推送记录不存在", 404);
    return record;
  }

  async targetLists(id: string) {
    const record = await this.required(id);
    if (record.status !== "pending" || record.targetType !== "user")
      throw new CoolCommException("该记录不是待处理的用户推送", 400);
    if (
      !this.access.isHostRoot() &&
      record.toUserId !== this.access.actorId()
    )
      throw new CoolCommException("只有指定接收人可以处理此推送", 403);
    const query = this.listRepository
      .createQueryBuilder("list")
      .where("list.archived = 0 AND list.isDeleted = 0");
    if (!this.access.isHostRoot()) {
      const manageable = await this.memberRepository.find({
        where: {
          userId: this.access.actorId(),
          role: In(["owner", "admin"]),
        },
      });
      const ids = manageable.map(item => item.listId);
      if (!ids.length) return [];
      query.andWhere("list.id IN (:...ids)", { ids });
    }
    const lists = await query.orderBy("list.name", "ASC").getMany();
    return lists.map(list => ({
      id: list.id,
      name: list.name,
      listType: list.listType,
      role: list.ownerId === this.access.actorId() ? "owner" : "admin",
    }));
  }

  async handle(
    id: string,
    actionValue: unknown,
    rejectReasonValue: unknown,
    requestedToListIdValue: unknown
  ) {
    let action;
    try {
      action = normalizePushAction(actionValue);
    } catch (error) {
      this.failInput(error);
    }
    const record = await this.required(id);
    if (record.status !== "pending")
      throw new CoolCommException("该推送已处理", 409);
    const actorId = this.access.actorId();
    if (record.targetType === "user") {
      if (!this.access.isHostRoot() && record.toUserId !== actorId)
        throw new CoolCommException("只有指定接收人可以处理此推送", 403);
    } else {
      if (!record.toListId)
        throw new CoolCommException("列表推送缺少目标列表", 400);
      const role = await this.access.roleFor(record.toListId);
      if (
        !this.access.isHostRoot() &&
        role !== "owner" &&
        role !== "admin"
      )
        throw new CoolCommException("只有目标列表负责人可以处理推送", 403);
    }

    const requestedToListId =
      typeof requestedToListIdValue === "string"
        ? requestedToListIdValue.trim()
        : "";
    const acceptedToListId =
      record.targetType === "user" ? requestedToListId : record.toListId;
    if (action === "accepted") {
      if (!acceptedToListId)
        throw new CoolCommException("接受推送时请选择目标列表", 400);
      const list = await this.access.requiredList(acceptedToListId);
      const role = await this.access.roleFor(list.id);
      if (
        !this.access.isHostRoot() &&
        role !== "owner" &&
        role !== "admin"
      )
        throw new CoolCommException("只能接受到您有管理权限的目标列表", 403);
      if (list.archived)
        throw new CoolCommException("目标列表已归档，不能接受推送", 400);
    }

    const rejectReason =
      typeof rejectReasonValue === "string"
        ? rejectReasonValue.trim() || null
        : null;
    const now = new Date().toISOString();
    await this.dataSource.transaction(async manager => {
      const records = manager.getRepository(OpenIssuePushRecordEntity);
      const result = await records.update(
        { id, status: "pending" },
        {
          status: action,
          toListId:
            action === "accepted" ? acceptedToListId : record.toListId,
          handledBy: actorId,
          handledAt: now,
          rejectReason,
        }
      );
      if (result.affected !== 1)
        throw new CoolCommException("该推送已处理", 409);
      if (action === "accepted" && acceptedToListId) {
        const links = manager.getRepository(OpenIssueListLinkEntity);
        const existing = await links.findOneBy({
          issueId: record.issueId,
          listId: acceptedToListId,
        });
        if (!existing)
          await links.save(
            links.create({
              id: randomUUID(),
              issueId: record.issueId,
              listId: acceptedToListId,
              attentionLevel: 3,
              attentionUpdatedAt: null,
              attentionUpdatedBy: null,
              linkedAt: now,
              linkedBy: actorId,
            })
          );
      }
    });
    return this.required(id);
  }

  async withdraw(id: string) {
    const record = await this.required(id);
    if (record.pushedBy !== this.access.actorId())
      throw new CoolCommException("只有发起人可以撤回推送", 403);
    if (record.status !== "pending")
      throw new CoolCommException("该推送已处理，不能撤回", 409);
    record.status = "withdrawn";
    record.handledBy = this.access.actorId();
    record.handledAt = new Date().toISOString();
    await this.pushRepository.save(record);
    return record;
  }

  async dashboard(scopeValue: unknown, limitValue: unknown) {
    let scope;
    try {
      scope = normalizeDashboardScope(scopeValue);
    } catch (error) {
      this.failInput(error);
    }
    const limit = normalizeDashboardLimit(limitValue);
    const pending = (await this.visibleRecords()).filter(
      record => record.status === "pending"
    );
    const decorated = await this.decorate(pending);
    const incoming = decorated.filter(item => item._canHandle);
    const outgoing = decorated.filter(item => item._canWithdraw);
    const total = new Set([
      ...incoming.map(item => item.id),
      ...outgoing.map(item => item.id),
    ]).size;
    return {
      scope,
      incomingPushes: scope === "incoming" ? incoming.slice(0, limit) : [],
      outgoingPushes: scope === "outgoing" ? outgoing.slice(0, limit) : [],
      counts: {
        incoming: incoming.length,
        outgoing: outgoing.length,
        total,
      },
    };
  }
}
