<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowUpBold, ArrowDownBold } from '@element-plus/icons-vue'

const props = defineProps<{ ribbonCollapsed: boolean }>()
const emit = defineEmits<{ 'update:ribbon-collapsed': [v: boolean] }>()

const router = useRouter()
const auth = useAuthStore()

function goHome() {
  router.push('/dashboard')
}

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <header class="toolbar">
    <button class="brand" @click="goHome">
      <span class="brand-mark">P</span>
      <span class="brand-title">Open Issue List</span>
    </button>

    <div class="toolbar-spacer" />

    <div class="toolbar-right">
      <span class="user-info" v-if="auth.user">
        {{ auth.user.displayName || auth.user.username }}
      </span>
      <el-button
        text
        size="small"
        :title="props.ribbonCollapsed ? '展开 Ribbon' : '折叠 Ribbon'"
        @click="emit('update:ribbon-collapsed', !props.ribbonCollapsed)"
      >
        <el-icon><ArrowDownBold v-if="props.ribbonCollapsed" /><ArrowUpBold v-else /></el-icon>
      </el-button>
      <el-button text size="small" type="danger" @click="logout">退出</el-button>
    </div>
  </header>
</template>

<style scoped>
.toolbar {
  height: 42px;
  display: flex;
  align-items: center;
  padding: 0 12px;
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  flex-shrink: 0;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
}
.brand:hover {
  background: #f0f2f5;
}
.brand-mark {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  background: linear-gradient(135deg, #409eff, #6366f1);
  color: #fff;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-size: 0.78rem;
}
.brand-title {
  font-weight: 650;
  font-size: 0.82rem;
  color: #303133;
}
.toolbar-spacer {
  flex: 1;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 4px;
}
.user-info {
  font-size: 0.82rem;
  color: #606266;
  margin-right: 8px;
}
</style>
