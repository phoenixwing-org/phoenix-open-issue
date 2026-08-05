import { service } from '/@/cool'
import { toIssueUser, type HostUser } from '/$/phoenix-open-issue/adapters/host-user'
import type { LegacyResponse } from '/$/phoenix-open-issue/api/request'
import type { UserPublic } from '/$/phoenix-open-issue/core'

/**
 * Issue 页面只需要 Host 用户选择数据，不迁移独立版的登录、注册和 OAuth API。
 */
export async function getAllUsers(
  params: Record<string, any> = {},
): Promise<LegacyResponse<UserPublic[]>> {
  const { includeDisabled = false, ...query } = params
  const hostUsers = await service.base.sys.user.list({
    ...query,
    ...(includeDisabled ? {} : { status: 1 }),
  }) as HostUser[]

  const users = hostUsers
    .map(toIssueUser)
    .filter((user): user is UserPublic => Boolean(user))

  return {
    data: includeDisabled ? users : users.filter(user => !user.disabled),
  }
}
