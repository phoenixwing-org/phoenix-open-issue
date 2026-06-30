import request from './request'

export function getCheckpoints(issueId: string) {
  return request.get(`/issues/${issueId}/checkpoints`)
}

export function getCheckpointsByList(listId: string) {
  return request.get(`/lists/${listId}/checkpoints`)
}

export function createCheckpoint(issueId: string, data: { checkpointDate: string; description: string; responsibleUserId?: string }) {
  return request.post(`/issues/${issueId}/checkpoints`, data)
}

export function updateCheckpoint(id: string, data: Record<string, any>) {
  return request.put(`/checkpoints/${id}`, data)
}

export function deleteCheckpoint(id: string) {
  return request.delete(`/checkpoints/${id}`)
}
