<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const isRegister = ref(false)
const username = ref('')
const password = ref('')
const displayName = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    if (isRegister.value) {
      await auth.register({ username: username.value, password: password.value, display_name: displayName.value })
    } else {
      await auth.login(username.value, password.value)
    }
    const redirect = (route.query.redirect as string) || '/dashboard'
    router.push(redirect)
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
        <p>{{ isRegister ? '创建新账号' : '登录以继续' }}</p>
      </div>

      <el-alert v-if="error" :title="error" type="error" show-icon closable @close="error = ''" style="margin-bottom:16px" />

      <el-form @submit.prevent="submit" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="username" placeholder="输入用户名" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="password" type="password" placeholder="输入密码" size="large" show-password />
        </el-form-item>
        <el-form-item v-if="isRegister" label="显示名称">
          <el-input v-model="displayName" placeholder="可选" size="large" />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" native-type="submit" style="width:100%">
          {{ isRegister ? '注册' : '登录' }}
        </el-button>
      </el-form>

      <div class="login-footer">
        <el-button link type="primary" @click="isRegister = !isRegister">
          {{ isRegister ? '已有账号？去登录' : '没有账号？去注册' }}
        </el-button>
      </div>

      <div class="login-hint">
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
  width: 400px;
  padding: 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.15);
}
.login-header {
  text-align: center;
  margin-bottom: 24px;
}
.login-brand {
  display: inline-block;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #409eff, #6366f1);
  color: #fff;
  font-size: 1.4rem;
  font-weight: 800;
  line-height: 48px;
  margin-bottom: 8px;
}
.login-header h1 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #303133;
}
.login-header p {
  color: #909399;
  font-size: 0.85rem;
  margin-top: 4px;
}
.login-footer {
  text-align: center;
  margin-top: 12px;
}
.login-hint {
  text-align: center;
  margin-top: 8px;
}
</style>
