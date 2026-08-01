export const ISSUE_LIST_MEMBER_ROLES = [
  'owner',
  'admin',
  'editor',
  'reporter',
  'viewer',
] as const;

export type IssueListMemberRole = (typeof ISSUE_LIST_MEMBER_ROLES)[number];

export interface NewIssueListInput {
  name: string;
  description: string;
  listType: string;
  orgUnitId: string | null;
}

export interface IssueListUpdateInput {
  name?: string;
  description?: string;
  listType?: string;
  ownerId?: string;
}

export interface IssueListShape {
  id: string;
  ownerId: string;
}

export interface IssueListMemberShape {
  listId: string;
  userId: string;
  role: IssueListMemberRole;
}

export type EnrichedIssueList<T extends IssueListShape> = T & {
  memberCount: number;
  issueCount: number;
  myRole: IssueListMemberRole | null;
};

function recordOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('请求数据必须是对象');
  }
  return value as Record<string, unknown>;
}

function requiredText(
  value: unknown,
  label: string,
  maxLength: number
): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label}不能为空`);
  }
  const result = value.trim();
  if (result.length > maxLength)
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return result;
}

function optionalText(
  value: unknown,
  label: string,
  maxLength: number
): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new Error(`${label}必须是字符串`);
  const result = value.trim();
  if (result.length > maxLength)
    throw new Error(`${label}不能超过 ${maxLength} 个字符`);
  return result;
}

export function normalizeNewIssueListInput(value: unknown): NewIssueListInput {
  const input = recordOf(value);
  const orgUnitId = optionalText(input.orgUnitId, '组织 ID', 64);
  return {
    name: requiredText(input.name, '列表名称', 120),
    description: optionalText(input.description, '列表描述', 2000) ?? '',
    listType: requiredText(input.listType, '列表类型', 80),
    orgUnitId: orgUnitId || null,
  };
}

export function normalizeIssueListUpdateInput(
  value: unknown
): IssueListUpdateInput {
  const input = recordOf(value);
  const result: IssueListUpdateInput = {};
  if (input.name !== undefined)
    result.name = requiredText(input.name, '列表名称', 120);
  if (input.description !== undefined) {
    result.description =
      optionalText(input.description, '列表描述', 2000) ?? '';
  }
  if (input.listType !== undefined) {
    result.listType = requiredText(input.listType, '列表类型', 80);
  }
  if (input.ownerId !== undefined) {
    result.ownerId = requiredText(input.ownerId, '负责人 ID', 64);
  }
  if (Object.keys(result).length === 0) throw new Error('没有可更新的字段');
  return result;
}

export function canManageIssueList(
  role: IssueListMemberRole | null | undefined,
  systemAdmin: boolean
): boolean {
  return systemAdmin || role === 'owner' || role === 'admin';
}

export function normalizeIssueListMemberRole(
  value: unknown
): IssueListMemberRole {
  if (
    typeof value !== 'string' ||
    !ISSUE_LIST_MEMBER_ROLES.includes(value as IssueListMemberRole)
  ) {
    throw new Error('成员角色无效');
  }
  return value as IssueListMemberRole;
}

export function normalizeHostUserId(value: unknown): string {
  const result =
    typeof value === 'number' && Number.isSafeInteger(value)
      ? String(value)
      : requiredText(value, 'Host 用户 ID', 64);
  if (!/^[1-9]\d*$/.test(result)) throw new Error('Host 用户 ID 无效');
  return result;
}

export function enrichIssueLists<T extends IssueListShape>(
  lists: readonly T[],
  members: readonly IssueListMemberShape[],
  actorId: string,
  issueCounts: Readonly<Record<string, number>> = {}
): Array<EnrichedIssueList<T>> {
  const memberCounts = new Map<string, number>();
  const actorRoles = new Map<string, IssueListMemberRole>();
  for (const member of members) {
    memberCounts.set(member.listId, (memberCounts.get(member.listId) ?? 0) + 1);
    if (member.userId === actorId) actorRoles.set(member.listId, member.role);
  }

  return lists.map(list => ({
    ...list,
    memberCount: memberCounts.get(list.id) ?? 0,
    issueCount: issueCounts[list.id] ?? 0,
    myRole:
      list.ownerId === actorId ? 'owner' : actorRoles.get(list.id) ?? null,
  }));
}
