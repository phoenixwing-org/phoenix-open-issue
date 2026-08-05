import type { ExternalBindRequestAdminView } from './external-auth.js'
import type { PushRecordView } from './push-record.js'
import type { UserPublic } from './user.js'

export type DashboardTaskTab = 'incoming' | 'outgoing' | 'admin'
export type DashboardTaskScope = 'summary' | DashboardTaskTab

export interface DashboardTaskCounts {
  incoming: number
  outgoing: number
  admin: number
  total: number
}

export interface DashboardPushTask extends PushRecordView {
  _canHandle: boolean
  _canWithdraw: boolean
}

/** 仪表盘待办中心的聚合结果。管理审批数据仅向系统管理员返回。 */
export interface DashboardTasks {
  scope: DashboardTaskScope
  incomingPushes: DashboardPushTask[]
  outgoingPushes: DashboardPushTask[]
  pendingUsers: UserPublic[]
  externalBindRequests: ExternalBindRequestAdminView[]
  counts: DashboardTaskCounts
}
