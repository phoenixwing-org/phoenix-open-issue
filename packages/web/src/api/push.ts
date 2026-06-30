import request from './request'

export function previewPush(fromListId: string, toListId: string) {
  return request.get('/push/preview', { params: { fromListId, toListId } })
}

export function pushIssues(data: { fromListId: string; toListId: string; issueIds: string[]; note?: string }) {
  return request.post('/push', data)
}

export function getListPushHistory(listId: string) {
  return request.get(`/lists/${listId}/push-history`)
}

export function getMyPushHistory() {
  return request.get('/push/history')
}

export function getIncomingPushes(listId: string) {
  return request.get(`/lists/${listId}/incoming-pushes`)
}

export function handlePush(recordId: string, action: 'accepted' | 'rejected', rejectReason?: string) {
  return request.patch(`/push/${recordId}/handle`, { action, rejectReason })
}

export function runSeed(force = false) {
  return request.post('/seed' + (force ? '?force=true' : ''))
}
