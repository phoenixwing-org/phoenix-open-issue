<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { getOrgTree } from '@/api/orgUnits'
import { getExternalAuthProviders, getLoginPolicy, startExternalLogin } from '@/api/auth'
import type { ExternalAuthProviderId, ExternalAuthProviderInfo, LoginPolicy } from '@open-issue/core'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const isRegister = ref(false)
const username = ref('')
const password = ref('')
const displayName = ref('')
const orgUnitId = ref('')
const orgUnits = ref<any[]>([])
const loading = ref(false)
const error = ref('')
const success = ref('')
const authProviders = ref<ExternalAuthProviderInfo[]>([])
const externalLoading = ref<ExternalAuthProviderId | ''>('')
const loginPolicy = ref<LoginPolicy | null>(null)

const localAllowed = computed(() => loginPolicy.value?.localEnabled !== false)
const showExternal = computed(() => localAllowed.value
  ? authProviders.value.length > 0
  : authProviders.value.length > 0)
const showLocalForm = computed(() => localAllowed.value)
const onlyExternal = computed(() => !localAllowed.value && authProviders.value.length > 0)

function flattenTree(nodes: any[], depth = 0): any[] {
  const result: any[] = []
  for (const n of nodes) {
    result.push({ ...n, _depth: depth })
    if (n.children) result.push(...flattenTree(n.children, depth + 1))
  }
  return result
}

onMounted(async () => {
  const [orgResult, providersResult, policyResult] = await Promise.allSettled([
    getOrgTree(),
    getExternalAuthProviders(),
    getLoginPolicy(),
  ])
  if (orgResult.status === 'fulfilled') orgUnits.value = flattenTree(orgResult.value.data)
  if (providersResult.status === 'fulfilled') authProviders.value = providersResult.value.data
  if (policyResult.status === 'fulfilled') {
    loginPolicy.value = policyResult.value.data
    if (!policyResult.value.data.localEnabled) isRegister.value = false
  }
})

async function startExternal(provider: ExternalAuthProviderId) {
  error.value = ''
  externalLoading.value = provider
  try {
    const returnTo = typeof route.query.redirect === 'string' ? route.query.redirect : '/dashboard'
    const res = await startExternalLogin(provider, returnTo)
    window.location.assign(res.data.authorizationUrl)
  } catch (e: any) {
    error.value = e.response?.data?.message || '无法发起飞书登录'
    externalLoading.value = ''
  }
}

async function submit() {
  error.value = ''
  success.value = ''
  if (!localAllowed.value) {
    error.value = '管理员已关闭本地账号登录'
    return
  }
  loading.value = true
  try {
    if (isRegister.value) {
      const result = await auth.register({
        username: username.value, password: password.value,
        displayName: displayName.value, orgUnitId: orgUnitId.value || undefined,
      })
      if ((result as any).pending) {
        success.value = '注册成功！请等待管理员批准后再登录。'
        isRegister.value = false
        username.value = ''
        password.value = ''
      } else {
        router.push((route.query.redirect as string) || '/dashboard')
      }
    } else {
      await auth.login(username.value, password.value)
      router.push((route.query.redirect as string) || '/dashboard')
    }
  } catch (e: any) {
    error.value = e.response?.data?.message || e.message || '操作失败'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <span class="login-brand">P</span>
        <h1>Open Issue List</h1>
        <p>
          <template v-if="onlyExternal">使用第三方账号登录</template>
          <template v-else>{{ isRegister ? '创建新账号' : '登录以继续' }}</template>
        </p>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" style="margin-bottom:16px" />
      <el-alert v-if="success" :title="success" type="success" show-icon closable @close="success = ''" style="margin-bottom:16px" />

      <el-alert
        v-if="loginPolicy && !loginPolicy.localEnabled && !authProviders.length"
        title="当前未开放任何登录方式，请联系管理员。"
        type="warning"
        show-icon
        :closable="false"
        style="margin-bottom:16px"
      />

      <el-form v-if="showLocalForm" @submit.prevent="submit" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="username" placeholder="输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="password" type="password" placeholder="输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item v-if="isRegister" label="显示名称">
          <el-input v-model="displayName" placeholder="可选" size="large" />
        </el-form-item>
        <el-form-item v-if="isRegister" label="归属组织">
          <el-select v-model="orgUnitId" placeholder="选择组织（默认待定组）" clearable size="large" style="width:100%">
            <el-option v-for="u in orgUnits" :key="u.id" :label="'　'.repeat(u._depth) + u.name" :value="u.id" />
          </el-select>
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" native-type="submit" style="width:100%">
          {{ isRegister ? '注册' : '登录' }}
        </el-button>
      </el-form>

      <template v-if="showExternal">
        <el-divider v-if="showLocalForm">或</el-divider>
        <el-button
          v-for="provider in authProviders"
          :key="provider.id"
          size="large"
          class="external-login-button"
          :loading="externalLoading === provider.id"
          :disabled="!!externalLoading"
          @click="startExternal(provider.id)"
        >
          <span class="feishu-mark">🪶</span>{{ provider.buttonText }}
        </el-button>
      </template>

      <div v-if="showLocalForm" class="login-footer">
        <el-button link type="primary" @click="isRegister = !isRegister">
          {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
        </el-button>
      </div>

      <div v-if="showLocalForm" class="login-hint">
        <el-divider />
        <p style="color:#909399;font-size:0.8rem">演示账号: admin / 123456</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
.login-card {
  width: min(400px, 92vw);
  padding: 36px 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,.15);
}
.login-header { text-align: center; margin-bottom: 24px; }
.login-brand {
  display: inline-grid; place-items: center;
  width: 48px; height: 48px; border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff; font-weight: 700; font-size: 1.4rem; margin-bottom: 12px;
}
.login-header h1 { margin: 0 0 6px; font-size: 1.4rem; color: #303133; }
.login-header p { margin: 0; color: #909399; font-size: .9rem; }
.login-footer { text-align: center; margin-top: 16px; }
.external-login-button { width: 100%; }
.feishu-mark { margin-right: 8px; }
</style>
