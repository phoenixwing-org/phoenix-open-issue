export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'closed' | 'cancelled'
export type IssuePriority = 'low' | 'medium' | 'high' | 'critical'
export type Severity = 'fatal' | 'major' | 'minor' | 'trivial'
export type CloseReason = 'completed' | 'cancelled' | 'duplicate' | 'transferred' | 'unreproducible'

export interface Issue {
  id: string
  listId: string
  title: string
  description: string
  status: IssueStatus
  priority: IssuePriority
  severity: Severity
  reporterId: string | null
  assigneeId: string | null
  dueDate: string | null
  completedAt: string | null
  closeReason: CloseReason | null
  closedBy: string | null
  sortOrder: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateIssueInput {
  title: string
  description?: string
  priority?: IssuePriority
  severity?: Severity
  reporterId?: string
  assigneeId?: string
  dueDate?: string
}

export interface UpdateIssueInput {
  title?: string
  description?: string
  status?: IssueStatus
  priority?: IssuePriority
  severity?: Severity
  assigneeId?: string
  dueDate?: string
  closeReason?: CloseReason
  closedBy?: string
  completedAt?: string
}

export interface UpdateStatusInput {
  status: IssueStatus
}

export interface ReorderInput {
  issueIds: string[]
}
