import request from './request'

export function exportDb(passwordPolicy: 'resetAll' | 'resetAdmin' = 'resetAll') {
  return request.get('/db/export', { params: { passwordPolicy } })
}

export function importDb(data: any, mode: 'replace' | 'merge' = 'replace') {
  return request.post('/db/import', { data, mode })
}

export function repairIssueListLinks() {
  return request.post('/db/repair-links')
}

export type RepairTaskId = 'schema' | 'checkpoints' | 'links' | 'dict' | 'users' | 'issueNo' | 'linkAttention' | 'reports' | 'all'

export interface RepairTaskResult {
  task: RepairTaskId
  message: string
  details: string[]
  fixed: number
}

export function runDbRepair(task: RepairTaskId) {
  return request.post('/db/repair', { task })
}
