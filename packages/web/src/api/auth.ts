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

export function getAllUsers(params?: Record<string, any>) {
  return request.get('/users', { params })
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

// ── 用户禁用 ──
export function disableUser(userId: string) {
  return request.patch(`/users/${userId}/disable`)
}

export function enableUser(userId: string) {
  return request.patch(`/users/${userId}/enable`)
}

// ── 密码 ──
export function changePassword(oldPassword: string, newPassword: string) {
  return request.patch('/auth/change-password', { oldPassword, newPassword })
}

export function adminResetPassword(userId: string, newPassword: string) {
  return request.patch(`/users/${userId}/reset-password`, { newPassword })
}
