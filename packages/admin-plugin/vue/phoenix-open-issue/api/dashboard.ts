import request from './request'
import type { DashboardTasks, DashboardTaskScope } from '/$/phoenix-open-issue/core'

export function getDashboardTasks(tab: DashboardTaskScope = 'summary', limit = 5) {
  return request.get<DashboardTasks>('/dashboard/tasks', { params: { tab, limit } })
}
