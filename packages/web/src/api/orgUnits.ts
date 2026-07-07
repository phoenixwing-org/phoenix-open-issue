import request from './request'

// 返回列表 → 复数
export function getOrgTree() {
  return request.get('/org-units')
}

// 单个操作 → 单数
export function getOrgUnit(id: string) {
  return request.get(`/org-unit/${id}`)
}

export function createOrgUnit(data: { name: string; unitType: string; parentId?: string }) {
  return request.post('/org-unit', data)
}

export function updateOrgUnit(id: string, data: { name?: string; parentId?: string | null; unitType?: string }) {
  return request.put(`/org-unit/${id}`, data)
}

export function deleteOrgUnit(id: string) {
  return request.delete(`/org-unit/${id}`)
}

export function getOrgUnitUsers(id: string, includeChildren = true) {
  return request.get(`/org-unit/${id}/users`, { params: { includeChildren } })
}
