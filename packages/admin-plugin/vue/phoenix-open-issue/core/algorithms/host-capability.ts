/**
 * Stable semantic capabilities materialized by Pah into Cool menu permissions.
 * Endpoint tokens remain the server-side enforcement source; these IDs let the
 * plugin render the same boundary without recreating legacy system roles.
 */
export const ISSUE_HOST_CAPABILITIES = [
  'phoenix-open-issue:dashboard:read',
  'phoenix-open-issue:list:read',
  'phoenix-open-issue:list:admin',
  'phoenix-open-issue:list:create',
  'phoenix-open-issue:list:update',
  'phoenix-open-issue:list:archive',
  'phoenix-open-issue:list:delete',
  'phoenix-open-issue:issue:read',
  'phoenix-open-issue:issue:create',
  'phoenix-open-issue:issue:update',
  'phoenix-open-issue:issue:delete',
  'phoenix-open-issue:checkpoint:read',
  'phoenix-open-issue:checkpoint:create',
  'phoenix-open-issue:checkpoint:update',
  'phoenix-open-issue:checkpoint:delete',
  'phoenix-open-issue:push:read',
  'phoenix-open-issue:push:create',
  'phoenix-open-issue:push:handle',
  'phoenix-open-issue:report:read',
  'phoenix-open-issue:report:write',
  'phoenix-open-issue:function:read',
  'phoenix-open-issue:function:write',
  'phoenix-open-issue:test:read',
  'phoenix-open-issue:test:run',
  'phoenix-open-issue:maintenance:read',
  'phoenix-open-issue:maintenance:run',
  'phoenix-open-issue:data:purge',
] as const

export type IssueHostCapability = (typeof ISSUE_HOST_CAPABILITIES)[number]

export function hasIssueHostCapability(
  permissions: readonly unknown[] | null | undefined,
  capability: IssueHostCapability,
): boolean {
  return Boolean(permissions?.some(permission => permission === capability))
}
