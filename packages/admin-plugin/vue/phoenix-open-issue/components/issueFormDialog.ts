import { DEFAULT_ATTENTION_LEVEL } from '/$/phoenix-open-issue/core'

export const ISSUE_FORM_DIALOG_RENDERER_ID = 'phoenix-open-issue.dialog.issue-form'

export const ISSUE_FORM_DIALOG_SIZE = Object.freeze({
  width: 680,
  height: 720,
  minWidth: 520,
  minHeight: 460,
})

export interface IssueFormDialogUser {
  id: string
  username: string
  displayName: string | null
}

export interface IssueFormDialogInitial {
  title: string
  issueNo: string
  description: string
  priority: string
  severity: string
  category: string
  detectionPhase: string
  reporterId: string
  assigneeId: string
  dueDate: string
  functionId: string
  _attentionLevel: number
}

export interface IssueFormDialogProps {
  allUsers: IssueFormDialogUser[]
  initial?: IssueFormDialogInitial | null
}

export interface IssueFormDialogResult {
  title: string
  issueNo?: string
  description?: string
  priority?: string
  severity?: string
  category?: string
  detectionPhase?: string
  reporterId?: string
  assigneeId?: string
  dueDate?: string
  functionId?: string
  attentionLevel?: number
}

export function issueFormDialogUsers(users: readonly Record<string, unknown>[]): IssueFormDialogUser[] {
  return users.map(user => ({
    id: String(user.id ?? ''),
    username: String(user.username ?? ''),
    displayName: typeof user.displayName === 'string' ? user.displayName : null,
  }))
}

export function issueFormDialogInitial(issue: Record<string, unknown>): IssueFormDialogInitial {
  const text = (key: string) => typeof issue[key] === 'string' ? issue[key] as string : ''
  return {
    title: text('title'),
    issueNo: text('issueNo'),
    description: text('description'),
    priority: text('priority'),
    severity: text('severity'),
    category: text('category'),
    detectionPhase: text('detectionPhase'),
    reporterId: text('reporterId'),
    assigneeId: text('assigneeId'),
    dueDate: text('dueDate'),
    functionId: text('functionId'),
    _attentionLevel: Number.isFinite(Number(issue._attentionLevel))
      ? Number(issue._attentionLevel)
      : DEFAULT_ATTENTION_LEVEL,
  }
}
