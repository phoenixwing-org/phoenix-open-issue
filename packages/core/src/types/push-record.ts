export type PushStatus = 'pending' | 'accepted' | 'rejected'

export interface PushRecord {
  id: string
  fromListId: string
  toListId: string
  issueId: string
  pushedBy: string
  pushedAt: string
  status: PushStatus
  handledBy: string | null
  handledAt: string | null
  rejectReason: string | null
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
