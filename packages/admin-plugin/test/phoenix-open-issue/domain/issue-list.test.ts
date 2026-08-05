import { describe, expect, it } from 'vitest';
import {
  canManageIssueList,
  enrichIssueLists,
  normalizeHostUserId,
  normalizeIssueListMemberRole,
  normalizeIssueListUpdateInput,
  normalizeNewIssueListInput,
} from '../../../midway/phoenix-open-issue/domain/issue-list';

describe('Issue 列表领域算法', () => {
  it('规范化创建输入且不带入独立版数据库字段', () => {
    expect(
      normalizeNewIssueListInput({
        name: '  七月点检  ',
        description: '  现场整改  ',
        listType: ' monthly ',
        orgUnitId: '',
        ownerId: '伪造值',
      }),
    ).toEqual({
      name: '七月点检',
      description: '现场整改',
      listType: 'monthly',
      orgUnitId: null,
    });
  });

  it('拒绝空更新，避免无意义写入', () => {
    expect(() => normalizeIssueListUpdateInput({})).toThrow('没有可更新的字段');
  });

  it('把权限和计数作为衍生数据集中计算', () => {
    const result = enrichIssueLists(
      [
        { id: 'a', ownerId: 'u1', name: 'A' },
        { id: 'b', ownerId: 'u2', name: 'B' },
      ],
      [
        { listId: 'a', userId: 'u1', role: 'owner' },
        { listId: 'a', userId: 'u2', role: 'viewer' },
        { listId: 'b', userId: 'u1', role: 'admin' },
      ],
      'u1',
      { a: 3 },
    );

    expect(result).toEqual([
      expect.objectContaining({ id: 'a', memberCount: 2, issueCount: 3, myRole: 'owner' }),
      expect.objectContaining({ id: 'b', memberCount: 1, issueCount: 0, myRole: 'admin' }),
    ]);
  });

  it('只有 Host 管理员或列表 owner/admin 可以管理列表', () => {
    expect(canManageIssueList('owner', false)).toBe(true);
    expect(canManageIssueList('admin', false)).toBe(true);
    expect(canManageIssueList('editor', false)).toBe(false);
    expect(canManageIssueList(null, true)).toBe(true);
  });

  it('成员边界只接受 Host 数字用户 ID 和已声明角色', () => {
    expect(normalizeHostUserId(12)).toBe('12');
    expect(normalizeIssueListMemberRole('reporter')).toBe('reporter');
    expect(() => normalizeHostUserId('legacy-user')).toThrow('Host 用户 ID 无效');
    expect(() => normalizeIssueListMemberRole('superuser')).toThrow('成员角色无效');
  });
});
