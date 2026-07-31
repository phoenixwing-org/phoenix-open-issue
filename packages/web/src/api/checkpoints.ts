import request from './request'

// 返回列表 → 复数
export function getCheckpoints(issueId: string) {
  return request.get(`/issue/${issueId}/checkpoints`)
}

export function getCheckpointsByList(listId: string) {
  return request.get(`/list/${listId}/checkpoints`)
}

// 单个操作 → 单数
export function createCheckpoint(issueId: string, data: { checkpointDate: string; deadline?: string | null; description: string; responsibleUserId?: string }) {
  return request.post(`/issue/${issueId}/checkpoint`, data)
}

export function updateCheckpoint(id: string, data: Record<string, any>) {
  return request.put(`/checkpoint/${id}`, data)
}

export function deleteCheckpoint(id: string) {
  return request.delete(`/checkpoint/${id}`)
}
