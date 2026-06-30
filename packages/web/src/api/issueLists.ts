import request from './request'

export function getMyLists() {
  return request.get('/lists')
}

export function getList(id: string) {
  return request.get(`/lists/${id}`)
}

export function createList(data: { name: string; list_type: string; description?: string; org_unit_id?: string }) {
  return request.post('/lists', data)
}

export function updateList(id: string, data: { name?: string; description?: string }) {
  return request.put(`/lists/${id}`, data)
}

export function deleteList(id: string) {
  return request.delete(`/lists/${id}`)
}

export function getMembers(listId: string) {
  return request.get(`/lists/${listId}/members`)
}

export function addMember(listId: string, userId: string, role: string = 'editor') {
  return request.post(`/lists/${listId}/members`, { user_id: userId, role })
}

export function removeMember(listId: string, userId: string) {
  return request.delete(`/lists/${listId}/members/${userId}`)
}
