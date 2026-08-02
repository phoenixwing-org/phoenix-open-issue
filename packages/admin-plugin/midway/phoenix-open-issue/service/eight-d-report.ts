import { randomUUID } from "node:crypto";
import { Inject, Provide } from "@midwayjs/core";
import { InjectEntityModel } from "@midwayjs/typeorm";
import { CoolCommException } from "@cool-midway/core";
import { In, Repository } from "typeorm";
import {
  normalizeEightDReportInput,
  type OpenIssueEightDReportInput,
} from "../domain/eight-d-report";
import { OpenIssueEightDReportEntity } from "../entity/eight-d-report";
import { OpenIssueEntity } from "../entity/issue";
import { OpenIssueListEntity } from "../entity/issue-list";
import { OpenIssueAccessService } from "./access";
import { OpenIssueHostUserService } from "./host-user";

@Provide()
export class OpenIssueEightDReportService {
  @Inject()
  access: OpenIssueAccessService;

  @Inject()
  hostUsers: OpenIssueHostUserService;

  @InjectEntityModel(OpenIssueEightDReportEntity)
  reportRepository: Repository<OpenIssueEightDReportEntity>;

  @InjectEntityModel(OpenIssueEntity)
  issueRepository: Repository<OpenIssueEntity>;

  @InjectEntityModel(OpenIssueListEntity)
  listRepository: Repository<OpenIssueListEntity>;

  private failInput(error: unknown): never {
    throw new CoolCommException(
      error instanceof Error ? error.message : "请求数据无效",
      400
    );
  }

  private async required(id: string): Promise<OpenIssueEightDReportEntity> {
    const report = await this.reportRepository.findOneBy({ id, isDeleted: 0 });
    if (!report) throw new CoolCommException("8D 报告不存在", 404);
    return report;
  }

  private async canModify(report: OpenIssueEightDReportEntity): Promise<boolean> {
    if (this.access.isSystemAdmin()) return true;
    if (!report.relatedIssueId)
      return report.createdBy === this.access.actorId();
    try {
      await this.access.assertIssueModifiable(report.relatedIssueId);
      return true;
    } catch {
      return false;
    }
  }

  private async assertWritable(
    report: OpenIssueEightDReportEntity
  ): Promise<void> {
    if (!(await this.canModify(report)))
      throw new CoolCommException("无权修改此 8D 报告", 403);
  }

  private async decorate(rows: OpenIssueEightDReportEntity[]) {
    const issueIds = [
      ...new Set(
        rows
          .map(row => row.relatedIssueId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const issues = issueIds.length
      ? await this.issueRepository.findBy({ id: In(issueIds) })
      : [];
    const lists = issues.length
      ? await this.listRepository.findBy({
          id: In([...new Set(issues.map(issue => issue.listId))]),
        })
      : [];
    const issueMap = new Map(issues.map(issue => [issue.id, issue]));
    const listMap = new Map(lists.map(list => [list.id, list]));
    const names = await this.hostUsers.names(rows.map(row => row.createdBy));
    return Promise.all(
      rows.map(async report => {
        const issue = report.relatedIssueId
          ? issueMap.get(report.relatedIssueId)
          : undefined;
        return {
          ...report,
          issueNo: issue?.issueNo ?? null,
          issueTitle: issue?.title ?? null,
          listName: issue ? listMap.get(issue.listId)?.name ?? null : null,
          creatorName: names.get(report.createdBy) ?? report.createdBy,
          _canModify: await this.canModify(report),
        };
      })
    );
  }

  private async isReadable(report: OpenIssueEightDReportEntity) {
    if (this.access.isSystemAdmin()) return true;
    if (!report.relatedIssueId)
      return report.createdBy === this.access.actorId();
    try {
      await this.access.assertIssueReadable(report.relatedIssueId);
      return true;
    } catch {
      return false;
    }
  }

  async list() {
    const rows = await this.reportRepository.find({
      where: { isDeleted: 0 },
      order: { updatedAt: "DESC" },
    });
    const readable: OpenIssueEightDReportEntity[] = [];
    for (const row of rows) if (await this.isReadable(row)) readable.push(row);
    return this.decorate(readable);
  }

  async byIssue(issueId: string) {
    await this.access.assertIssueReadable(issueId);
    return this.decorate(
      await this.reportRepository.find({
        where: { relatedIssueId: issueId, isDeleted: 0 },
        order: { updatedAt: "DESC" },
      })
    );
  }

  async get(id: string) {
    const report = await this.required(id);
    if (!(await this.isReadable(report)))
      throw new CoolCommException("无权查看此 8D 报告", 403);
    return (await this.decorate([report]))[0];
  }

  async issueOptions() {
    const issues = await this.issueRepository.find({
      order: { updatedAt: "DESC" },
    });
    const writable: OpenIssueEntity[] = [];
    for (const issue of issues) {
      try {
        await this.access.assertIssueModifiable(issue.id);
        writable.push(issue);
      } catch {
        // 关联选择器只展示当前用户有编辑权的 Issue。
      }
    }
    const lists = writable.length
      ? await this.listRepository.findBy({
          id: In([...new Set(writable.map(issue => issue.listId))]),
        })
      : [];
    const listNames = new Map(lists.map(list => [list.id, list.name]));
    return writable.map(issue => ({
      id: issue.id,
      issueNo: issue.issueNo,
      title: issue.title,
      listName: listNames.get(issue.listId) ?? "",
    }));
  }

  async create(value: unknown) {
    let input: OpenIssueEightDReportInput;
    try {
      input = normalizeEightDReportInput(value);
    } catch (error) {
      this.failInput(error);
    }
    if (input.relatedIssueId)
      await this.access.assertIssueModifiable(input.relatedIssueId);
    const now = new Date().toISOString();
    const report = this.reportRepository.create({
      id: randomUUID(),
      ...input,
      createdBy: this.access.actorId(),
      createdAt: now,
      updatedAt: now,
      isDeleted: 0,
      deletedAt: null,
    });
    await this.reportRepository.save(report);
    return (await this.decorate([report]))[0];
  }

  async update(id: string, value: unknown) {
    const report = await this.required(id);
    await this.assertWritable(report);
    let input: OpenIssueEightDReportInput;
    try {
      input = normalizeEightDReportInput(value);
    } catch (error) {
      this.failInput(error);
    }
    if (input.relatedIssueId !== report.relatedIssueId && input.relatedIssueId)
      await this.access.assertIssueModifiable(input.relatedIssueId);
    Object.assign(report, input, { updatedAt: new Date().toISOString() });
    await this.reportRepository.save(report);
    return (await this.decorate([report]))[0];
  }

  async delete(id: string): Promise<void> {
    const report = await this.required(id);
    await this.assertWritable(report);
    const now = new Date().toISOString();
    report.isDeleted = 1;
    report.deletedAt = now;
    report.updatedAt = now;
    await this.reportRepository.save(report);
  }
}
