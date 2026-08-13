import { describe, expect, it, vi } from 'vitest';
import { OpenIssueListService } from '../../../midway/phoenix-open-issue/service/issue-list';
import {
  OpenIssueHostUserService,
  hostUserLabel,
  toHostUserIdentity,
} from '../../../midway/phoenix-open-issue/service/host-user';
import {
  formatUserLabel,
  resolveUserLabel,
} from '../../../vue/phoenix-open-issue/core/utils/user-label';

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
  const members = [
    { id: 'member-1', listId: 'list-1', userId: '1', role: 'owner', joinedAt: '2026-08-01' },
    { id: 'member-2', listId: 'list-1', userId: '2', role: 'editor', joinedAt: '2026-08-02' },
    { id: 'member-3', listId: 'list-1', userId: '999', role: 'viewer', joinedAt: '2026-08-03' },
  ];
  const identities = vi.fn(async () => new Map([
    ['1', { id: '1', username: 'admin', displayName: '管理员', status: 1 }],
    ['2', { id: '2', username: 'lisi', displayName: '李四', status: 1 }],
  ]));
  Object.assign(service, {
    ctx: { admin: { userId: 1, username: 'admin' } },
    memberRepository: { find: vi.fn(async (options: any) => options?.order ? members : []) },
    issueLinkRepository: { createQueryBuilder: vi.fn(() => issueCountQuery) },
    hostUserService: { names, identities },
  });
  return { service, names, identities };
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

  it('成员接口批量解析 Host 姓名与账号，未知引用才回退到 ID', async () => {
    const { service, identities } = serviceFixture();
    Object.assign(service, {
      requiredList: vi.fn(async () => ({ id: 'list-1', ownerId: '1' })),
      assertReadable: vi.fn(async () => undefined),
    });

    const result = await service.members('list-1');

    expect(identities).toHaveBeenCalledWith(['1', '2', '999']);
    expect(result).toEqual([
      expect.objectContaining({ userId: '1', username: 'admin', displayName: '管理员' }),
      expect.objectContaining({ userId: '2', username: 'lisi', displayName: '李四' }),
      expect.objectContaining({ userId: '999', username: '', displayName: null }),
    ]);
  });
});

describe('Host 用户展示身份', () => {
  it('以 Host 姓名为显示名，并保留账号作为稳定辅助标识', () => {
    const row = { id: 2, username: 'lisi', name: ' 李四 ', nickName: '小李', status: 1 };
    expect(toHostUserIdentity(row)).toEqual({
      id: '2',
      username: 'lisi',
      displayName: '李四',
      status: 1,
    });
    expect(hostUserLabel(row)).toBe('李四（lisi）');
    expect(formatUserLabel({ displayName: '李四', username: 'lisi' })).toBe('李四（lisi）');
    expect(resolveUserLabel([{ id: 2, displayName: '李四', username: 'lisi' }], '2'))
      .toBe('李四（lisi）');
    expect(resolveUserLabel([], '999')).toBe('未知用户（ID 999）');
  });

  it('批量查询返回身份与“姓名（账号）”标签映射', async () => {
    const query = vi.fn(async () => [
      { id: 2, username: 'lisi', name: '李四', nickName: null, status: 1 },
      { id: 3, username: 'wangwu', name: null, nickName: '王五', status: 1 },
    ]);
    const service = new OpenIssueHostUserService();
    Object.assign(service, { dataSource: { query } });

    const identities = await service.identities(['2', '3', '2', null]);
    const names = await service.names(['2', '3']);

    expect(query.mock.calls[0][1]).toEqual([['2', '3']]);
    expect(identities.get('2')).toMatchObject({ username: 'lisi', displayName: '李四' });
    expect(names).toEqual(new Map([
      ['2', '李四（lisi）'],
      ['3', '王五（wangwu）'],
    ]));
  });
});
