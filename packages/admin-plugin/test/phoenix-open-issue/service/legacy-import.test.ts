import { describe, expect, it, vi } from 'vitest';
import type { DataSource } from 'typeorm';
import {
  OpenIssueLegacyImportHostReferenceGate,
  OpenIssueLegacyImportService,
} from '../../../midway/phoenix-open-issue/service/legacy-import';

const at = '2026-08-03T22:45:23.638Z';

function request() {
  return {
    package: {
      dataset: 'phoenix-open-issue-business-v1',
      source: {
        version: 1,
        timestamp: at,
        exportScope: 'full',
        rawSha256: 'a'.repeat(64),
      },
      tables: {
        issueLists: [{
          id: 'list-1', name: '列表', description: '', listType: 'project',
          ownerId: 'legacy-user', orgUnitId: 'legacy-org', archived: 0,
          isDeleted: 0, deletedAt: null, createdAt: at, updatedAt: at,
        }],
        issueListMembers: [{
          id: 'member-1', listId: 'list-1', userId: 'legacy-user',
          role: 'owner', joinedAt: at,
        }],
        issues: [{
          id: 'issue-1', listId: 'list-1', issueNo: 'ISSUE-1', title: '问题',
          description: '', status: 'open', closeReason: null, closedBy: null,
          priority: 'high', severity: 'major', category: 'function',
          detectionPhase: 'system_test', reporterId: 'legacy-user',
          assigneeId: 'legacy-user', dueDate: null, completedAt: null,
          sortOrder: 0, extensions: {}, listCount: 99, createdBy: 'legacy-user',
          createdAt: at, updatedAt: at, functionId: 'function-1',
          containment: '围堵', rootCause: '根因', correctiveAction: '措施',
        }],
        issueListLinks: [{
          id: 'link-1', issueId: 'issue-1', listId: 'list-1', attentionLevel: 3,
          attentionUpdatedAt: null, attentionUpdatedBy: null,
          linkedAt: at, linkedBy: 'legacy-user',
        }],
        checkpoints: [{
          id: 'checkpoint-1', issueId: 'issue-1', checkpointDate: '2026-08-03',
          deadline: null, description: '点检', status: 'pending',
          responsibleUserId: 'legacy-user', sortOrder: 0, createdAt: at, updatedAt: at,
        }],
        eightDReports: [{
          id: 'report-1', relatedIssueId: 'issue-1', title: '8D', containment: '围堵',
          rootCause: '根因', correctiveAction: '措施', createdBy: 'legacy-user',
          createdAt: at, updatedAt: at, isDeleted: 0, deletedAt: null,
        }],
        pushRecords: [{
          id: 'push-1', fromListId: 'list-1', targetType: 'list', toListId: 'list-1',
          toUserId: null, issueId: 'issue-1', pushedBy: 'legacy-user', pushedAt: at,
          status: 'accepted', handledBy: 'legacy-user', handledAt: at,
          rejectReason: null, note: '',
        }],
        poiFunctions: [{
          id: 'function-1', platform: 'platform', externalId: 'external-1',
          functionName: '功能', targetYear: null, clientGroup: null,
          developGroup: null, enabled: 1, createdAt: at, updatedAt: at,
        }],
      },
    },
    mappings: {
      users: { 'legacy-user': '101' },
      orgUnits: { 'legacy-org': '201' },
    },
  };
}

function serviceWithQuery(
  override?: (sql: string, parameters: unknown[] | undefined) => unknown[] | undefined,
  verifyHostReferences: () => Promise<void> = async () => undefined,
) {
  const service = new OpenIssueLegacyImportService();
  service.access = { isHostRoot: () => true } as never;
  service.hostReferenceGate = { verify: verifyHostReferences } as never;
  service.dataSource = {
    query: vi.fn(async (sql: string, parameters?: unknown[]) => {
      const overridden = override?.(sql, parameters);
      if (overridden) return overridden;
      if (sql.includes('current_database()')) return [{ database: 'open_issue', schema: 'public' }];
      if (sql.includes('COUNT(*)')) return [{ count: 0 }];
      return [];
    }),
  } as unknown as DataSource;
  return service;
}

describe('OpenIssueLegacyImportService', () => {
  it('生成可一次认领但仍禁止执行的 15 分钟只读计划', async () => {
    const service = serviceWithQuery();
    const plan = await service.plan(request());

    expect(plan.dryRun).toBe(true);
    expect(plan.planId).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan.validationBlockers).toEqual([]);
    expect(plan.businessSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.mappingSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(plan.executionAllowed).toBe(true);
    expect(plan.executionBlockers).toEqual([]);
    expect(plan.gates).toEqual({
      packageValidated: true,
      hostMappingsValidated: true,
      targetConflictFree: true,
      trustedBackupVerifier: false,
      restoreRehearsalVerifier: false,
      manualBackupConfirmationRequired: true,
      transactionExecutor: true,
    });

    const nextRequestService = serviceWithQuery();
    const prepared = nextRequestService.claimPreparedPlan(plan.planId!);
    expect(prepared.sourceSha256).toBe('a'.repeat(64));
    expect(prepared.businessSha256).toBe(plan.businessSha256);
    expect(prepared.mappingSha256).toBe(plan.mappingSha256);
    expect(prepared.tables.issues).toHaveLength(1);
    expect(() => service.claimPreparedPlan(plan.planId!)).toThrow(/已过期或已认领/);
  });

  it('用户映射不完整时阻断；相同 Issue 编号则简单合并并继续计划', async () => {
    const missingMappingRequest = request();
    missingMappingRequest.mappings.users = {};
    const incomplete = serviceWithQuery();
    const incompletePlan = await incomplete.plan(missingMappingRequest);
    expect(incompletePlan.planId).toBeNull();
    expect(incompletePlan.validationBlockers).toContain('legacy 用户 legacy-user 尚未映射');

    const conflicted = serviceWithQuery(sql =>
      sql.includes('SELECT id, "issueNo"')
        ? [{ id: 'target-issue', issueNo: 'ISSUE-1' }]
        : undefined
    );
    const mergedPlan = await conflicted.plan(request());
    expect(mergedPlan.validationBlockers).toEqual([]);
    expect(mergedPlan.planId).toMatch(/^[0-9a-f-]{36}$/);
    expect(mergedPlan.targetConflicts).toEqual([]);
    expect(mergedPlan.insertCounts.issues).toBe(0);
    expect(mergedPlan.skippedExisting).toContainEqual({
      table: 'issues', sourceId: 'issue-1', targetId: 'target-issue',
      reason: 'issueNo', value: 'ISSUE-1',
    });
    const prepared = conflicted.claimPreparedPlan(mergedPlan.planId!);
    expect(prepared.tables.issueListLinks[0]?.issueId).toBe('target-issue');
    expect(prepared.tables.checkpoints[0]?.issueId).toBe('target-issue');
    expect(prepared.tables.eightDReports[0]?.relatedIssueId).toBe('target-issue');
    expect(prepared.tables.pushRecords[0]?.issueId).toBe('target-issue');
  });

  it('相同 ID 的核心测试数据列明后跳过且仍签发其他数据计划', async () => {
    const service = serviceWithQuery(sql =>
      sql.includes('SELECT id FROM oip_checkpoint WHERE id')
        ? [{ id: 'checkpoint-1' }]
        : undefined
    );

    const plan = await service.plan(request());

    expect(plan.validationBlockers).toEqual([]);
    expect(plan.targetConflicts).toEqual([]);
    expect(plan.planId).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan.executionAllowed).toBe(true);
    expect(plan.insertCounts.checkpoints).toBe(0);
    expect(plan.skippedExisting).toContainEqual({
      table: 'checkpoints', sourceId: 'checkpoint-1', targetId: 'checkpoint-1', reason: 'id',
    });
    expect(plan.warnings).toContain(
      '1 条核心业务记录已存在；保留目标记录并跳过重复源行'
    );
    expect(service.claimPreparedPlan(plan.planId!).tables.issues).toHaveLength(1);
  });

  it('重复成员、链接和功能逐条跳过，并把 Issue 功能引用映射到现有目标', async () => {
    const service = serviceWithQuery(sql => {
      if (sql.includes('SELECT id, "listId", "userId"')) {
        return [{ id: 'target-member', listId: 'list-1', userId: '101' }];
      }
      if (sql.includes('SELECT id, "issueId", "listId"')) {
        return [{ id: 'target-link', issueId: 'issue-1', listId: 'list-1' }];
      }
      if (sql.includes('SELECT id, platform, "externalId"')) {
        return [{ id: 'target-function', platform: 'platform', externalId: 'external-1' }];
      }
      return undefined;
    });

    const plan = await service.plan(request());

    expect(plan.validationBlockers).toEqual([]);
    expect(plan.planId).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan.insertCounts.issueListMembers).toBe(0);
    expect(plan.insertCounts.issueListLinks).toBe(0);
    expect(plan.insertCounts.poiFunctions).toBe(0);
    expect(plan.skippedExisting).toEqual(expect.arrayContaining([
      {
        table: 'issueListMembers', sourceId: 'member-1', targetId: 'target-member',
        reason: 'member',
      },
      {
        table: 'issueListLinks', sourceId: 'link-1', targetId: 'target-link', reason: 'link',
      },
      {
        table: 'poiFunctions', sourceId: 'function-1', targetId: 'target-function',
        reason: 'function',
      },
    ]));
    const prepared = service.claimPreparedPlan(plan.planId!);
    expect(prepared.tables.issues[0]?.functionId).toBe('target-function');
  });

  it('只有人工确认备份后二次确认才按依赖顺序写入核心事务与可选 8D 事务', async () => {
    const service = serviceWithQuery();
    const plan = await service.plan(request());
    await expect(service.execute(plan.planId, {
      confirmed: true,
      backupConfirmed: false,
    })).rejects.toThrow(/可恢复的 PostgreSQL 备份/);

    const transactionGroups: string[][] = [];
    let activeGroup: string[] = [];
    let currentTable = '';
    const builder = {
      insert: vi.fn(() => builder),
      into: vi.fn((table: string) => {
        currentTable = table;
        return builder;
      }),
      values: vi.fn(() => builder),
      execute: vi.fn(async () => {
        activeGroup.push(currentTable);
        return {};
      }),
    };
    (service.dataSource as unknown as {
      transaction: (run: (manager: { createQueryBuilder: () => typeof builder }) => Promise<void>) => Promise<void>;
    }).transaction = async run => {
      activeGroup = [];
      transactionGroups.push(activeGroup);
      await run({ createQueryBuilder: () => builder });
    };

    const result = await service.execute(plan.planId, {
      confirmed: true,
      backupConfirmed: true,
    });

    expect(transactionGroups).toEqual([
      [
        'oip_function',
        'oip_issue_list',
        'oip_issue_list_member',
        'oip_issue',
        'oip_issue_list_link',
        'oip_checkpoint',
        'oip_push_record',
      ],
      ['oip_eight_d_report'],
    ]);
    expect(result.totalInserted).toBe(8);
    expect(result.warnings).toEqual([]);
    expect(() => service.claimPreparedPlan(plan.planId!)).toThrow(/已过期或已认领/);
  });

  it('8D 可选事务失败时保留已提交核心业务并返回明确提示', async () => {
    const service = serviceWithQuery();
    const plan = await service.plan(request());
    const coreTables: string[] = [];
    let currentTable = '';
    let transactionCount = 0;
    const builder = {
      insert: vi.fn(() => builder),
      into: vi.fn((table: string) => {
        currentTable = table;
        return builder;
      }),
      values: vi.fn(() => builder),
      execute: vi.fn(async () => {
        coreTables.push(currentTable);
        return {};
      }),
    };
    (service.dataSource as unknown as {
      transaction: (run: (manager: { createQueryBuilder: () => typeof builder }) => Promise<void>) => Promise<void>;
    }).transaction = async run => {
      transactionCount += 1;
      if (transactionCount === 2) throw new Error('optional 8D insert failed');
      await run({ createQueryBuilder: () => builder });
    };

    const result = await service.execute(plan.planId, {
      confirmed: true,
      backupConfirmed: true,
    });

    expect(coreTables).toEqual([
      'oip_function',
      'oip_issue_list',
      'oip_issue_list_member',
      'oip_issue',
      'oip_issue_list_link',
      'oip_checkpoint',
      'oip_push_record',
    ]);
    expect(result.inserted.eightDReports).toBe(0);
    expect(result.totalInserted).toBe(7);
    expect(result.warnings).toEqual([
      '8D 可选导入失败，已跳过 1 条；核心业务事务已提交',
    ]);
  });

  it('8D 目标记录按 ID 优先、否则按内容签名跳过且不形成核心冲突', async () => {
    const input = request();
    input.package.tables.eightDReports.push({
      id: 'report-2', relatedIssueId: 'issue-1', title: '8D 第二版', containment: '围堵 2',
      rootCause: '根因 2', correctiveAction: '措施 2', createdBy: 'legacy-user',
      createdAt: at, updatedAt: at, isDeleted: 0, deletedAt: null,
    });
    const service = serviceWithQuery(sql => {
      if (sql.includes('SELECT id FROM oip_eight_d_report WHERE id')) {
        return [{ id: 'report-1' }];
      }
      if (sql.includes('SELECT id, "relatedIssueId", containment')) {
        return [{
          id: 'existing-report-2', relatedIssueId: 'issue-1', containment: '围堵 2',
          rootCause: '根因 2', correctiveAction: '措施 2',
        }];
      }
      return undefined;
    });

    const plan = await service.plan(input);

    expect(plan.validationBlockers).toEqual([]);
    expect(plan.targetConflicts).toEqual([]);
    expect(plan.skippedExisting).toEqual([
      { table: 'eightDReports', sourceId: 'report-1', targetId: 'report-1', reason: 'id' },
      {
        table: 'eightDReports', sourceId: 'report-2', targetId: 'existing-report-2',
        reason: 'content-signature',
      },
    ]);
    expect(plan.insertCounts.eightDReports).toBe(0);
    expect(service.claimPreparedPlan(plan.planId!).tables.eightDReports).toEqual([]);
  });

  it('8D 目标表不可用时跳过可选报告但仍签发核心业务只读计划', async () => {
    const service = serviceWithQuery(sql => {
      if (sql.includes('oip_eight_d_report')) throw new Error('8D table unavailable');
      return undefined;
    });

    const plan = await service.plan(request());

    expect(plan.validationBlockers).toEqual([]);
    expect(plan.planId).toMatch(/^[0-9a-f-]{36}$/);
    expect(plan.insertCounts.eightDReports).toBe(0);
    expect(plan.warnings).toContain(
      '8D 目标表或查重不可用，本阶段已跳过 1 条；不阻断核心业务迁移'
    );
  });

  it('拒绝非 Host 系统管理员预检服务端迁移', async () => {
    const service = serviceWithQuery();
    service.access = { isHostRoot: () => false } as never;
    await expect(service.plan(request())).rejects.toThrow(/仅 Host 系统管理员/);
  });

  it('Host 公共引用验证器默认 fail closed 且只能登记一次', async () => {
    const gate = new OpenIssueLegacyImportHostReferenceGate();
    const context = {
      moduleId: 'phoenix-open-issue' as const,
      sourceSha256: 'a'.repeat(64),
      userIds: ['101'],
      orgUnitIds: [],
    };
    await expect(gate.verify(context)).rejects.toThrow(/尚未接入/);

    const verifier = vi.fn(async () => undefined);
    gate.registerVerifier(verifier);
    await gate.verify(context);
    expect(verifier).toHaveBeenCalledWith(context);
    expect(() => gate.registerVerifier(async () => undefined)).toThrow(/已登记/);
  });
});
