import { describe, expect, it } from 'vitest';
import {
  normalizeRepairTask,
  planCheckpointRepair,
  planIssueLinkRepair,
} from '../../../midway/phoenix-open-issue/domain/maintenance';

describe('Issue 数据修正领域算法', () => {
  it('只接受插件声明的修正任务', () => {
    expect(normalizeRepairTask('checkpoints')).toBe('checkpoints');
    expect(normalizeRepairTask('all')).toBe('all');
    expect(() => normalizeRepairTask('schema')).toThrow('任务无效');
    expect(() => normalizeRepairTask('users')).toThrow('任务无效');
  });

  it('规范点检空值但不擅自生成截止日', () => {
    expect(
      planCheckpointRepair(
        {
          id: 'cp-1',
          status: '',
          sortOrder: null,
          deadline: ' ',
          createdAt: '',
          updatedAt: null,
        },
        '2026-08-01T00:00:00.000Z'
      )
    ).toEqual({
      status: 'pending',
      sortOrder: 0,
      deadline: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    });
  });

  it('完整点检不产生无意义更新', () => {
    expect(
      planCheckpointRepair(
        {
          id: 'cp-2',
          status: 'pending',
          sortOrder: 0,
          deadline: null,
          createdAt: '2026-08-01T00:00:00.000Z',
          updatedAt: '2026-08-01T00:00:00.000Z',
        },
        '2026-08-02T00:00:00.000Z'
      )
    ).toEqual({});
  });

  it('链接计划补原始归属、稳定去重并校正关联计数', () => {
    const plan = planIssueLinkRepair(
      [
        {
          id: 'issue-1',
          listId: 'list-a',
          listCount: 9,
          createdBy: '1',
          createdAt: '2026-08-01T01:00:00.000Z',
        },
        {
          id: 'issue-2',
          listId: 'list-b',
          listCount: 0,
          createdBy: '2',
          createdAt: '2026-08-01T02:00:00.000Z',
        },
      ],
      [
        {
          id: 'later',
          issueId: 'issue-1',
          listId: 'list-a',
          linkedAt: '2026-08-01T03:00:00.000Z',
        },
        {
          id: 'first',
          issueId: 'issue-1',
          listId: 'list-a',
          linkedAt: '2026-08-01T02:00:00.000Z',
        },
        {
          id: 'second-list',
          issueId: 'issue-1',
          listId: 'list-c',
          linkedAt: '2026-08-01T04:00:00.000Z',
        },
      ]
    );

    expect(plan.duplicateIds).toEqual(['later']);
    expect(plan.missing).toEqual([
      {
        issueId: 'issue-2',
        listId: 'list-b',
        linkedBy: '2',
        linkedAt: '2026-08-01T02:00:00.000Z',
      },
    ]);
    expect(plan.listCounts).toEqual([
      { issueId: 'issue-1', listCount: 2 },
      { issueId: 'issue-2', listCount: 1 },
    ]);
  });
});
