import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useBase } from '/$/base'
import { toIssueUser } from '/$/phoenix-open-issue/adapters/host-user'
import { useDictStore } from '/$/phoenix-open-issue/stores/dict'

/**
 * 旧 Issue View 的 actor 兼容端口。
 *
 * 登录、token 刷新和退出跳转全部由 Phoenix Admin Host 管理；插件不再维护
 * localStorage 会话，也不提供第二套登录/注册流程。
 */
export const useAuthStore = defineStore('phoenix-open-issue-auth', () => {
  const { user: hostUser } = useBase()

  const token = computed(() => hostUser.token ?? '')
  const user = computed(() => toIssueUser(hostUser.info))
  const isLoggedIn = computed(() => Boolean(token.value && user.value))

  async function fetchMe() {
    const info = await hostUser.get()
    return toIssueUser(info)
  }

  async function logout() {
    useDictStore().clear()
    await hostUser.logout()
  }

  return { token, user, isLoggedIn, fetchMe, logout }
})
