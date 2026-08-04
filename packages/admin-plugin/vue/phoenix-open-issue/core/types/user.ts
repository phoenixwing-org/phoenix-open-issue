/** Host 账号在 Issue 业务中的最小只读投影。 */
export interface UserPublic {
  id: string
  username: string
  email: string | null
  displayName: string | null
  orgUnitId: string | null
  disabled?: number
  createdAt: string
  updatedAt: string
}
