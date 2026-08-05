export const ISSUE_STATUSES = [
  'open',
  'in_progress',
  'resolved',
  'closed',
  'cancelled',
] as const;
export const ISSUE_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const;
export const ISSUE_SEVERITIES = ['fatal', 'major', 'minor', 'trivial'] as const;
export const ISSUE_CATEGORIES = [
  'appearance',
  'dimension',
  'function',
  'process',
  'safety',
  'other',
] as const;
export const ISSUE_DETECTION_PHASES = [
  'incoming',
  'in_process',
  'final',
  'customer',
  'audit',
  'supplier',
] as const;

export type IssueStatus = (typeof ISSUE_STATUSES)[number];
export type IssuePriority = (typeof ISSUE_PRIORITIES)[number];
export type IssueSeverity = (typeof ISSUE_SEVERITIES)[number];
export type IssueCategory = (typeof ISSUE_CATEGORIES)[number];
export type IssueDetectionPhase = (typeof ISSUE_DETECTION_PHASES)[number];

export interface NewIssueInput {
  title: string;
  issueNo?: string;
  description: string;
  priority: IssuePriority;
  severity: IssueSeverity;
  category: IssueCategory | null;
  detectionPhase: IssueDetectionPhase | null;
  reporterId: string | null;
  assigneeId: string | null;
  dueDate: string | null;
  functionId: string | null;
}

export type IssueUpdateInput = Partial<NewIssueInput> & {
  status?: IssueStatus;
  closeReason?: string | null;
  closedBy?: string | null;
  completedAt?: string | null;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('请求数据无效');
  return value as Record<string, unknown>;
}

function requiredText(value: unknown, label: string, max: number): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > max)
    throw new Error(`${label}必须为 1 至 ${max} 个字符`);
  return result;
}

function optionalText(
  value: unknown,
  label: string,
  max: number
): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > max)
    throw new Error(`${label}不能超过 ${max} 个字符`);
  return value.trim();
}

function enumValue<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string
): T {
  if (typeof value !== 'string' || !values.includes(value as T))
    throw new Error(`${label}无效`);
  return value as T;
}

function optionalEnum<T extends string>(
  value: unknown,
  values: readonly T[],
  label: string
): T | null {
  if (value === undefined || value === null || value === '') return null;
  return enumValue(value, values, label);
}

export function normalizeHostUserReference(
  value: unknown,
  label: string
): string | null {
  const normalized =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : value;
  const result = optionalText(normalized, label, 64);
  if (result !== null && !/^\d+$/.test(result))
    throw new Error(`${label}必须是 Host 用户 ID`);
  return result;
}

export function normalizeDateOnly(
  value: unknown,
  label: string
): string | null {
  const result = optionalText(value, label, 10);
  if (result === null) return null;
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(result))
    throw new Error(`${label}必须为 YYYY-MM-DD`);
  const date = new Date(`${result}T00:00:00Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== result
  )
    throw new Error(`${label}无效`);
  return result;
}

export function normalizeNewIssueInput(value: unknown): NewIssueInput {
  const input = record(value);
  return {
    title: requiredText(input.title, '标题', 240),
    issueNo: optionalText(input.issueNo, '编号', 40) ?? undefined,
    description: optionalText(input.description, '描述', 10000) ?? '',
    priority:
      input.priority === undefined
        ? 'medium'
        : enumValue(input.priority, ISSUE_PRIORITIES, '紧急度'),
    severity:
      input.severity === undefined
        ? 'minor'
        : enumValue(input.severity, ISSUE_SEVERITIES, '重要度'),
    category: optionalEnum(input.category, ISSUE_CATEGORIES, '分类'),
    detectionPhase: optionalEnum(
      input.detectionPhase,
      ISSUE_DETECTION_PHASES,
      '发现阶段'
    ),
    reporterId: normalizeHostUserReference(input.reporterId, '提出人'),
    assigneeId: normalizeHostUserReference(input.assigneeId, '责任人'),
    dueDate: normalizeDateOnly(input.dueDate, '截止日'),
    functionId: optionalText(input.functionId, '功能 ID', 36),
  };
}

export function normalizeIssueUpdateInput(value: unknown): IssueUpdateInput {
  const input = record(value);
  const output: IssueUpdateInput = {};
  if ('title' in input) output.title = requiredText(input.title, '标题', 240);
  if ('issueNo' in input)
    output.issueNo = optionalText(input.issueNo, '编号', 40) ?? undefined;
  if ('description' in input)
    output.description = optionalText(input.description, '描述', 10000) ?? '';
  if ('priority' in input)
    output.priority = enumValue(input.priority, ISSUE_PRIORITIES, '紧急度');
  if ('severity' in input)
    output.severity = enumValue(input.severity, ISSUE_SEVERITIES, '重要度');
  if ('category' in input)
    output.category = optionalEnum(input.category, ISSUE_CATEGORIES, '分类');
  if ('detectionPhase' in input)
    output.detectionPhase = optionalEnum(
      input.detectionPhase,
      ISSUE_DETECTION_PHASES,
      '发现阶段'
    );
  if ('reporterId' in input)
    output.reporterId = normalizeHostUserReference(input.reporterId, '提出人');
  if ('assigneeId' in input)
    output.assigneeId = normalizeHostUserReference(input.assigneeId, '责任人');
  if ('dueDate' in input)
    output.dueDate = normalizeDateOnly(input.dueDate, '截止日');
  if ('functionId' in input)
    output.functionId = optionalText(input.functionId, '功能 ID', 36);
  if ('status' in input) output.status = normalizeIssueStatus(input.status);
  if ('closeReason' in input)
    output.closeReason = optionalText(input.closeReason, '关闭原因', 32);
  if ('closedBy' in input)
    output.closedBy = normalizeHostUserReference(input.closedBy, '关闭人');
  if ('completedAt' in input)
    output.completedAt = optionalText(input.completedAt, '完成时间', 32);
  if (Object.keys(output).length === 0) throw new Error('没有可更新的字段');
  return output;
}

export function normalizeIssueStatus(value: unknown): IssueStatus {
  return enumValue(value, ISSUE_STATUSES, '状态');
}

export function normalizeAttentionLevel(value: unknown): number {
  const level = Number(value);
  if (!Number.isFinite(level)) throw new Error('关注度无效');
  return Math.max(0, Math.min(5, Math.round(level)));
}

export function normalizeIssueIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error('排序列表不能为空');
  const result = value.map(item => requiredText(item, 'Issue ID', 36));
  if (new Set(result).size !== result.length)
    throw new Error('排序列表包含重复 Issue');
  return result;
}

export function canModifyIssue(
  role: string | null,
  hostRoot: boolean
): boolean {
  return (
    hostRoot || role === 'owner' || role === 'admin' || role === 'editor'
  );
}
