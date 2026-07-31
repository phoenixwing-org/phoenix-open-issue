export type PushTargetType = 'list' | 'user'
export type PushStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn'

export interface PushRecord {
  id: string
  fromListId: string
  targetType: PushTargetType
  toListId: string | null
  toUserId: string | null
  issueId: string
  pushedBy: string
  pushedAt: string
  status: PushStatus
  handledBy: string | null
  handledAt: string | null
  rejectReason: string | null
  note: string
}

/** 推送记录在列表、历史和仪表盘中的只读展示字段。 */
export interface PushRecordView extends PushRecord {
  issueTitle: string
  fromListName: string
  toListName: string | null
  toUserName: string | null
  pushedByName: string | null
  _canHandle?: boolean
  _canWithdraw?: boolean
}

interface PushRequestBase {
  fromListId: string
  issueIds: string[]
  note?: string
}

export interface ListPushRequest extends PushRequestBase {
  /** 兼容 0.6.0 客户端：省略时仍按列表推送处理。 */
  targetType?: 'list'
  toListId: string
  toUserId?: never
}

export interface UserPushRequest extends PushRequestBase {
  targetType: 'user'
  toUserId: string
  toListId?: never
}

export type PushRequest = ListPushRequest | UserPushRequest

export interface PushTargetListOption {
  id: string
  name: string
  listType: string
  role: string | null
}

export interface PushValidationResult {
  valid: boolean
  overlapUserIds: string[]
  overlapPercent: number
  canPush: boolean
  message: string
}
