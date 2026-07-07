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

// 返回列表 → 复数
export function getAllUsers(params?: Record<string, any>) {
  return request.get('/users', { params })
}

export function getPendingUsers() {
  return request.get('/users/pending')
}

// 单个操作 → 单数
export function approveUser(userId: string) {
  return request.patch(`/user/${userId}/approve`)
}

export function updateUserOrg(userId: string, orgUnitId: string | null) {
  return request.patch(`/user/${userId}/org`, { orgUnitId })
}

export function updateUser(userId: string, data: { displayName?: string; email?: string; orgUnitId?: string | null }) {
  return request.patch(`/user/${userId}`, data)
}

export function disableUser(userId: string) {
  return request.patch(`/user/${userId}/disable`)
}

export function enableUser(userId: string) {
  return request.patch(`/user/${userId}/enable`)
}

export function adminResetPassword(userId: string, newPassword: string) {
  return request.patch(`/user/${userId}/reset-password`, { newPassword })
}

export function changePassword(oldPassword: string, newPassword: string) {
  return request.patch('/auth/change-password', { oldPassword, newPassword })
}
