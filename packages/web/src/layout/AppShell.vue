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
import { usePnwDocumentTitle } from 'phoenix-wing'
import { useRoute, useRouter } from 'vue-router'

const ribbonCollapsed = ref(false)
const activeRibbonTab = ref('issue')
const configOpen = ref(false)
const showWelcome = ref(false)
const logExpanded = ref(false)
const logText = ref('')
const route = useRoute()
const router = useRouter()

// Workbench tabs — support contextKey for UUID-based dedup
interface WbTab { id: string; pageId: string; title: string; dirty: boolean; contextKey?: string }
const wbTabs = ref<WbTab[]>([])
const activeWbTab = ref('')

function openTab(pageId: string, title: string, contextKey?: string) {
  // 同 pageId + contextKey 复用 (如 listDetail:uuid)
  const key = contextKey ? `${pageId}:${contextKey}` : pageId
  const existing = wbTabs.value.find(t => (t.contextKey ? `${t.pageId}:${t.contextKey}` : t.pageId) === key)
  if (existing) {
    activeWbTab.value = existing.id
    if (contextKey) router.push(`/${pageId}/${contextKey}`)
    else router.push(`/${pageId}`)
    return
  }
  const id = `tab-${Date.now()}`
  wbTabs.value.push({ id, pageId, title, dirty: false, contextKey })
  activeWbTab.value = id
  if (contextKey) router.push(`/${pageId}/${contextKey}`)
  else router.push(`/${pageId}`)
}

function selectTab(tabId: string) {
  activeWbTab.value = tabId
  const tab = wbTabs.value.find(t => t.id === tabId)
  if (tab) {
    if (tab.contextKey) router.push(`/${tab.pageId}/${tab.contextKey}`)
    else router.push(`/${tab.pageId}`)
  }
}

function closeTab(tabId: string) {
  wbTabs.value = wbTabs.value.filter(t => t.id !== tabId)
  if (activeWbTab.value === tabId) {
    const last = wbTabs.value[wbTabs.value.length - 1]
    activeWbTab.value = last?.id ?? ''
    if (last) router.push(`/${last.pageId}`)
    else router.push('/dashboard')
  }
}

const pageTitle: Record<string, string> = {
  dashboard: '仪表盘', lists: '列表管理', listDetail: '列表详情',
  issueDetail: 'Issue 详情', org: '组织架构', pushHistory: '推送历史',
  settings: '设置', welcome: '欢迎',
}

const pageLabel = computed(() => pageTitle[route.name as string] || String(route.name || ''))

usePnwDocumentTitle({ workspaceShort: ref('Open Issue'), workspacePath: ref(''), pageLabel })

function onRibbonOpen(pageId: string) {
  openTab(pageId, pageTitle[pageId] || pageId)
}

// 暴露给子页面使用
provide('openTab', openTab)
provide('closeTab', closeTab)
provide('wbTabs', wbTabs)

function appendLog(msg: string) { logText.value += `[${new Date().toLocaleTimeString()}] ${msg}\n` }
</script>

<template>
  <div class="shell">
    <AppToolbar
      :ribbon-collapsed="ribbonCollapsed"
      :active-ribbon-tab="activeRibbonTab"
      :wb-tabs="wbTabs"
      :active-wb-tab="activeWbTab"
      @update:ribbon-collapsed="ribbonCollapsed = $event"
      @update:active-ribbon-tab="activeRibbonTab = $event"
      @open-config="configOpen = true"
      @open-welcome="showWelcome = true"
      @select-wb-tab="selectTab"
      @close-wb-tab="closeTab"
      @close-all-wb-tabs="wbTabs = []; activeWbTab = ''; router.push('/dashboard')"
    />
    <RibbonShell :collapsed="ribbonCollapsed" :active-tab="activeRibbonTab" @open="onRibbonOpen" />
    <div class="shell-body">
      <main class="shell-main">
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
    <StatusBar :label="pageLabel" @toggle-log="logExpanded = !logExpanded" />
    <PnwChoiceDialogHost />
    <PnwAsyncProgressOverlay />
    <PnwAppModalOverlay :open="configOpen" aria-label="设置" @close="configOpen = false">
      <div style="padding:24px"><h2>设置</h2><p>配置面板（待实现）</p></div>
    </PnwAppModalOverlay>

    <!-- 欢迎页全屏覆盖 -->
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
