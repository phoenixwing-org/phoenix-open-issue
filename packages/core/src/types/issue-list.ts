/** Issue List 类型 */
export type ListType = 'yearly' | 'monthly' | 'project' | 'custom'

/** 成员在列表中的角色 */
export type MemberRole = 'owner' | 'editor' | 'viewer'

export interface IssueList {
  id: string
  name: string
  description: string
  list_type: ListType
  owner_id: string
  org_unit_id: string | null
  created_at: string
  updated_at: string
}

export interface IssueListMember {
  id: string
  list_id: string
  user_id: string
  role: MemberRole
  joined_at: string
}

/** 成员信息（带用户公开数据） */
export interface MemberWithUser extends IssueListMember {
  username: string
  display_name: string | null
}

export interface CreateListInput {
  name: string
  description?: string
  list_type: ListType
  org_unit_id?: string
}

export interface UpdateListInput {
  name?: string
  description?: string
}
