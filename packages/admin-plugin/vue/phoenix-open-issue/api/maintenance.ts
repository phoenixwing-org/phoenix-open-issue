import request from './request'

export type RepairTaskId = 'checkpoints' | 'links' | 'all'

export interface RepairTaskDefinition {
  id: Exclude<RepairTaskId, 'all'>
  title: string
  description: string
}

export interface RepairTaskResult {
  task: Exclude<RepairTaskId, 'all'>
  message: string
  details: string[]
  fixed: number
}

export function getRepairTasks() {
  return request.get<RepairTaskDefinition[]>('/maintenance/repair-tasks')
}

export function runDbRepair(task: RepairTaskId) {
  return request.post<RepairTaskResult[]>('/maintenance/repair', { task })
}
