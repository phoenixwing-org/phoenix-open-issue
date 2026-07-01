<script setup lang="ts">
import AppToolbar from './AppToolbar.vue'
import RibbonShell from './ribbon/RibbonShell.vue'
import StatusBar from './StatusBar.vue'
import PnwChoiceDialogHost from 'phoenix-wing/components/PnwChoiceDialogHost.vue'
import PnwAsyncProgressOverlay from 'phoenix-wing/components/PnwAsyncProgressOverlay.vue'
import PnwAppModalOverlay from 'phoenix-wing/components/PnwAppModalOverlay.vue'
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'

const ribbonCollapsed = ref(false)
const configOpen = ref(false)
const route = useRoute()

const pageLabel = computed(() => {
  const labels: Record<string, string> = {
    dashboard: '仪表盘',
    lists: '列表管理',
    listDetail: '列表详情',
    issueDetail: 'Issue 详情',
    org: '组织架构',
    pushHistory: '推送历史',
    settings: '设置',
  }
  return labels[route.name as string] || String(route.name || '')
})
</script>

<template>
  <div class="shell">
    <AppToolbar
      :ribbon-collapsed="ribbonCollapsed"
      @update:ribbon-collapsed="ribbonCollapsed = $event"
      @open-config="configOpen = true"
    />
    <RibbonShell :collapsed="ribbonCollapsed" />
    <div class="shell-body">
      <main class="shell-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>
    </div>
    <StatusBar :label="pageLabel" />

    <!-- phoenix-wing 全局覆盖层 -->
    <PnwChoiceDialogHost />
    <PnwAsyncProgressOverlay />
    <PnwAppModalOverlay
      :open="configOpen"
      aria-label="设置"
      @close="configOpen = false"
    >
      <div style="padding: 24px;">
        <h2>设置</h2>
        <p>配置面板（待实现）</p>
      </div>
    </PnwAppModalOverlay>
  </div>
</template>

<style scoped>
.shell {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #f5f7fa;
}
.shell-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.shell-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 16px;
  background: #f5f7fa;
}
</style>
