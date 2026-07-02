<script setup lang="ts">
import AppToolbar from './AppToolbar.vue'
import RibbonShell from './ribbon/RibbonShell.vue'
import StatusBar from './StatusBar.vue'
import PnwShellLogPanel from 'phoenix-wing/layout/PnwShellLogPanel.vue'
import PnwChoiceDialogHost from 'phoenix-wing/components/PnwChoiceDialogHost.vue'
import PnwAsyncProgressOverlay from 'phoenix-wing/components/PnwAsyncProgressOverlay.vue'
import PnwAppModalOverlay from 'phoenix-wing/components/PnwAppModalOverlay.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { ref, computed, provide } from 'vue'
import { usePnwDocumentTitle, pnwCreateWorkbench } from 'phoenix-wing'
import { useRoute, useRouter } from 'vue-router'

const ribbonCollapsed = ref(false)
const activeRibbonTab = ref('issue')
const configOpen = ref(false)
const showWelcome = ref(false)
const logExpanded = ref(false)
const logText = ref('')
const route = useRoute()
const router = useRouter()

// Workbench engine
const wb = pnwCreateWorkbench({
  pagePolicy: () => ({ maxTabs: 10, tabEnabled: true }),
  navLabel: (pageId) => {
    const labels: Record<string, string> = {
      dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
      org: '组织架构', pushHistory: '推送历史', settings: '设置',
    }
    return labels[pageId] || pageId
  },
})

const pageLabel = computed(() => {
  const labels: Record<string, string> = {
    dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
    org: '组织架构', pushHistory: '推送历史', settings: '设置', welcome: '欢迎',
  }
  return labels[route.name as string] || String(route.name || '')
})

usePnwDocumentTitle({ workspaceShort: ref('Open Issue'), workspacePath: ref(''), pageLabel })

function onRibbonOpen(pageId: string) {
  const labels: Record<string, string> = {
    dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
    org: '组织架构', pushHistory: '推送历史', settings: '设置',
  }
  wb.openTab({ pageId, title: labels[pageId] || pageId })
  router.push(`/${pageId}`)
}

function onSelectWbTab(tabId: string) {
  wb.activateTab(tabId)
  const tab = wb.getTab(tabId)
  if (tab) router.push(`/${tab.pageId}`)
}

async function onCloseWbTab(tabId: string) {
  await wb.closeTab(tabId)
  const last = wb.tabs.value[wb.tabs.value.length - 1]
  if (last) router.push(`/${last.pageId}`)
  else router.push('/dashboard')
}

async function onCloseAllWbTabs() {
  await wb.closeAllTabs()
  router.push('/dashboard')
}

// expose for child pages
provide('openTab', (pageId: string, title: string, contextKey?: string) => {
  wb.openTab({ pageId, title, contextKey })
  router.push(contextKey ? `/${pageId}/${contextKey}` : `/${pageId}`)
})

function appendLog(msg: string) { logText.value += `[${new Date().toLocaleTimeString()}] ${msg}\n` }
</script>

<template>
  <div class="shell">
    <AppToolbar
      :ribbon-collapsed="ribbonCollapsed"
      :active-ribbon-tab="activeRibbonTab"
      :wb-tabs="wb.tabBarTabs.value"
      :active-wb-tab="wb.activeTabId.value"
      @update:ribbon-collapsed="ribbonCollapsed = $event"
      @update:active-ribbon-tab="activeRibbonTab = $event"
      @open-config="configOpen = true"
      @open-welcome="showWelcome = true"
      @select-wb-tab="onSelectWbTab"
      @close-wb-tab="onCloseWbTab"
      @close-all-wb-tabs="onCloseAllWbTabs"
    />
    <div data-tour="ribbon-area">
      <RibbonShell :collapsed="ribbonCollapsed" :active-tab="activeRibbonTab" @open="onRibbonOpen" />
    </div>
    <div class="shell-body">
      <main class="shell-main" data-tour="shell-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <keep-alive :max="10">
              <component :is="Component" :key="$route.fullPath" />
            </keep-alive>
          </transition>
        </router-view>
      </main>
    </div>
    <PnwShellLogPanel v-if="logExpanded" :log-text="logText" @clear="logText = ''" @close="logExpanded = false" />
    <div data-tour="shell-status">
      <StatusBar :label="pageLabel" @toggle-log="logExpanded = !logExpanded" />
    </div>
    <PnwChoiceDialogHost />
    <PnwAsyncProgressOverlay />
    <PnwAppModalOverlay :open="configOpen" aria-label="设置" @close="configOpen = false">
      <div style="padding:24px"><h2>设置</h2><p>配置面板（待实现）</p></div>
    </PnwAppModalOverlay>
    <PnwAppModalOverlay :open="showWelcome" aria-label="欢迎" panel-class="welcome-modal" @close="showWelcome = false">
      <WelcomeView @close="showWelcome = false" />
    </PnwAppModalOverlay>
  </div>
</template>

<style scoped>
.shell { height:100%; display:flex; flex-direction:column; overflow:hidden; background:#f5f7fa; }
.shell-body { flex:1; display:flex; min-height:0; }
.shell-main { flex:1; min-width:0; overflow:auto; padding:24px; background:#f5f7fa; }
.welcome-modal .pnw-modal-panel { width: min(1000px, 96vw); max-height: min(92vh, 900px); }
</style>
