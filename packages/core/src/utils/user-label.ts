export interface UserLabelIdentity {
  id?: string | number | null
  username?: string | null
  displayName?: string | null
}

function nonBlank(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** 用户展示统一为“姓名（账号）”；两者相同或只有一项时不重复。 */
export function formatUserLabel(
  user: UserLabelIdentity | null | undefined,
  fallback = '未知用户',
): string {
  const displayName = nonBlank(user?.displayName)
  const username = nonBlank(user?.username)
  if (displayName && username && displayName !== username) {
    return `${displayName}（${username}）`
  }
  return displayName || username || fallback
}

export function unknownUserLabel(id: string | number): string {
  return `未知用户（ID ${String(id)}）`
}

export function resolveUserLabel(
  users: readonly UserLabelIdentity[],
  id: string | number | null | undefined,
  empty = '—',
): string {
  if (id === null || id === undefined || String(id) === '') return empty
  const normalizedId = String(id)
  const user = users.find(item => String(item.id) === normalizedId)
  return formatUserLabel(user, unknownUserLabel(normalizedId))
}
