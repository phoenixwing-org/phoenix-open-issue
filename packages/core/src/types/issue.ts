export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'

export interface Issue {
  id: string
  list_id: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  sort_order: number
  created_by: string
  created_at: string
  updated_at: string
}

export interface CreateIssueInput {
  title: string
  description?: string
  priority?: IssuePriority
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
}

export interface UpdateStatusInput {
  status: IssueStatus
}

export interface ReorderInput {
  issue_ids: string[]   // 新的排序顺序
}
