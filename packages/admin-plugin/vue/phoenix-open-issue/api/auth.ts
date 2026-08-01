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

/**
 * 旧仪表盘的“批准用户”复用 COOL 用户状态，不在插件内复制用户审批表。
 * Host 用户 ID 在领域层保持 string；调用 COOL 服务时再还原为 number。
 */
export async function approveUser(
  userId: string,
  approved: boolean,
): Promise<LegacyResponse<void>> {
  const id = Number(userId)
  if (!Number.isSafeInteger(id)) throw new Error(`非法 Host 用户 ID：${userId}`)

  await service.base.sys.user.update({ id, status: approved ? 1 : 0 })
  return { data: undefined }
}
