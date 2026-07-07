import request from './request'

export function getMyLists() {
  return request.get('/lists')
}

export function getAllLists() {
  return request.get('/lists/all')
}

export function getList(id: string) {
  return request.get(`/lists/${id}`)
}

export function createList(data: { name: string; listType: string; description?: string; orgUnitId?: string }) {
  return request.post('/lists', data)
}

export function updateList(id: string, data: { name?: string; description?: string }) {
  return request.put(`/lists/${id}`, data)
}

export function deleteList(id: string) {
  return request.delete(`/lists/${id}`)
}

export function archiveList(id: string, archived: boolean) {
  return request.patch(`/lists/${id}/archive`, { archived })
}

export function getArchivedLists() {
  return request.get('/lists/archived')
}

export function getMembers(listId: string) {
  return request.get(`/lists/${listId}/members`)
}

export function addMember(listId: string, userId: string, role: string = 'editor') {
  return request.post(`/lists/${listId}/members`, { userId, role })
}

export function removeMember(listId: string, userId: string) {
  return request.delete(`/lists/${listId}/members/${userId}`)
}

// ── Owner 转移 ──
export function transferOwner(listId: string, userId: string) {
  return request.patch(`/lists/${listId}/transfer-owner`, { userId })
}

export function updateMemberRole(listId: string, userId: string, role: string) {
  return request.patch(`/lists/${listId}/members/${userId}/role`, { role })
}
