export type ListType = 'yearly' | 'monthly' | 'project' | 'custom'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'reporter' | 'viewer'

export interface IssueList {
  id: string
  name: string
  description: string
  listType: ListType
  ownerId: string
  orgUnitId: string | null
  archived: number
  isDeleted: number
  deletedAt: string | null
  createdAt: string
  updatedAt: string
  /** 以下为查询时 JOIN 计算的衍生字段 */
  ownerName?: string
  memberCount?: number
  issueCount?: number
  myRole?: MemberRole | null
}

export interface IssueListMember {
  id: string
  listId: string
  userId: string
  role: MemberRole
  joinedAt: string
}

export interface MemberWithUser extends IssueListMember {
  username: string
  displayName: string | null
}

export interface CreateListInput {
  name: string
  description?: string
  listType: ListType
  orgUnitId?: string
}

export interface UpdateListInput {
  name?: string
  description?: string
}
