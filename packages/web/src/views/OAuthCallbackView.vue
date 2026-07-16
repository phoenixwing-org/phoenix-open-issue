<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const loading = ref(true)
const success = ref('')
const error = ref('')
const destination = computed(() => safeReturnTo(route.query.returnTo, auth.token ? '/settings?tab=login-methods' : '/login'))

const ERROR_MESSAGES: Record<string, string> = {
  access_denied: '你已取消飞书授权，账号没有发生变化。',
  invalid_state: '登录请求已过期或已经使用，请重新发起。',
  missing_code: '飞书没有返回授权码，请重新尝试。',
  provider_unavailable: '飞书认证服务暂时不可用，请稍后重试。',
  provider_response_error: '飞书认证失败，请重新发起登录。',
  identity_incomplete: '飞书返回的用户身份不完整，请联系管理员。',
  tenant_not_allowed: '当前飞书组织未获准登录本系统。',
  identity_not_bound: '该飞书账号尚未绑定，请先使用本地账号登录，再到设置中绑定飞书。',
  identity_already_bound: '该飞书账号已绑定其他本系统用户，请联系管理员核对。',
  local_account_unavailable: '本系统账号尚未批准或已被禁用，请联系管理员。',
  oauth_failed: '第三方登录没有完成，请重新尝试。',
}

onMounted(async () => {
  const callbackError = stringQuery(route.query.error)
  if (callbackError) {
    error.value = ERROR_MESSAGES[callbackError] || '第三方登录没有完成，请重新尝试。'
    loading.value = false
    return
  }

  if (route.query.status === 'linked') {
    success.value = '飞书账号绑定成功，正在返回登录方式设置。'
    loading.value = false
    window.setTimeout(() => router.replace(destination.value), 800)
    return
  }

  const ticket = stringQuery(route.query.ticket)
  if (!ticket) {
    error.value = '第三方登录票据缺失，请重新发起登录。'
    loading.value = false
    return
  }

  try {
    const result = await auth.loginWithExternalTicket(ticket)
    success.value = '飞书登录成功，正在进入系统。'
    await router.replace(safeReturnTo(result.returnTo, '/dashboard'))
  } catch (e: any) {
    error.value = e.response?.data?.message || '登录票据无效或已过期，请重新发起。'
    loading.value = false
  }
})

function stringQuery(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function safeReturnTo(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
  return value
}
</script>

<template>
  <div class="callback-page">
    <div class="callback-card">
      <div class="callback-icon">🪶</div>
      <h1>飞书登录</h1>
      <div v-if="loading" class="callback-status">
        <el-icon class="is-loading" :size="28"><Loading /></el-icon>
        <p>正在安全验证登录结果…</p>
      </div>
      <el-alert v-else-if="success" :title="success" type="success" show-icon :closable="false" />
      <template v-else>
        <el-alert :title="error" type="error" show-icon :closable="false" />
        <el-button type="primary" style="width:100%;margin-top:18px" @click="router.replace(destination)">
          {{ auth.token ? '返回设置' : '返回登录' }}
        </el-button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.callback-page { min-height: 100vh; display: grid; place-items: center; padding: 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.callback-card { width: min(420px, 100%); padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,.15); text-align: center; }
.callback-icon { font-size: 42px; margin-bottom: 8px; }
.callback-card h1 { margin: 0 0 22px; font-size: 1.3rem; color: #303133; }
.callback-status { color: #606266; }
.callback-status p { margin: 12px 0 0; }
</style>
