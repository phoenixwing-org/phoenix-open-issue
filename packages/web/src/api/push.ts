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
