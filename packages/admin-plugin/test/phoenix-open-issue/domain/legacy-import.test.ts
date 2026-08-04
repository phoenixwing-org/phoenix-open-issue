import { describe, expect, it } from 'vitest';
import {
  planLegacyBusinessImport,
  type LegacyImportMappings,
} from '../../../midway/phoenix-open-issue/domain/legacy-import';

const at = '2026-08-03T22:45:23.638Z';
const users = ['legacy-user-0', 'legacy-user-1', 'legacy-user-2', 'legacy-user-3'];

function businessPackage() {
  const issueLists = Array.from({ length: 4 }, (_, index) => ({
    id: `list-${index}`,
    name: `列表 ${index}`,
    description: '',
    listType: index === 3 ? 'project' : 'monthly',
    ownerId: users[index],
    orgUnitId: `legacy-org-${index % 3}`,
    archived: 0,
    isDeleted: 0,
    deletedAt: null,
    createdAt: at,
    updatedAt: at,
  }));
  const issues = Array.from({ length: 4 }, (_, index) => ({
    id: `issue-${index}`,
    listId: `list-${index}`,
    issueNo: `ISSUE-${index}`,
    title: `问题 ${index}`,
    description: '',
    status: index === 3 ? 'in_progress' : 'open',
    closeReason: null,
    closedBy: null,
    priority: index < 2 ? 'critical' : index === 2 ? 'high' : 'medium',
    severity: index < 2 ? 'fatal' : index === 2 ? 'major' : 'minor',
    category: 'function',
    detectionPhase: 'final',
    reporterId: users[index],
    assigneeId: users[(index + 1) % users.length],
    dueDate: null,
    completedAt: null,
    sortOrder: index,
    extensions: {},
    listCount: 99,
    createdBy: users[index],
    createdAt: at,
    updatedAt: at,
    functionId: 'function-1',
    containment: index < 3 ? `围堵 ${index}` : '',
    rootCause: index < 3 ? `根因 ${index}` : '',
    correctiveAction: index < 3 ? `措施 ${index}` : '',
  }));
  const linkPairs = [
    [0, 0], [0, 1], [1, 1], [1, 2], [2, 2], [2, 3], [3, 3],
  ];
  return {
    dataset: 'phoenix-open-issue-business-v1',
    source: {
      version: 1,
      timestamp: at,
      exportScope: 'full',
      rawSha256: 'a'.repeat(64),
    },
    tables: {
      issueLists,
      issueListMembers: [[0, 0], [1, 1], [2, 2], [3, 3], [0, 1], [1, 2]].map(([list, user], index) => ({
        id: `member-${index}`,
        listId: `list-${list}`,
        userId: users[user],
        role: index < 4 ? 'owner' : 'editor',
        joinedAt: at,
      })),
      issues,
      issueListLinks: linkPairs.map(([issue, list], index) => ({
        id: `link-${index}`,
        issueId: `issue-${issue}`,
        listId: `list-${list}`,
        attentionLevel: 3,
        attentionUpdatedAt: null,
        attentionUpdatedBy: null,
        linkedAt: at,
        linkedBy: users[issue],
      })),
      checkpoints: Array.from({ length: 12 }, (_, index) => ({
        id: `checkpoint-${index}`,
        issueId: `issue-${index % 4}`,
        checkpointDate: '2026-08-04',
        deadline: null,
        description: `点检 ${index}`,
        status: ['pending', 'done', 'skipped', 'voided'][index % 4],
        responsibleUserId: users[index % users.length],
        sortOrder: index,
        createdAt: at,
        updatedAt: at,
      })),
      eightDReports: Array.from({ length: 3 }, (_, index) => ({
        id: `report-${index}-${'x'.repeat(37)}`,
        relatedIssueId: `issue-${index}`,
        title: `8D ${index}`,
        containment: `围堵 ${index}`,
        rootCause: `根因 ${index}`,
        correctiveAction: `措施 ${index}`,
        createdBy: users[index],
        createdAt: at,
        updatedAt: at,
        isDeleted: 0,
        deletedAt: null,
      })),
      pushRecords: Array.from({ length: 4 }, (_, index) => ({
        id: `push-${index}`,
        fromListId: `list-${index}`,
        targetType: 'list',
        toListId: `list-${(index + 1) % 4}`,
        toUserId: null,
        issueId: `issue-${index}`,
        pushedBy: users[index],
        pushedAt: at,
        status: 'accepted',
        handledBy: users[(index + 1) % users.length],
        handledAt: at,
        rejectReason: null,
        note: '',
      })),
      poiFunctions: [{
        id: 'function-1',
        platform: 'CAD',
        externalId: '1',
        functionName: '功能 1',
        targetYear: '2026',
        clientGroup: null,
        developGroup: null,
        enabled: 1,
        createdAt: at,
        updatedAt: at,
      }],
    },
  };
}

function mappings(): LegacyImportMappings {
  return {
    users: Object.fromEntries(users.map((id, index) => [id, String(index + 1)])),
    orgUnits: {
      'legacy-org-0': '10',
      'legacy-org-1': '11',
      'legacy-org-2': '12',
    },
  };
}

describe('旧站业务数据服务端迁移计划', () => {
  it('规范 41 行、映射 Host 引用、重映射超长 8D ID并重算 listCount', () => {
    const plan = planLegacyBusinessImport({ package: businessPackage(), mappings: mappings() });

    expect(plan.blockers).toEqual([]);
    expect(plan.totalRows).toBe(41);
    expect(plan.userReferences).toHaveLength(4);
    expect(plan.orgUnitReferences).toEqual([]);
    expect(plan.idRemaps).toHaveLength(3);
    expect(plan.idRemaps.every(item => item.targetId.length === 36)).toBe(true);
    expect(plan.tables?.issueLists.map(row => row.ownerId)).toEqual(['1', '2', '3', '4']);
    expect(plan.tables?.issueLists.map(row => row.orgUnitId)).toEqual([null, null, null, null]);
    expect(plan.warnings).toContain('3 个 legacy 列表组织引用属于未使用历史字段，将统一移除');
    expect(plan.tables?.issues.map(row => row.listCount)).toEqual([2, 2, 2, 1]);
    expect(plan.tables?.issues[0]).not.toHaveProperty('containment');
  });

  it('相同源 ID 的确定性重映射结果稳定', () => {
    const first = planLegacyBusinessImport({ package: businessPackage(), mappings: mappings() });
    const second = planLegacyBusinessImport({ package: businessPackage(), mappings: mappings() });
    expect(first.idRemaps).toEqual(second.idRemaps);
  });

  it('缺少映射、未知字段或引用缺失时 fail closed', () => {
    const input = businessPackage();
    input.tables.issues[0].unexpected = true;
    input.tables.issueListLinks[0].issueId = 'missing';
    const plan = planLegacyBusinessImport({ package: input, mappings: { users: {}, orgUnits: {} } });

    expect(plan.tables).toBeNull();
    expect(plan.blockers).toEqual(expect.arrayContaining([
      'issues[0] 包含未知字段：unexpected',
      'issueListLinks.issueId 有 1 条引用缺失的Issue',
      'legacy 用户 legacy-user-0 尚未映射',
    ]));
  });

  it('独立 8D 与 Issue 内嵌内容不一致时以独立报告为准且不阻断核心业务', () => {
    const input = businessPackage();
    input.tables.eightDReports[0].rootCause = '不一致';
    const plan = planLegacyBusinessImport({ package: input, mappings: mappings() });

    expect(plan.blockers).toEqual([]);
    expect(plan.tables?.eightDReports[0].rootCause).toBe('不一致');
    expect(plan.warnings).toContain('3 个 Issue 同时含内嵌 8D；以独立 8D 报告为准');
  });

  it('缺少独立 8D 表时从 Issue 内嵌字段生成可选报告且不阻断核心业务', () => {
    const input = businessPackage();
    delete (input.tables as Record<string, unknown>).eightDReports;
    const plan = planLegacyBusinessImport({ package: input, mappings: mappings() });

    expect(plan.blockers).toEqual([]);
    expect(plan.totalRows).toBe(41);
    expect(plan.tables?.eightDReports).toHaveLength(3);
    expect(plan.tables?.eightDReports.every(row => String(row.id).length === 36)).toBe(true);
    expect(plan.warnings).toContain(
      'eightDReports 缺失或格式无效；将尝试从 Issue 内嵌字段生成，不阻断核心业务'
    );
    expect(plan.warnings).toContain('3 个 Issue 没有独立 8D 报告，已从内嵌字段生成可选报告');
  });
});
