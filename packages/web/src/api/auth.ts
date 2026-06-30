import request from './request'

export function login(username: string, password: string) {
  return request.post('/auth/login', { username, password })
}

export function register(data: { username: string; password: string; email?: string; displayName?: string }) {
  return request.post('/auth/register', data)
}

export function getMe() {
  return request.get('/auth/me')
}

export function getAllUsers() {
  return request.get('/users')
}

export function getPendingUsers() {
  return request.get('/users/pending')
}

export function approveUser(userId: string, approved: boolean) {
  return request.patch(`/users/${userId}/approve`, { approved })
}

export function updateUserOrg(userId: string, orgUnitId: string | null) {
  return request.patch(`/users/${userId}/org`, { orgUnitId })
}

export function updateUser(userId: string, data: { displayName?: string; email?: string; orgUnitId?: string | null }) {
  return request.patch(`/users/${userId}`, data)
}
