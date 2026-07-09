import request from './request'

export function getDictByGroup(groupName: string) {
  return request.get(`/dict/${groupName}`)
}

export function getAllDict() {
  return request.get('/dict')
}

export function createDictItem(data: { groupName: string; value: string; label: string; tags?: string }) {
  return request.post('/dict', data)
}

export function updateDictItem(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number; tags?: string }) {
  return request.put(`/dict/${id}`, data)
}

export function deleteDictItem(id: string) {
  return request.delete(`/dict/${id}`)
}

export function applyDictPreset(preset: string) {
  return request.post('/dict/presets', { preset })
}

export function deleteDictByTag(tag: string) {
  return request.delete(`/dict/tag/${tag}`)
}

export function dedupeDict() {
  return request.post<{ removed: number; tagsMerged: number; details: { groupName: string; value: string; keptId: string; removedIds: string[] }[] }>('/dict/dedupe')
}
