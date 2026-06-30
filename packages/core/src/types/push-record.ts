export interface PushRecord {
  id: string
  from_list_id: string
  to_list_id: string
  issue_id: string
  pushed_by: string
  pushed_at: string
  note: string
}

export interface PushRequest {
  fromListId: string
  toListId: string
  issueIds: string[]
  note?: string
}

export interface PushValidationResult {
  valid: boolean
  overlapUserIds: string[]
  overlapPercent: number
  canPush: boolean
  message: string
}
