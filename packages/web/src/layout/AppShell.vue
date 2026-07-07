<script setup lang="ts">
import AppToolbar from './AppToolbar.vue'
import RibbonShell from './ribbon/RibbonShell.vue'
import StatusBar from './StatusBar.vue'
import PnwShellLogPanel from 'phoenix-wing/layout/PnwShellLogPanel.vue'
import PnwChoiceDialogHost from 'phoenix-wing/components/PnwChoiceDialogHost.vue'
import PnwAsyncProgressOverlay from 'phoenix-wing/components/PnwAsyncProgressOverlay.vue'
import PnwAppModalOverlay from 'phoenix-wing/components/PnwAppModalOverlay.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { ref, computed, provide, watch } from 'vue'
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
  pagePolicy: (pageId) => {
    // 这些页面仅允许单个 Tab，再次点击激活已有
    const SINGLETON = new Set(['dashboard', 'lists', 'org', 'pushHistory', 'settings'])
    const maxTabs = SINGLETON.has(pageId) ? 1 : 30
    return { maxTabs, tabEnabled: true }
  },
  navLabel: (pageId) => {
    // 带参数的 pageId → 取基础名
    const base = pageId.split(':')[0]
    const labels: Record<string, string> = {
      dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
      org: '组织架构', pushHistory: '推送历史', settings: '设置', issueDetail: 'Issue',
    }
    return labels[base] || pageId
  },
})

const pageLabel = computed(() => {
  const labels: Record<string, string> = {
    dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
    org: '组织架构', pushHistory: '推送历史', settings: '设置', welcome: '欢迎', issueDetail: 'Issue 详情',
  }
  return labels[route.name as string] || String(route.name || '')
})

// 标签 → 完整路径映射（保留路由参数）
const tabPathMap = new Map<string, string>()

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
  const path = tabPathMap.get(tabId)
  if (path) router.push(path)
}

async function onCloseWbTab(tabId: string) {
  tabPathMap.delete(tabId)
  await wb.closeTab(tabId)
  const last = wb.tabs.value[wb.tabs.value.length - 1]
  if (last) {
    const path = tabPathMap.get(last.id)
    if (path) router.push(path)
  } else {
    router.push('/dashboard')
  }
}

async function onCloseAllWbTabs() {
  tabPathMap.clear()
  await wb.closeAllTabs()
  router.push('/dashboard')
}

// expose for child pages
provide('openTab', (pageId: string, title: string, contextKey?: string) => {
  wb.openTab({ pageId, title, contextKey })
  // URL: listDetail:<id> → /list/<id>, issueDetail:<id> → /issue/<id>
  if (pageId.startsWith('listDetail:')) {
    router.push(`/list/${contextKey || pageId.split(':')[1]}`)
  } else if (pageId.startsWith('issueDetail:')) {
    router.push(`/issue/${contextKey || pageId.split(':')[1]}`)
  } else {
    router.push(contextKey ? `/${pageId}/${contextKey}` : `/${pageId}`)
  }
})

// 让子页面更新当前标签标题
function updateTabTitle(pageId: string, title: string) {
  const tab = wb.tabs.value.find(t => t.pageId === pageId)
  if (tab) tab.title = title
}
provide('updateTabTitle', updateTabTitle)

function appendLog(msg: string) { logText.value += `[${new Date().toLocaleTimeString()}] ${msg}\n` }

// 路由 ↔ 工作台标签同步
watch(() => route.fullPath, (path) => {
  const name = route.name
  if (!name || name === 'welcome') return

  // 带参数的路由：name:param → 每个实体独立标签
  let pageId = name as string
  let title = pageLabel.value
  if (name === 'issueDetail' && route.params.id) {
    pageId = `issueDetail:${route.params.id}`
    title = `Issue #${(route.params.id as string).slice(0, 8)}`
  } else if (name === 'listDetail' && route.params.id) {
    pageId = `listDetail:${route.params.id}`
    title = `列表 #${(route.params.id as string).slice(0, 8)}`
  }

  const existing = wb.tabs.value.find(t => t.pageId === pageId)
  if (existing) {
    wb.activateTab(existing.id)
    tabPathMap.set(existing.id, path)
  } else {
    wb.openTab({ pageId, title })
    const newTab = wb.tabs.value[wb.tabs.value.length - 1]
    if (newTab) tabPathMap.set(newTab.id, path)
  }
}, { immediate: true })
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
