import { normalizeDateOnly, normalizeHostUserReference } from './issue';

export const CHECKPOINT_STATUSES = [
  'pending',
  'done',
  'skipped',
  'voided',
] as const;
export type CheckpointStatus = (typeof CHECKPOINT_STATUSES)[number];

export interface NewCheckpointInput {
  checkpointDate: string;
  deadline: string | null;
  description: string;
  responsibleUserId: string | null;
}

export type CheckpointUpdateInput = Partial<NewCheckpointInput> & {
  status?: CheckpointStatus;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('请求数据无效');
  return value as Record<string, unknown>;
}

function description(value: unknown): string {
  const result = typeof value === 'string' ? value.trim() : '';
  if (!result || result.length > 2000)
    throw new Error('点检描述必须为 1 至 2000 个字符');
  return result;
}

function status(value: unknown): CheckpointStatus {
  if (
    typeof value !== 'string' ||
    !CHECKPOINT_STATUSES.includes(value as CheckpointStatus)
  )
    throw new Error('点检状态无效');
  return value as CheckpointStatus;
}

export function normalizeNewCheckpointInput(
  value: unknown
): NewCheckpointInput {
  const input = record(value);
  const checkpointDate = normalizeDateOnly(input.checkpointDate, '点检日');
  if (!checkpointDate) throw new Error('点检日不能为空');
  return {
    checkpointDate,
    deadline: normalizeDateOnly(input.deadline, '截止日'),
    description: description(input.description),
    responsibleUserId: normalizeHostUserReference(
      input.responsibleUserId,
      '责任人'
    ),
  };
}

export function normalizeCheckpointUpdateInput(
  value: unknown
): CheckpointUpdateInput {
  const input = record(value);
  const output: CheckpointUpdateInput = {};
  if ('checkpointDate' in input) {
    const date = normalizeDateOnly(input.checkpointDate, '点检日');
    if (!date) throw new Error('点检日不能为空');
    output.checkpointDate = date;
  }
  if ('deadline' in input)
    output.deadline = normalizeDateOnly(input.deadline, '截止日');
  if ('description' in input)
    output.description = description(input.description);
  if ('responsibleUserId' in input)
    output.responsibleUserId = normalizeHostUserReference(
      input.responsibleUserId,
      '责任人'
    );
  if ('status' in input) output.status = status(input.status);
  if (Object.keys(output).length === 0) throw new Error('没有可更新的字段');
  return output;
}
