import { describe, expect, it } from 'vitest';
import {
  canModifyIssue,
  normalizeAttentionLevel,
  normalizeIssueIds,
  normalizeIssueUpdateInput,
  normalizeNewIssueInput,
} from '../../midway/phoenix-open-issue/domain/issue';
import {
  normalizeCheckpointUpdateInput,
  normalizeNewCheckpointInput,
} from '../../midway/phoenix-open-issue/domain/checkpoint';

describe('Issue 插件后端领域算法', () => {
  it('规范化创建数据并保持 legacy 默认值', () => {
    expect(normalizeNewIssueInput({ title: '  现场漏装  ', reporterId: 1 })).toEqual({
      title: '现场漏装',
      issueNo: undefined,
      description: '',
      priority: 'medium',
      severity: 'minor',
      category: null,
      detectionPhase: null,
      reporterId: '1',
      assigneeId: null,
      dueDate: null,
      functionId: null,
    });
  });

  it('校验枚举、Host 用户与真实日历日期', () => {
    expect(() => normalizeNewIssueInput({ title: 'A', severity: 'unknown' })).toThrow('重要度无效');
    expect(() => normalizeNewIssueInput({ title: 'A', assigneeId: 'legacy-user' })).toThrow('Host 用户 ID');
    expect(() => normalizeNewIssueInput({ title: 'A', dueDate: '2026-02-30' })).toThrow('截止日无效');
  });

  it('更新允许显式清空可选字段但拒绝空更新', () => {
    expect(normalizeIssueUpdateInput({ dueDate: '', category: null })).toEqual({ dueDate: null, category: null });
    expect(() => normalizeIssueUpdateInput({})).toThrow('没有可更新的字段');
  });

  it('关注度限制在 legacy 的 0 至 5 范围', () => {
    expect(normalizeAttentionLevel(8)).toBe(5);
    expect(normalizeAttentionLevel(-1)).toBe(0);
    expect(normalizeAttentionLevel(2.6)).toBe(3);
  });

  it('排序输入拒绝空值和重复 Issue', () => {
    expect(normalizeIssueIds(['a', 'b'])).toEqual(['a', 'b']);
    expect(() => normalizeIssueIds(['a', 'a'])).toThrow('重复');
  });

  it('沿用 owner/admin/editor 的修改权限', () => {
    expect(canModifyIssue('editor', false)).toBe(true);
    expect(canModifyIssue('reporter', false)).toBe(false);
    expect(canModifyIssue(null, true)).toBe(true);
  });
});

describe('Issue 点检领域算法', () => {
  it('规范化新增点检', () => {
    expect(normalizeNewCheckpointInput({
      checkpointDate: '2026-08-01',
      description: '  复查临时措施  ',
      responsibleUserId: 1,
    })).toEqual({
      checkpointDate: '2026-08-01',
      deadline: null,
      description: '复查临时措施',
      responsibleUserId: '1',
    });
  });

  it('更新可显式清空截止日并校验状态', () => {
    expect(normalizeCheckpointUpdateInput({ deadline: '', status: 'done' })).toEqual({ deadline: null, status: 'done' });
    expect(() => normalizeCheckpointUpdateInput({ status: 'unknown' })).toThrow('点检状态无效');
  });
});
