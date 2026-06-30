import request from './request'

export function getOrgTree() {
  return request.get('/org-units')
}

export function getOrgUnit(id: string) {
  return request.get(`/org-units/${id}`)
}

export function createOrgUnit(data: { name: string; unitType: string; parentId?: string }) {
  return request.post('/org-units', data)
}

export function updateOrgUnit(id: string, data: { name?: string; parentId?: string | null; unitType?: string }) {
  return request.put(`/org-units/${id}`, data)
}

export function deleteOrgUnit(id: string) {
  return request.delete(`/org-units/${id}`)
}

export function getOrgUnitUsers(id: string) {
  return request.get(`/org-units/${id}/users`)
}
