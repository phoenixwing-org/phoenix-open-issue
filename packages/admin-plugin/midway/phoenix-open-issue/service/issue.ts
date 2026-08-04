import { randomUUID } from "node:crypto";
import { Inject, Provide } from "@midwayjs/core";
import { InjectDataSource, InjectEntityModel } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { DataSource, In, Like, Repository } from "typeorm";
import {
  canModifyIssue,
  normalizeAttentionLevel,
  normalizeIssueIds,
  normalizeIssueStatus,
  normalizeIssueUpdateInput,
  normalizeNewIssueInput,
} from "../domain/issue";
import { OpenIssueEntity } from "../entity/issue";
import { OpenIssueFunctionEntity } from "../entity/function";
import { OpenIssueListEntity } from "../entity/issue-list";
import { OpenIssueListLinkEntity } from "../entity/issue-list-link";
import { OpenIssueAccessService } from "./access";

@Provide()
export class OpenIssueService {
  @Inject()
  access: OpenIssueAccessService;

  @InjectEntityModel(OpenIssueEntity)
  issueRepository: Repository<OpenIssueEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  @InjectEntityModel(OpenIssueFunctionEntity)
  functionRepository: Repository<OpenIssueFunctionEntity>;

  @InjectEntityModel(OpenIssueListEntity)
  listRepository: Repository<OpenIssueListEntity>;

  @InjectDataSource()
  dataSource: DataSource;

  private failInput(error: unknown): never {
    throw new CoolCommException(
      error instanceof Error ? error.message : "请求数据无效",
      400
    );
  }

  private async decorate(issue: OpenIssueEntity, listId = issue.listId) {
    const [origin, link, count, originRole, currentRole, func] =
      await Promise.all([
        this.listRepository.findOneBy({ id: issue.listId }),
        this.linkRepository.findOneBy({ issueId: issue.id, listId }),
        this.linkRepository.countBy({ issueId: issue.id }),
        this.access.roleFor(issue.listId),
        listId === issue.listId
          ? this.access.roleFor(issue.listId)
          : this.access.roleFor(listId),
        issue.functionId
          ? this.functionRepository.findOneBy({ id: issue.functionId })
          : null,
      ]);
    return {
      ...issue,
      originListName: origin?.name ?? null,
      listCount: count,
      _attentionLevel: link?.attentionLevel ?? 0,
      _canModify: canModifyIssue(originRole, this.access.isHostRoot()),
      _canSetAttention: canModifyIssue(
        currentRole,
        this.access.isHostRoot()
      ),
      _canPush: canModifyIssue(currentRole, this.access.isHostRoot()),
      _functionName: func?.functionName ?? null,
      _functionPlatform: func?.platform ?? null,
      _functionExternalId: func?.externalId ?? null,
    };
  }

  async list(listId: string, query: Record<string, unknown>) {
    const role = await this.access.assertListReadable(listId);
    const page = Math.max(1, Number(query.page) || 1);
    const size = Math.max(1, Math.min(500, Number(query.size) || 50));
    const builder = this.issueRepository
      .createQueryBuilder("issue")
      .innerJoin(
        OpenIssueListLinkEntity,
        "link",
        "link.issueId = issue.id AND link.listId = :listId",
        { listId }
      )
      .addSelect("link.attentionLevel", "link_attentionLevel");

    if (typeof query.status === "string" && query.status)
      builder.andWhere("issue.status = :status", { status: query.status });
    if (typeof query.priority === "string" && query.priority)
      builder.andWhere("issue.priority = :priority", {
        priority: query.priority,
      });
    if (typeof query.search === "string" && query.search.trim()) {
      builder.andWhere(
        "(issue.title ILIKE :search OR issue.description ILIKE :search)",
        { search: `%${query.search.trim()}%` }
      );
    }

    const sortable: Record<string, string> = {
      attention: "link.attentionLevel",
      createdAt: "issue.createdAt",
      severity: "issue.severity",
      priority: "issue.priority",
      status: "issue.status",
      title: "issue.title",
      issueNo: "issue.issueNo",
      dueDate: "issue.dueDate",
      sortOrder: "issue.sortOrder",
    };
    const segments =
      typeof query.sort === "string" ? query.sort.split(",") : [];
    let ordered = false;
    for (const segment of segments) {
      const [field, rawDirection] = segment.trim().split(":");
      if (!sortable[field]) continue;
      const direction = rawDirection?.toLowerCase() === "asc" ? "ASC" : "DESC";
      if (!ordered) builder.orderBy(sortable[field], direction);
      else builder.addOrderBy(sortable[field], direction);
      ordered = true;
    }
    if (!ordered)
      builder
        .orderBy("link.attentionLevel", "DESC")
        .addOrderBy("issue.sortOrder", "ASC");
    builder
      .addOrderBy("issue.createdAt", "DESC")
      .skip((page - 1) * size)
      .take(size);

    const total = await builder
      .clone()
      .skip(undefined)
      .take(undefined)
      .getCount();
    const { entities, raw } = await builder.getRawAndEntities();
    const origins = await this.listRepository.findBy({
      id: In([...new Set(entities.map((item) => item.listId))]),
    });
    const functionIds = [
      ...new Set(
        entities
          .map((item) => item.functionId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const functions = functionIds.length
      ? await this.functionRepository.findBy({ id: In(functionIds) })
      : [];
    const functionsById = new Map(functions.map((item) => [item.id, item]));
    const originNames = new Map(origins.map((item) => [item.id, item.name]));
    const originRoles = new Map(
      await Promise.all(
        origins.map(
          async (item) => [item.id, await this.access.roleFor(item.id)] as const
        )
      )
    );
    const canCurrentModify = canModifyIssue(role, this.access.isHostRoot());
    const items = entities.map((issue, index) => {
      const func = issue.functionId
        ? functionsById.get(issue.functionId)
        : undefined;
      return {
        ...issue,
        originListName: originNames.get(issue.listId) ?? null,
        _attentionLevel: Number(raw[index]?.link_attentionLevel ?? 0),
        _canModify: canModifyIssue(
          originRoles.get(issue.listId) ?? null,
          this.access.isHostRoot()
        ),
        _canSetAttention: canCurrentModify,
        _canPush: canCurrentModify,
        _functionName: func?.functionName ?? null,
        _functionPlatform: func?.platform ?? null,
        _functionExternalId: func?.externalId ?? null,
      };
    });
    return { items, total };
  }

  async get(id: string) {
    return this.decorate(await this.access.assertIssueReadable(id));
  }

  async create(listId: string, value: unknown) {
    await this.access.assertIssueCreatable(listId);
    let input;
    try {
      input = normalizeNewIssueInput(value);
    } catch (error) {
      this.failInput(error);
    }
    const actorId = this.access.actorId();
    const now = new Date().toISOString();
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < 3; attempt++) {
      const id = randomUUID();
      try {
        await this.dataSource.transaction(async (manager) => {
          const issues = manager.getRepository(OpenIssueEntity);
          const links = manager.getRepository(OpenIssueListLinkEntity);
          const maxSort = await issues.maximum("sortOrder", { listId });
          let issueNo = input.issueNo;
          if (!issueNo) {
            const latest = await issues.findOne({
              where: { issueNo: Like(`ISS-${year}-%`) },
              order: { issueNo: "DESC" },
            });
            const next = latest
              ? (Number(latest.issueNo.split("-").at(-1)) || 0) + 1
              : 1;
            issueNo = `ISS-${year}-${String(next).padStart(4, "0")}`;
          }
          await issues.save(
            issues.create({
              id,
              listId,
              issueNo,
              title: input.title,
              description: input.description,
              status: "open",
              closeReason: null,
              closedBy: null,
              priority: input.priority,
              severity: input.severity,
              category: input.category,
              detectionPhase: input.detectionPhase,
              reporterId: input.reporterId,
              assigneeId: input.assigneeId,
              dueDate: input.dueDate,
              completedAt: null,
              sortOrder: (maxSort ?? -1) + 1,
              extensions: {},
              listCount: 1,
              createdBy: actorId,
              createdAt: now,
              updatedAt: now,
              functionId: input.functionId,
            })
          );
          await links.save(
            links.create({
              id: randomUUID(),
              issueId: id,
              listId,
              attentionLevel: 3,
              attentionUpdatedAt: null,
              attentionUpdatedBy: null,
              linkedAt: now,
              linkedBy: actorId,
            })
          );
        });
        return this.decorate(await this.access.requiredIssue(id), listId);
      } catch (error) {
        if (
          input.issueNo ||
          attempt === 2 ||
          !/unique|duplicate/i.test(String(error))
        )
          throw error;
      }
    }
    throw new CoolCommException("Issue 创建失败", 500);
  }

  async update(id: string, value: unknown) {
    const issue = await this.access.assertIssueModifiable(id);
    let input;
    try {
      input = normalizeIssueUpdateInput(value);
    } catch (error) {
      this.failInput(error);
    }
    Object.assign(issue, input, { updatedAt: new Date().toISOString() });
    await this.issueRepository.save(issue);
    return this.decorate(issue);
  }

  async updateStatus(id: string, value: unknown) {
    const issue = await this.access.assertIssueModifiable(id);
    let status;
    try {
      status = normalizeIssueStatus(value);
    } catch (error) {
      this.failInput(error);
    }
    const now = new Date().toISOString();
    issue.status = status;
    issue.completedAt =
      status === "resolved" || status === "closed" ? now : issue.completedAt;
    issue.updatedAt = now;
    await this.issueRepository.save(issue);
    return this.decorate(issue);
  }

  async delete(id: string) {
    const issue = await this.access.assertIssueModifiable(id);
    issue.status = "cancelled";
    issue.closeReason = "cancelled";
    issue.updatedAt = new Date().toISOString();
    await this.issueRepository.save(issue);
  }

  async reorder(listId: string, value: unknown) {
    await this.access.assertListModifiable(listId);
    let ids: string[];
    try {
      ids = normalizeIssueIds((value as { issueIds?: unknown })?.issueIds);
    } catch (error) {
      this.failInput(error);
    }
    const links = await this.linkRepository.countBy({
      listId,
      issueId: In(ids),
    });
    if (links !== ids.length)
      throw new CoolCommException("排序数据包含不属于当前列表的 Issue", 400);
    await this.dataSource.transaction(async (manager) => {
      for (const [sortOrder, id] of ids.entries()) {
        await manager
          .getRepository(OpenIssueEntity)
          .update({ id }, { sortOrder, updatedAt: new Date().toISOString() });
      }
    });
  }

  async setAttention(listId: string, issueId: string, value: unknown) {
    await this.access.assertListModifiable(listId);
    const link = await this.linkRepository.findOneBy({ listId, issueId });
    if (!link) throw new CoolCommException("Issue 列表链接不存在", 404);
    try {
      link.attentionLevel = normalizeAttentionLevel(value);
    } catch (error) {
      this.failInput(error);
    }
    link.attentionUpdatedAt = new Date().toISOString();
    link.attentionUpdatedBy = this.access.actorId();
    await this.linkRepository.save(link);
    return { attentionLevel: link.attentionLevel };
  }
}
