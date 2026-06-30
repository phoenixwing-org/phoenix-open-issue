export type ListType = 'yearly' | 'monthly' | 'project' | 'custom'

export type MemberRole = 'owner' | 'admin' | 'editor' | 'reporter' | 'viewer'

export interface IssueList {
  id: string
  name: string
  description: string
  listType: ListType
  ownerId: string
  orgUnitId: string | null
  createdAt: string
  updatedAt: string
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
