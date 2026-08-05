import request from './request'

export function getFunctions(params?: Record<string, any>) {
  return request.get('/functions', { params })
}

export function getFunction(id: string) {
  return request.get(`/function/${id}`)
}

export function createFunction(data: Record<string, any>) {
  return request.post('/functions', data)
}

export function updateFunction(id: string, data: Record<string, any>) {
  return request.put(`/function/${id}`, data)
}

export function deleteFunction(id: string) {
  return request.delete(`/function/${id}`)
}

export function setFunctionEnabled(id: string, enabled: boolean) {
  return request.patch(`/function/${id}/enabled`, { enabled })
}

export function importFunctions(rows: Record<string, any>[]) {
  return request.post('/functions/import', { rows })
}

export function exportFunctions() {
  return request.get('/functions/export')
}
