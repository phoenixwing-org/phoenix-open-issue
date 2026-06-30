import request from './request'

export function login(username: string, password: string) {
  return request.post('/auth/login', { username, password })
}

export function register(data: { username: string; password: string; email?: string; display_name?: string }) {
  return request.post('/auth/register', data)
}

export function getMe() {
  return request.get('/auth/me')
}

export function getAllUsers() {
  return request.get('/users')
}
