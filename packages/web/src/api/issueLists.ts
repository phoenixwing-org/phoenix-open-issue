import request from './request'

// 返回列表 → 复数
export function getMyLists()       { return request.get('/lists') }
export function getAllLists()      { return request.get('/lists/all') }
export function getArchivedLists() { return request.get('/lists/archived') }

// 单个操作 → 单数
export function getList(id: string)        { return request.get(`/list/${id}`) }
export function createList(data: any)       { return request.post('/list', data) }
export function updateList(id: string, data: any) { return request.put(`/list/${id}`, data) }
export function deleteList(id: string)      { return request.delete(`/list/${id}`) }
export function archiveList(id: string, archived: boolean) { return request.patch(`/list/${id}/archive`, { archived }) }

// 成员列表 → 复数；单个成员 → 单数
export function getMembers(listId: string)  { return request.get(`/list/${listId}/members`) }
export function addMember(listId: string, userId: string, role = 'editor') { return request.post(`/list/${listId}/member`, { userId, role }) }
export function removeMember(listId: string, userId: string) { return request.delete(`/list/${listId}/member/${userId}`) }
export function updateMemberRole(listId: string, userId: string, role: string) { return request.patch(`/list/${listId}/member/${userId}/role`, { role }) }

export function transferOwner(listId: string, userId: string) { return request.patch(`/list/${listId}/transfer-owner`, { userId }) }
