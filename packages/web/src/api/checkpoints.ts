import request from './request'

export function getCheckpoints(issueId: string) {
  return request.get(`/issues/${issueId}/checkpoints`)
}

export function createCheckpoint(issueId: string, data: { checkpoint_date: string; description: string; responsible_user_id?: string }) {
  return request.post(`/issues/${issueId}/checkpoints`, data)
}

export function updateCheckpoint(id: string, data: Record<string, any>) {
  return request.put(`/checkpoints/${id}`, data)
}

export function deleteCheckpoint(id: string) {
  return request.delete(`/checkpoints/${id}`)
}
