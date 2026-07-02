<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { ArrowUpBold, ArrowDownBold } from '@element-plus/icons-vue'
import PnwRibbonTabBar from 'phoenix-wing/layout/PnwRibbonTabBar.vue'
import PnwWorkbenchTabBar from 'phoenix-wing/layout/PnwWorkbenchTabBar.vue'

defineProps<{
  ribbonCollapsed: boolean
  activeRibbonTab: string
  wbTabs: { id: string; pageId: string; title: string; dirty: boolean }[]
  activeWbTab: string
}>()

const emit = defineEmits<{
  'update:ribbon-collapsed': [v: boolean]
  'update:active-ribbon-tab': [id: string]
  'open-config': []
  'open-welcome': []
  'select-wb-tab': [id: string]
  'close-wb-tab': [id: string]
  'close-all-wb-tabs': []
}>()

const router = useRouter()
const auth = useAuthStore()

const ribbonTabs = [
  { id: 'issue', label: 'Issue' },
  { id: 'system', label: '系统' },
]

function goHome() { emit('open-welcome') }
function logout() { auth.logout(); router.push('/login') }
</script>

<template>
  <header class="toolbar">
    <button class="brand" @click="goHome">
      <span class="brand-mark">P</span>
      <span class="brand-title">Open Issue List</span>
    </button>

    <PnwRibbonTabBar
      :tabs="ribbonTabs"
      :active-tab="activeRibbonTab"
      @update:active-tab="emit('update:active-ribbon-tab', $event)"
    />

    <PnwWorkbenchTabBar
      :tabs="wbTabs"
      :active-tab-id="activeWbTab"
      in-header
      :can-close-all="wbTabs.length > 1"
      class="toolbar-tabs"
      @select="emit('select-wb-tab', $event)"
      @close="emit('close-wb-tab', $event)"
      @close-all="emit('close-all-wb-tabs')"
    />

    <div class="toolbar-right">
      <span class="user-info" v-if="auth.user">{{ auth.user.displayName || auth.user.username }}</span>
      <el-button text size="small"
        :title="ribbonCollapsed ? '展开 Ribbon' : '折叠 Ribbon'"
        @click="emit('update:ribbon-collapsed', !ribbonCollapsed)">
        <el-icon><ArrowDownBold v-if="ribbonCollapsed" /><ArrowUpBold v-else /></el-icon>
      </el-button>
      <el-button text size="small" type="danger" @click="logout">退出</el-button>
    </div>
  </header>
</template>

<style scoped>
.toolbar { height:42px; display:flex; align-items:center; padding:0 12px; background:#fff; border-bottom:1px solid #e4e7ed; flex-shrink:0; }
.brand { display:flex; align-items:center; gap:8px; border:none; background:none; cursor:pointer; padding:4px 8px; border-radius:6px; }
.brand:hover { background:#f0f2f5; }
.brand-mark { width:26px; height:26px; border-radius:6px; background:linear-gradient(135deg,#409eff,#6366f1); color:#fff; display:grid; place-items:center; font-weight:800; font-size:.78rem; }
.brand-title { font-weight:650; font-size:.82rem; color:#303133; }
.toolbar-tabs { flex:1; min-width:0; margin:0 8px; }
.toolbar-right { display:flex; align-items:center; gap:4px; }
.user-info { font-size:.82rem; color:#606266; margin-right:8px; }
</style>
