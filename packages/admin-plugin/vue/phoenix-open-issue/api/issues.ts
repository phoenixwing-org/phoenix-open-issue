import request from './request'

// 返回列表 → 复数
export function getIssues(listId: string, params?: Record<string, any>) {
  return request.get(`/list/${listId}/issues`, { params })
}

// 单个操作 → 单数
export function createIssue(listId: string, data: any) {
  return request.post(`/list/${listId}/issue`, data)
}

export function getIssue(id: string) {
  return request.get(`/issue/${id}`)
}

export function updateIssue(id: string, data: Record<string, any>) {
  return request.put(`/issue/${id}`, data)
}

export function updateIssueStatus(id: string, status: string) {
  return request.patch(`/issue/${id}/status`, { status })
}

export function deleteIssue(id: string) {
  return request.delete(`/issue/${id}`)
}

export function reorderIssues(listId: string, issueIds: string[]) {
  return request.put(`/list/${listId}/issue/reorder`, { issueIds })
}

export function setIssueAttention(listId: string, issueId: string, attentionLevel: number) {
  return request.patch(`/list/${listId}/issue/${issueId}/attention`, { attentionLevel })
}
