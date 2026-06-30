import request from './request'

export function getDictByGroup(groupName: string) {
  return request.get(`/dict/${groupName}`)
}

export function getAllDict() {
  return request.get('/dict')
}

export function createDictItem(data: { groupName: string; value: string; label: string }) {
  return request.post('/dict', data)
}

export function updateDictItem(id: string, data: { label?: string; value?: string; enabled?: number; sortOrder?: number }) {
  return request.put(`/dict/${id}`, data)
}

export function deleteDictItem(id: string) {
  return request.delete(`/dict/${id}`)
}
