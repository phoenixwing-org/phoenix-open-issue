import { describe, expect, it, vi } from 'vitest';
import { OpenIssueListService } from '../../../midway/phoenix-open-issue/service/issue-list';

function serviceFixture() {
  const service = new OpenIssueListService();
  const issueCountQuery = {
    select: vi.fn().mockReturnThis(),
    addSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    getRawMany: vi.fn(async () => []),
  };
  const names = vi.fn(async () => new Map([
    ['1', 'admin'],
    ['2', 'Kevin'],
  ]));
  Object.assign(service, {
    ctx: { admin: { userId: 1, username: 'admin' } },
    memberRepository: { find: vi.fn(async () => []) },
    issueLinkRepository: { createQueryBuilder: vi.fn(() => issueCountQuery) },
    hostUserService: { names },
  });
  return { service, names };
}

describe('IssueList 负责人显示', () => {
  it('批量解析全部 Host 负责人，未知引用显示明确 ID 而不是空白', async () => {
    const { service, names } = serviceFixture();
    const lists = [
      { id: 'list-1', ownerId: '1' },
      { id: 'list-2', ownerId: '2' },
      { id: 'list-3', ownerId: '999' },
    ];

    const result = await (service as any).enrich(lists, '1');

    expect(names).toHaveBeenCalledWith(['1', '2', '999']);
    expect(result.map((item: any) => item.ownerName)).toEqual([
      'admin',
      'Kevin',
      '未知用户（ID 999）',
    ]);
  });
});
