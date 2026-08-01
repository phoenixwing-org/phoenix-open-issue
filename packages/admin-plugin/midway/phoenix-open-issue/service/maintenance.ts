import { randomUUID } from 'node:crypto';
import { Inject, Provide } from '@midwayjs/core';
import { InjectDataSource, InjectEntityModel } from '@midwayjs/typeorm';
import { CoolCommException } from '@cool-midway/core';
import { DataSource, In, IsNull, Repository } from 'typeorm';
import {
  normalizeRepairTask,
  OPEN_ISSUE_REPAIR_TASKS,
  planCheckpointRepair,
  planIssueLinkRepair,
  type OpenIssueRepairTask,
} from '../domain/maintenance';
import { OpenIssueCheckpointEntity } from '../entity/checkpoint';
import { OpenIssueEntity } from '../entity/issue';
import { OpenIssueListLinkEntity } from '../entity/issue-list-link';
import { OpenIssueAccessService } from './access';

export interface OpenIssueRepairResult {
  task: OpenIssueRepairTask;
  message: string;
  details: string[];
  fixed: number;
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

  @InjectEntityModel(OpenIssueListLinkEntity)
  linkRepository: Repository<OpenIssueListLinkEntity>;

  private assertAdmin(): void {
    if (!this.access.isSystemAdmin())
      throw new CoolCommException('仅 Host 系统管理员可执行数据修正', 403);
  }

  tasks() {
    this.assertAdmin();
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
    ];
  }

  async repairCheckpoints(): Promise<OpenIssueRepairResult> {
    this.assertAdmin();
    const now = new Date().toISOString();
    const rows = await this.checkpointRepository.find();
    let fixed = 0;
    for (const row of rows) {
      const patch = planCheckpointRepair(row, now);
      if (Object.keys(patch).length === 0) continue;
      await this.checkpointRepository.update({ id: row.id }, patch);
      fixed++;
    }
    const withoutDeadline = await this.checkpointRepository.countBy({
      deadline: IsNull(),
    });
    return {
      task: 'checkpoints',
      message: fixed ? `已修正 ${fixed} 条点检记录` : '点检数据已是最新',
      details: [
        `无截止日 ${withoutDeadline} 条（合法，不自动补写）`,
        'checkpointDate 负责时间线排序；deadline 只负责截止与逾期',
      ],
      fixed,
    };
  }

  async repairLinks(): Promise<OpenIssueRepairResult> {
    this.assertAdmin();
    const issues = await this.issueRepository.find();
    const links = await this.linkRepository.find();
    const plan = planIssueLinkRepair(issues, links);
    await this.dataSource.transaction(async manager => {
      const linkRepository = manager.getRepository(OpenIssueListLinkEntity);
      const issueRepository = manager.getRepository(OpenIssueEntity);
      if (plan.duplicateIds.length) {
        await linkRepository.delete({ id: In(plan.duplicateIds) });
      }
      if (plan.missing.length) {
        await linkRepository.save(
          plan.missing.map(item =>
            linkRepository.create({
              id: randomUUID(),
              ...item,
              attentionLevel: 3,
              attentionUpdatedAt: null,
              attentionUpdatedBy: null,
            })
          )
        );
      }
      for (const item of plan.listCounts) {
        await issueRepository.update(
          { id: item.issueId },
          { listCount: item.listCount, updatedAt: new Date().toISOString() }
        );
      }
    });
    const fixed =
      plan.missing.length + plan.duplicateIds.length + plan.listCounts.length;
    return {
      task: 'links',
      message: fixed ? `已修正 ${fixed} 项 Issue 链接数据` : 'Issue 链接数据完整',
      details: [
        `补建 ${plan.missing.length} 条`,
        `去重 ${plan.duplicateIds.length} 条`,
        `关联计数校正 ${plan.listCounts.length} 条`,
      ],
      fixed,
    };
  }

  async run(value: unknown): Promise<OpenIssueRepairResult[]> {
    this.assertAdmin();
    let task: OpenIssueRepairTask;
    try {
      task = normalizeRepairTask(value);
    } catch (error) {
      throw new CoolCommException(
        error instanceof Error ? error.message : '数据库修正任务无效',
        400
      );
    }
    if (task === 'all') {
      const results: OpenIssueRepairResult[] = [];
      for (const item of OPEN_ISSUE_REPAIR_TASKS) {
        results.push(...(await this.run(item)));
      }
      return results;
    }
    if (task === 'checkpoints') return [await this.repairCheckpoints()];
    return [await this.repairLinks()];
  }
}
