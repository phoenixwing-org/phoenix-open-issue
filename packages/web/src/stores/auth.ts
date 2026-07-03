import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { login as apiLogin, register as apiRegister, getMe } from '@/api/auth'
import type { LoginResult, UserPublic, RegisterResult } from '@open-issue/core'

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref<UserPublic | null>(null)

  const isLoggedIn = computed(() => !!token.value)

  function initFromStorage() {
    const stored = localStorage.getItem('token')
    if (stored) token.value = stored

    const storedUser = localStorage.getItem('user')
    if (storedUser) {
      try { user.value = JSON.parse(storedUser) } catch { /* ignore */ }
    }
  }

  async function login(username: string, password: string) {
    const res = await apiLogin(username, password)
    const data = res.data as LoginResult
    token.value = data.token
    user.value = data.user
    localStorage.setItem('token', data.token)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }

  async function register(data: { username: string; password: string; displayName?: string; orgUnitId?: string }) {
    const res = await apiRegister(data)
    const result = res.data as RegisterResult
    if (!result.pending) {
      token.value = result.token
      user.value = result.user
      localStorage.setItem('token', result.token!)
      localStorage.setItem('user', JSON.stringify(result.user))
    }
    return result
  }

  async function fetchMe() {
    if (!token.value) return
    const res = await getMe()
    user.value = res.data as UserPublic
    localStorage.setItem('user', JSON.stringify(res.data))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  // 初始化
  initFromStorage()

  return { token, user, isLoggedIn, login, register, fetchMe, logout }
})
