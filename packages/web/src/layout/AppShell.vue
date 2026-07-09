<script setup lang="ts">
import AppToolbar from './AppToolbar.vue'
import RibbonShell from './ribbon/RibbonShell.vue'
import StatusBar from './StatusBar.vue'
import PnwShellLogPanel from 'phoenix-wing/layout/PnwShellLogPanel.vue'
import PnwChoiceDialogHost from 'phoenix-wing/components/PnwChoiceDialogHost.vue'
import PnwAsyncProgressOverlay from 'phoenix-wing/components/PnwAsyncProgressOverlay.vue'
import PnwAppModalOverlay from 'phoenix-wing/components/PnwAppModalOverlay.vue'
import WelcomeView from '@/views/WelcomeView.vue'
import { useDictStore } from '@/stores/dict'
import { ref, computed, provide, watch, onMounted } from 'vue'
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
const dict = useDictStore()

function normalizePageId(pageId: string): string {
  if (pageId === 'push-history') return 'pushHistory'
  return pageId
}

const PAGE_LABELS: Record<string, string> = {
  dashboard: '仪表盘',
  lists: '列表管理',
  listDetail: '列表详情',
  org: '组织架构',
  pushHistory: '推送历史',
  functions: '功能表',
  settings: '设置',
  testRunner: '单元测试',
  issueDetail: 'Issue',
  welcome: '欢迎',
}

function pageTitle(pageId: string): string {
  const base = normalizePageId(pageId).split(':')[0]
  return PAGE_LABELS[base] ?? pageId
}

// Workbench engine
const wb = pnwCreateWorkbench({
  pagePolicy: (pageId) => {
    const base = normalizePageId(pageId).split(':')[0]
    const SINGLETON = new Set(['dashboard', 'lists', 'org', 'pushHistory', 'functions', 'settings', 'testRunner'])
    const maxTabs = SINGLETON.has(base) ? 1 : 30
    return { maxTabs, tabEnabled: true }
  },
  navLabel: (pageId) => pageTitle(pageId),
})

const pageLabel = computed(() => pageTitle(normalizePageId(String(route.name || ''))))

// 标签 → 完整路径映射（保留路由参数）
const tabPathMap = new Map<string, string>()

const STATIC_PAGE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  lists: '/lists',
  org: '/org',
  pushHistory: '/push-history',
  settings: '/settings',
  functions: '/functions',
  testRunner: '/test-runner',
}

function pathFromPageId(pageId: string, contextKey?: string): string {
  const normalized = normalizePageId(pageId)
  if (normalized.startsWith('listDetail:')) {
    return `/list/${contextKey || normalized.split(':')[1]}`
  }
  if (normalized.startsWith('issueDetail:')) {
    return `/issue/${contextKey || normalized.split(':')[1]}`
  }
  const base = normalized.split(':')[0]
  return STATIC_PAGE_PATHS[base] ?? `/${base}`
}

function resolveTabPath(tabId: string): string | undefined {
  const mapped = tabPathMap.get(tabId)
  if (mapped) return mapped
  const tab = wb.tabs.value.find(t => t.id === tabId)
  if (!tab) return undefined
  return pathFromPageId(tab.pageId, tab.contextKey)
}

function ensureTabPath(tabId: string, pageId: string, contextKey?: string, path?: string) {
  tabPathMap.set(tabId, path ?? pathFromPageId(pageId, contextKey))
}

usePnwDocumentTitle({ workspaceShort: ref('Open Issue'), workspacePath: ref(''), pageLabel })

function onRibbonOpen(pageId: string) {
  const normalized = normalizePageId(pageId)
  wb.openTab({ pageId: normalized, title: pageTitle(normalized) })
  router.push(pathFromPageId(normalized))
}

function onSelectWbTab(tabId: string) {
  wb.activateTab(tabId)
  const path = resolveTabPath(tabId)
  if (path) router.push(path)
}

async function onCloseWbTab(tabId: string) {
  tabPathMap.delete(tabId)
  await wb.closeTab(tabId)
  const last = wb.tabs.value[wb.tabs.value.length - 1]
  if (last) {
    const path = resolveTabPath(last.id)
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
  const normalized = normalizePageId(pageId)
  wb.openTab({ pageId: normalized, title, contextKey })
  // URL: listDetail:<id> → /list/<id>, issueDetail:<id> → /issue/<id>
  if (normalized.startsWith('listDetail:')) {
    router.push(`/list/${contextKey || normalized.split(':')[1]}`)
  } else if (normalized.startsWith('issueDetail:')) {
    router.push(`/issue/${contextKey || normalized.split(':')[1]}`)
  } else {
    router.push(pathFromPageId(normalized, contextKey))
  }
})

// 让子页面更新当前标签标题
function updateTabTitle(pageId: string, title: string) {
  const normalized = normalizePageId(pageId)
  const tab = wb.tabs.value.find(t => t.pageId === normalized)
  if (tab) tab.title = title
}
provide('updateTabTitle', updateTabTitle)

function appendLog(msg: string) { logText.value += `[${new Date().toLocaleTimeString()}] ${msg}\n` }

// 路由 ↔ 工作台标签同步
watch(() => route.fullPath, (path) => {
  const name = route.name
  if (!name || name === 'welcome') return

  // 带参数的路由：name:param → 每个实体独立标签
  let pageId = normalizePageId(name as string)
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
    ensureTabPath(existing.id, pageId, existing.contextKey, path)
  } else {
    wb.openTab({ pageId, title })
    const newTab = wb.tabs.value[wb.tabs.value.length - 1]
    if (newTab) ensureTabPath(newTab.id, pageId, newTab.contextKey, path)
  }
}, { immediate: true })

// ── Tab 持久化：刷新页面保留已打开标签 ──
const SESSION_KEY = 'open-issue-tabs'

// 启动时恢复
function restoreTabs() {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const saved = JSON.parse(raw) as {
      tabs: { id?: string; pageId: string; title: string; contextKey?: string }[]
      activeTabId?: string
      activePageId?: string
      paths?: Record<string, string>
    }
    if (!saved.tabs?.length) return

    const pathByPageId = new Map<string, string>()
    let activePageId = saved.activePageId
    if (!activePageId && saved.activeTabId) {
      activePageId = saved.tabs.find(t => t.id === saved.activeTabId)?.pageId
    }

    for (const t of saved.tabs) {
      const pageId = normalizePageId(t.pageId)
      const title = pageTitle(pageId)
      if (saved.paths?.[t.pageId]) {
        pathByPageId.set(pageId, saved.paths[t.pageId])
      } else if (saved.paths?.[pageId]) {
        pathByPageId.set(pageId, saved.paths[pageId])
      } else if (t.id && saved.paths?.[t.id]) {
        pathByPageId.set(pageId, saved.paths[t.id])
      }
      t.pageId = pageId
      t.title = title
    }

    if (activePageId) activePageId = normalizePageId(activePageId)

    for (const t of saved.tabs) {
      if (!wb.tabs.value.some(x => x.pageId === t.pageId)) {
        wb.openTab({ pageId: t.pageId, title: t.title, contextKey: t.contextKey })
      }
    }

    for (const tab of wb.tabs.value) {
      ensureTabPath(
        tab.id,
        tab.pageId,
        tab.contextKey,
        pathByPageId.get(tab.pageId) ?? pathFromPageId(tab.pageId, tab.contextKey),
      )
    }

    if (activePageId) {
      const activeTab = wb.tabs.value.find(t => t.pageId === activePageId)
      if (activeTab) {
        wb.activateTab(activeTab.id)
        const activePath = resolveTabPath(activeTab.id)
        if (activePath && route.fullPath !== activePath) {
          router.replace(activePath)
        }
      }
    }
  } catch { /* ignore */ }
}

function saveTabs() {
  const paths: Record<string, string> = {}
  for (const tab of wb.tabs.value) {
    const path = tabPathMap.get(tab.id)
    if (path) paths[tab.pageId] = path
  }
  const activeTab = wb.tabs.value.find(t => t.id === wb.activeTabId.value)
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    tabs: wb.tabs.value.map(t => ({ pageId: t.pageId, title: t.title, contextKey: t.contextKey })),
    activePageId: activeTab?.pageId ?? null,
    paths,
  }))
}

// 标签变化时自动保存
watch(() => wb.tabs.value.length, saveTabs)
watch(wb.activeTabId, saveTabs)

// 页面关闭前保存
window.addEventListener('beforeunload', saveTabs)

// 首次挂载时恢复（在 route watcher 之后，避免覆盖）
onMounted(() => {
  dict.ensureLoaded()
  if (localStorage.getItem(SESSION_KEY)) restoreTabs()
})
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
