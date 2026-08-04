import type { PushRecordView } from './push-record.js'

export type DashboardTaskTab = 'incoming' | 'outgoing'
export type DashboardTaskScope = 'summary' | DashboardTaskTab

export interface DashboardTaskCounts {
  incoming: number
  outgoing: number
  total: number
}

export interface DashboardPushTask extends PushRecordView {
  _canHandle: boolean
  _canWithdraw: boolean
}

/** Issue-owned push tasks. Host account approval stays in Cool user management. */
export interface DashboardTasks {
  scope: DashboardTaskScope
  incomingPushes: DashboardPushTask[]
  outgoingPushes: DashboardPushTask[]
  counts: DashboardTaskCounts
}
