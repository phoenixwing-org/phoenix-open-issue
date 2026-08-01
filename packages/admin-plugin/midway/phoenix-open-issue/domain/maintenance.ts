export const OPEN_ISSUE_REPAIR_TASKS = ['checkpoints', 'links'] as const;

export type OpenIssueRepairTask =
  | (typeof OPEN_ISSUE_REPAIR_TASKS)[number]
  | 'all';

export interface CheckpointRepairCandidate {
  id: string;
  status: string | null | undefined;
  sortOrder: number | null | undefined;
  deadline: string | null | undefined;
  createdAt: string | null | undefined;
  updatedAt: string | null | undefined;
}

export interface CheckpointRepairPatch {
  status?: 'pending';
  sortOrder?: number;
  deadline?: null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IssueRepairCandidate {
  id: string;
  listId: string;
  listCount: number;
  createdBy: string;
  createdAt: string;
}

export interface LinkRepairCandidate {
  id: string;
  issueId: string;
  listId: string;
  linkedAt: string;
}

export interface MissingIssueLink {
  issueId: string;
  listId: string;
  linkedBy: string;
  linkedAt: string;
}

export interface IssueListCountRepair {
  issueId: string;
  listCount: number;
}

export interface IssueLinkRepairPlan {
  missing: MissingIssueLink[];
  duplicateIds: string[];
  listCounts: IssueListCountRepair[];
}

export function normalizeRepairTask(value: unknown): OpenIssueRepairTask {
  if (
    typeof value !== 'string' ||
    !([...OPEN_ISSUE_REPAIR_TASKS, 'all'] as const).includes(
      value as OpenIssueRepairTask
    )
  ) {
    throw new Error('数据库修正任务无效');
  }
  return value as OpenIssueRepairTask;
}

export function planCheckpointRepair(
  row: CheckpointRepairCandidate,
  now: string
): CheckpointRepairPatch {
  const patch: CheckpointRepairPatch = {};
  const createdAt = row.createdAt?.trim() || now;
  if (!row.status?.trim()) patch.status = 'pending';
  if (!Number.isFinite(row.sortOrder)) patch.sortOrder = 0;
  if (row.deadline !== null && row.deadline !== undefined && !row.deadline.trim())
    patch.deadline = null;
  if (!row.createdAt?.trim()) patch.createdAt = createdAt;
  if (!row.updatedAt?.trim()) patch.updatedAt = createdAt;
  return patch;
}

function linkKey(issueId: string, listId: string): string {
  return `${issueId}\u0000${listId}`;
}

export function planIssueLinkRepair(
  issues: readonly IssueRepairCandidate[],
  links: readonly LinkRepairCandidate[]
): IssueLinkRepairPlan {
  const sortedLinks = [...links].sort(
    (left, right) =>
      left.linkedAt.localeCompare(right.linkedAt) || left.id.localeCompare(right.id)
  );
  const keptByKey = new Map<string, LinkRepairCandidate>();
  const duplicateIds: string[] = [];

  for (const link of sortedLinks) {
    const key = linkKey(link.issueId, link.listId);
    if (keptByKey.has(key)) duplicateIds.push(link.id);
    else keptByKey.set(key, link);
  }

  const missing: MissingIssueLink[] = [];
  for (const issue of issues) {
    const key = linkKey(issue.id, issue.listId);
    if (!keptByKey.has(key)) {
      const link = {
        issueId: issue.id,
        listId: issue.listId,
        linkedBy: issue.createdBy || 'system',
        linkedAt: issue.createdAt,
      };
      missing.push(link);
      keptByKey.set(key, { id: '', ...link });
    }
  }

  const countByIssue = new Map<string, number>();
  for (const link of keptByKey.values()) {
    countByIssue.set(link.issueId, (countByIssue.get(link.issueId) ?? 0) + 1);
  }
  const listCounts = issues
    .map(issue => ({
      issueId: issue.id,
      listCount: countByIssue.get(issue.id) ?? 0,
      current: issue.listCount,
    }))
    .filter(item => item.current !== item.listCount)
    .map(({ issueId, listCount }) => ({ issueId, listCount }));

  return { missing, duplicateIds, listCounts };
}
