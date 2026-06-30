import request from './request'

export function getIssues(listId: string, params?: Record<string, any>) {
  return request.get(`/lists/${listId}/issues`, { params })
}

export function getIssue(id: string) {
  return request.get(`/issues/${id}`)
}

export function createIssue(listId: string, data: { title: string; description?: string; priority?: string }) {
  return request.post(`/lists/${listId}/issues`, data)
}

export function updateIssue(id: string, data: Record<string, any>) {
  return request.put(`/issues/${id}`, data)
}

export function updateIssueStatus(id: string, status: string) {
  return request.patch(`/issues/${id}/status`, { status })
}

export function deleteIssue(id: string) {
  return request.delete(`/issues/${id}`)
}

export function reorderIssues(listId: string, issueIds: string[]) {
  return request.put(`/lists/${listId}/issues/reorder`, { issue_ids: issueIds })
}
