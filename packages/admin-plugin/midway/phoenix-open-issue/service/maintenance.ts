import { createHash, randomUUID } from 'node:crypto';
import { Inject, Provide } from '@midwayjs/core';
import { InjectDataSource, InjectEntityModel } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { DataSource, EntityManager, In, IsNull, Repository } from 'typeorm';
import {
  normalizeRepairTask,
  OPEN_ISSUE_REPAIR_TASKS,
  planCheckpointRepairs,
  planIssueLinkRepair,
  planIssueListOrgReferenceRepair,
  type CheckpointRepairChange,
  type IssueLinkRepairPlan,
  type OpenIssueRepairTask,
} from '../domain/maintenance';
import { OpenIssueCheckpointEntity } from '../entity/checkpoint';
import { OpenIssueEntity } from '../entity/issue';
import { OpenIssueListEntity } from '../entity/issue-list';
import { OpenIssueListLinkEntity } from '../entity/issue-list-link';
import { OpenIssueRepairLedgerEntity } from '../entity/repair-ledger';
import { OpenIssueAccessService } from './access';

const REPAIR_PLAN_TTL_MS = 10 * 60 * 1000;

export interface OpenIssueRepairResult {
  task: Exclude<OpenIssueRepairTask, 'all'>;
  message: string;
  details: string[];
  fixed: number;
  ledgerId: string;
}

export interface OpenIssueRepairPlanSummary {
  task: Exclude<OpenIssueRepairTask, 'all'>;
  changeCount: number;
  destructive: boolean;
  details: string[];
}

export interface OpenIssueRepairPlanResponse {
  task: OpenIssueRepairTask;
  fingerprint: string;
  generatedAt: string;
  expiresAt: string;
  plans: OpenIssueRepairPlanSummary[];
}

export interface OpenIssueRepairLedgerItem {
  id: string;
  task: OpenIssueRepairTask;
  planFingerprint: string;
  actorId: string;
  status: OpenIssueRepairLedgerEntity['status'];
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface OpenIssueRepairLedgerPage {
  list: OpenIssueRepairLedgerItem[];
  page: number;
  size: number;
  total: number;
}

interface CheckpointInternalPlan {
  task: 'checkpoints';
  changes: CheckpointRepairChange[];
  withoutDeadline: number;
}

interface LinkInternalPlan {
  task: 'links';
  repair: IssueLinkRepairPlan;
  duplicateLinks: OpenIssueListLinkEntity[];
}

interface IssueListOrgReferenceInternalPlan {
  task: 'list-org-references';
  changes: ReturnType<typeof planIssueListOrgReferenceRepair>;
}

type OpenIssueInternalPlan =
  | CheckpointInternalPlan
  | LinkInternalPlan
  | IssueListOrgReferenceInternalPlan;

interface RepairExecutionOptions {
  fingerprint: unknown;
  generatedAt: unknown;
  confirmed: unknown;
}

function fingerprintPlan(
  task: OpenIssueRepairTask,
  generatedAt: string,
  plans: OpenIssueInternalPlan[]
) {
  return createHash('sha256')
    .update(JSON.stringify({ task, generatedAt, plans }))
    .digest('hex');
}

function planSummary(plan: OpenIssueInternalPlan): OpenIssueRepairPlanSummary {
  if (plan.task === 'checkpoints') {
    return {
      task: 'checkpoints',
      changeCount: plan.changes.length,
      destructive: false,
      details: [
        `候选点检 ${plan.changes.length} 条`,
        `无截止日 ${plan.withoutDeadline} 条（合法，不自动补写）`,
        '仅规范空状态、非法顺序、空审计时间和空字符串截止日',
      ],
    };
  }
  if (plan.task === 'list-org-references') {
    return {
      task: 'list-org-references',
      changeCount: plan.changes.length,
      destructive: false,
      details: [
        `待清理 IssueList ${plan.changes.length} 条`,
        '旧版 UI、权限、筛选和更新流程均未使用 orgUnitId',
        '仅将插件列表表的历史组织引用置空，不修改 Host 组织',
      ],
    };
  }
  return {
    task: 'links',
    changeCount:
      plan.repair.missing.length +
      plan.repair.duplicateIds.length +
      plan.repair.listCounts.length,
    destructive: plan.repair.duplicateIds.length > 0,
    details: [
      `待补建 ${plan.repair.missing.length} 条`,
      `待去重 ${plan.repair.duplicateIds.length} 条`,
      `待校正关联计数 ${plan.repair.listCounts.length} 条`,
    ],
  };
}

@Provide()
export class OpenIssueMaintenanceService {
  @Inject()
  access: OpenIssueAccessService;

  @InjectDataSource()
  dataSource: DataSource;

  @InjectEntityModel(OpenIssueCheckpointEntity)
  checkpointRepository: Repository<OpenIssueCheckpointEntity>;

  @InjectEntityModel(OpenIssueEntity)
  issueRepository: Repository<OpenIssueEntity>;

  @InjectEntityModel(OpenIssueListEntity)
  issueListRepository: Repository<OpenIssueListEntity>;

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  @InjectEntityModel(OpenIssueRepairLedgerEntity)
  repairLedgerRepository: Repository<OpenIssueRepairLedgerEntity>;

  tasks() {
    return [
      {
        id: 'checkpoints',
        title: '点检数据修正',
        description: '规范空状态、顺序、审计时间和空截止日；不会生成截止日。',
      },
      {
        id: 'links',
        title: 'Issue 链接修正',
        description: '补原始归属链接、移除重复链接并校正 Issue 关联计数。',
      },
      {
        id: 'list-org-references',
        title: 'IssueList 历史组织引用清理',
        description: '移除旧版未使用的列表组织引用；不修改或导入 Host 组织。',
      },
    ];
  }

  private ledgerPageValue(
    value: unknown,
    fallback: number,
    label: string,
    maximum: number
  ) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
      throw new CoolCommException(`${label}必须是 1-${maximum} 的整数`, 400);
    }
    return parsed;
  }

  /**
   * Returns audit metadata only. The before/result snapshots stay server-side
   * because they may contain business rows and are not needed by the list UI.
   */
  async ledger(
    pageValue: unknown,
    sizeValue: unknown
  ): Promise<OpenIssueRepairLedgerPage> {
    const page = this.ledgerPageValue(pageValue, 1, '页码', 10_000);
    const size = this.ledgerPageValue(sizeValue, 20, '每页数量', 100);
    const [rows, total] = await this.repairLedgerRepository.findAndCount({
      select: {
        id: true,
        task: true,
        planFingerprint: true,
        actorId: true,
        status: true,
        error: true,
        startedAt: true,
        finishedAt: true,
      },
      order: { startedAt: 'DESC', id: 'DESC' },
      skip: (page - 1) * size,
      take: size,
    });
    return {
      list: rows.map(row => ({
        id: row.id,
        task: row.task as OpenIssueRepairTask,
        planFingerprint: row.planFingerprint,
        actorId: row.actorId,
        status: row.status,
        error: row.error ? row.error.slice(0, 500) : null,
        startedAt: row.startedAt,
        finishedAt: row.finishedAt,
      })),
      page,
      size,
      total,
    };
  }

  private repositories(manager?: EntityManager) {
    return {
      checkpoints: manager
        ? manager.getRepository(OpenIssueCheckpointEntity)
        : this.checkpointRepository,
      issues: manager
        ? manager.getRepository(OpenIssueEntity)
        : this.issueRepository,
      links: manager
        ? manager.getRepository(OpenIssueListLinkEntity)
        : this.linkRepository,
      lists: manager
        ? manager.getRepository(OpenIssueListEntity)
        : this.issueListRepository,
    };
  }

  private async buildPlans(
    task: OpenIssueRepairTask,
    generatedAt: string,
    manager?: EntityManager
  ): Promise<OpenIssueInternalPlan[]> {
    const repositories = this.repositories(manager);
    const tasks = task === 'all' ? OPEN_ISSUE_REPAIR_TASKS : [task];
    const plans: OpenIssueInternalPlan[] = [];
    for (const item of tasks) {
      if (item === 'checkpoints') {
        const rows = await repositories.checkpoints.find();
        plans.push({
          task: 'checkpoints',
          changes: planCheckpointRepairs(rows, generatedAt),
          withoutDeadline: await repositories.checkpoints.countBy({
            deadline: IsNull(),
          }),
        });
        continue;
      }
      if (item === 'list-org-references') {
        plans.push({
          task: 'list-org-references',
          changes: planIssueListOrgReferenceRepair(await repositories.lists.find()),
        });
        continue;
      }
      const issues = (await repositories.issues.find()).sort((left, right) =>
        left.id.localeCompare(right.id)
      );
      const links = await repositories.links.find();
      const repair = planIssueLinkRepair(issues, links);
      const duplicateIds = new Set(repair.duplicateIds);
      plans.push({
        task: 'links',
        repair,
        duplicateLinks: links
          .filter(link => duplicateIds.has(link.id))
          .sort((left, right) => left.id.localeCompare(right.id)),
      });
    }
    return plans;
  }

  private normalizeTask(value: unknown): OpenIssueRepairTask {
    try {
      return normalizeRepairTask(value);
    } catch (error) {
      throw new CoolCommException(
        error instanceof Error ? error.message : '数据库修正任务无效',
        400
      );
    }
  }

  async plan(value: unknown): Promise<OpenIssueRepairPlanResponse> {
    const task = this.normalizeTask(value);
    const generatedAt = new Date().toISOString();
    const plans = await this.buildPlans(task, generatedAt);
    return {
      task,
      fingerprint: fingerprintPlan(task, generatedAt, plans),
      generatedAt,
      expiresAt: new Date(
        Date.parse(generatedAt) + REPAIR_PLAN_TTL_MS
      ).toISOString(),
      plans: plans.map(planSummary),
    };
  }

  private validateExecutionOptions(options: RepairExecutionOptions) {
    if (options.confirmed !== true) {
      throw new CoolCommException('必须先查看 dry-run 并明确确认', 400);
    }
    if (
      typeof options.fingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(options.fingerprint)
    ) {
      throw new CoolCommException('修正计划指纹无效', 400);
    }
    if (typeof options.generatedAt !== 'string') {
      throw new CoolCommException('修正计划时间无效', 400);
    }
    const generatedAtMs = Date.parse(options.generatedAt);
    const age = Date.now() - generatedAtMs;
    if (
      !Number.isFinite(generatedAtMs) ||
      age < -60_000 ||
      age > REPAIR_PLAN_TTL_MS
    ) {
      throw new CoolCommException('修正计划已过期，请重新 dry-run', 409);
    }
    return {
      fingerprint: options.fingerprint,
      generatedAt: options.generatedAt,
    };
  }

  private async executePlans(
    plans: OpenIssueInternalPlan[],
    manager: EntityManager,
    ledgerId: string
  ) {
    const results: OpenIssueRepairResult[] = [];
    const resultSnapshot: Record<string, unknown> = { insertedLinks: [] };
    for (const plan of plans) {
      if (plan.task === 'checkpoints') {
        const repository = manager.getRepository(OpenIssueCheckpointEntity);
        for (const change of plan.changes) {
          await repository.update({ id: change.id }, change.patch);
        }
        results.push({
          task: 'checkpoints',
          message: plan.changes.length
            ? `已修正 ${plan.changes.length} 条点检记录`
            : '点检数据已是最新',
          details: planSummary(plan).details,
          fixed: plan.changes.length,
          ledgerId,
        });
        continue;
      }

      if (plan.task === 'list-org-references') {
        const repository = manager.getRepository(OpenIssueListEntity);
        for (const change of plan.changes) {
          await repository.update({ id: change.id }, { orgUnitId: null });
        }
        results.push({
          task: 'list-org-references',
          message: plan.changes.length
            ? `已清理 ${plan.changes.length} 条 IssueList 历史组织引用`
            : 'IssueList 已无历史组织引用',
          details: planSummary(plan).details,
          fixed: plan.changes.length,
          ledgerId,
        });
        continue;
      }

      const linkRepository = manager.getRepository(OpenIssueListLinkEntity);
      const issueRepository = manager.getRepository(OpenIssueEntity);
      if (plan.repair.duplicateIds.length) {
        await linkRepository.delete({ id: In(plan.repair.duplicateIds) });
      }
      const insertedLinks = plan.repair.missing.map(item => ({
        id: randomUUID(),
        ...item,
        attentionLevel: 3,
        attentionUpdatedAt: null,
        attentionUpdatedBy: null,
      }));
      if (insertedLinks.length) {
        await linkRepository.save(
          insertedLinks.map(item => linkRepository.create(item))
        );
      }
      for (const item of plan.repair.listCounts) {
        await issueRepository.update(
          { id: item.issueId },
          { listCount: item.listCount, updatedAt: new Date().toISOString() }
        );
      }
      resultSnapshot.insertedLinks = insertedLinks;
      const fixed =
        insertedLinks.length +
        plan.repair.duplicateIds.length +
        plan.repair.listCounts.length;
      results.push({
        task: 'links',
        message: fixed ? `已修正 ${fixed} 项 Issue 链接数据` : 'Issue 链接数据完整',
        details: planSummary(plan).details,
        fixed,
        ledgerId,
      });
    }
    return { results, resultSnapshot };
  }

  async run(
    value: unknown,
    options: RepairExecutionOptions
  ): Promise<OpenIssueRepairResult[]> {
    const actorId = this.access.actorId();
    const task = this.normalizeTask(value);
    const expected = this.validateExecutionOptions(options);
    const ledgerId = randomUUID();
    const startedAt = new Date().toISOString();
    const observedPlans = await this.buildPlans(task, expected.generatedAt);
    const observedFingerprint = fingerprintPlan(
      task,
      expected.generatedAt,
      observedPlans
    );
    await this.repairLedgerRepository.save(
      this.repairLedgerRepository.create({
        id: ledgerId,
        task,
        planFingerprint: expected.fingerprint,
        actorId,
        status: 'running',
        planSnapshot: {
          task,
          generatedAt: expected.generatedAt,
          expectedFingerprint: expected.fingerprint,
          observedFingerprint,
          plans: observedPlans,
        },
        resultSnapshot: null,
        error: null,
        startedAt,
        finishedAt: null,
      })
    );

    try {
      if (observedFingerprint !== expected.fingerprint) {
        throw new CoolCommException(
          '数据已变化，dry-run 计划失效，请重新检查并确认',
          409
        );
      }
      const execution = await this.dataSource.transaction(
        'SERIALIZABLE',
        async manager => {
          const plans = await this.buildPlans(
            task,
            expected.generatedAt,
            manager
          );
          const actualFingerprint = fingerprintPlan(
            task,
            expected.generatedAt,
            plans
          );
          if (actualFingerprint !== expected.fingerprint) {
            throw new CoolCommException(
              '数据已变化，dry-run 计划失效，请重新检查并确认',
              409
            );
          }
          const execution = await this.executePlans(plans, manager, ledgerId);
          await manager.getRepository(OpenIssueRepairLedgerEntity).update(
            { id: ledgerId },
            {
              status: 'succeeded',
              resultSnapshot: execution.resultSnapshot,
              finishedAt: new Date().toISOString(),
            }
          );
          return execution;
        }
      );
      return execution.results;
    } catch (error) {
      await this.repairLedgerRepository.update(
        { id: ledgerId },
        {
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          finishedAt: new Date().toISOString(),
        }
      );
      throw error;
    }
  }
}
