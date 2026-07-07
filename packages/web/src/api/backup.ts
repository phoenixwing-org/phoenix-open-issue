import request from './request'

export function exportDb() {
  return request.get('/db/export')
}

export function importDb(data: any, mode: 'replace' | 'merge' = 'replace') {
  return request.post('/db/import', { data, mode })
}

export function repairIssueListLinks() {
  return request.post('/db/repair-links')
}
