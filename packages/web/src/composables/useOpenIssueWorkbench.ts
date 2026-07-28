import { computed, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { pnwCreateWorkbench } from 'phoenix-wing'
import { useDictStore } from '@/stores/dict'
import { createOpenIssueNavigationNodes } from '@/layout/workbench/openIssueNavigation'

const SESSION_KEY = 'open-issue-tabs'

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

const STATIC_PAGE_PATHS: Record<string, string> = {
  dashboard: '/dashboard',
  lists: '/lists',
  org: '/org',
  pushHistory: '/push-history',
  settings: '/settings',
  functions: '/functions',
  testRunner: '/test-runner',
}

function normalizePageId(pageId: string): string {
  return pageId === 'push-history' ? 'pushHistory' : pageId
}

function pageTitle(pageId: string): string {
  const base = normalizePageId(pageId).split(':')[0]
  return PAGE_LABELS[base] ?? pageId
}

function pathFromPageId(pageId: string, contextKey?: string): string {
  const normalized = normalizePageId(pageId)
  if (normalized.startsWith('listDetail:')) {
    return `/list/${contextKey || normalized.split(':')[1]}`
  }
  if (normalized.startsWith('issueDetail:')) {
    return `/issue/${contextKey || normalized.split(':')[1]}`
  }
  return STATIC_PAGE_PATHS[normalized.split(':')[0]] ?? `/${normalized.split(':')[0]}`
}

/** Open Issue 的 Router/Tab/session 适配器；这些产品语义不进入 Wing。 */
export function useOpenIssueWorkbench() {
  const route = useRoute()
  const router = useRouter()
  const dict = useDictStore()
  const tabPathMap = new Map<string, string>()
  const nodes = createOpenIssueNavigationNodes()

  const workbench = pnwCreateWorkbench({
    pagePolicy: (pageId) => {
      const base = normalizePageId(pageId).split(':')[0]
      const singleton = new Set(['dashboard', 'lists', 'org', 'pushHistory', 'functions', 'settings', 'testRunner'])
      return { maxTabs: singleton.has(base) ? 1 : 30, tabEnabled: true }
    },
    navLabel: pageTitle,
  })

  const pageLabel = computed(() => pageTitle(normalizePageId(String(route.name || ''))))
  const activeNodeId = computed(() => {
    const name = normalizePageId(String(route.name || ''))
    if (name === 'listDetail' || name === 'issueDetail') return 'lists'
    return name
  })

  function resolveTabPath(tabId: string): string | undefined {
    const mapped = tabPathMap.get(tabId)
    if (mapped) return mapped
    const tab = workbench.tabs.value.find(item => item.id === tabId)
    return tab ? pathFromPageId(tab.pageId, tab.contextKey) : undefined
  }

  function ensureTabPath(tabId: string, pageId: string, contextKey?: string, path?: string) {
    tabPathMap.set(tabId, path ?? pathFromPageId(pageId, contextKey))
  }

  function openPage(pageId: string, title = pageTitle(pageId), contextKey?: string) {
    const normalized = normalizePageId(pageId)
    workbench.openTab({ pageId: normalized, title, contextKey })
    router.push(pathFromPageId(normalized, contextKey))
  }

  function activateNode(nodeId: string) {
    openPage(nodeId)
  }

  function selectModule(moduleId: string) {
    const module = nodes.find(node => node.id === moduleId)
    const firstPage = module?.children?.flatMap(group => group.children ?? [group])[0]
    if (firstPage) activateNode(firstPage.id)
  }

  function selectTab(tabId: string) {
    workbench.activateTab(tabId)
    const path = resolveTabPath(tabId)
    if (path) router.push(path)
  }

  async function closeTab(tabId: string) {
    const closingIndex = workbench.tabs.value.findIndex(tab => tab.id === tabId)
    tabPathMap.delete(tabId)
    if (!await workbench.closeTab(tabId)) return
    const next = workbench.tabs.value[closingIndex]
      ?? workbench.tabs.value[closingIndex - 1]
      ?? workbench.tabs.value[0]
    const path = next ? resolveTabPath(next.id) : undefined
    if (path) await router.push(path)
    else await router.push('/dashboard')
  }

  async function closeAllTabs() {
    tabPathMap.clear()
    await workbench.closeAllTabs()
    await router.push('/dashboard')
  }

  function saveTabs() {
    const paths: Record<string, string> = {}
    for (const tab of workbench.tabs.value) {
      const path = tabPathMap.get(tab.id)
      if (path) paths[tab.pageId] = path
    }
    const activeTab = workbench.tabs.value.find(tab => tab.id === workbench.activeTabId.value)
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      tabs: workbench.tabs.value.map(tab => ({
        pageId: tab.pageId,
        title: tab.title,
        contextKey: tab.contextKey,
      })),
      activePageId: activeTab?.pageId ?? null,
      paths,
    }))
  }

  function restoreTabs() {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return
      const saved = JSON.parse(raw) as {
        tabs?: { pageId: string; title: string; contextKey?: string }[]
        activePageId?: string
        paths?: Record<string, string>
      }
      if (!saved.tabs?.length) return
      for (const savedTab of saved.tabs) {
        const pageId = normalizePageId(savedTab.pageId)
        if (!workbench.tabs.value.some(tab => tab.pageId === pageId)) {
          workbench.openTab({ ...savedTab, pageId })
        }
      }
      for (const tab of workbench.tabs.value) {
        ensureTabPath(tab.id, tab.pageId, tab.contextKey, saved.paths?.[tab.pageId])
      }
      if (saved.activePageId) {
        const activeTab = workbench.tabs.value.find(tab => tab.pageId === normalizePageId(saved.activePageId!))
        if (activeTab) {
          workbench.activateTab(activeTab.id)
          const activePath = resolveTabPath(activeTab.id)
          if (activePath && route.fullPath !== activePath) router.replace(activePath)
        }
      }
    } catch {
      // 无效的历史 session 不阻塞应用启动。
    }
  }

  watch(() => route.fullPath, (path) => {
    const routeName = route.name
    if (!routeName || routeName === 'welcome') return
    let pageId = normalizePageId(String(routeName))
    let title = pageLabel.value
    if ((routeName === 'issueDetail' || routeName === 'listDetail') && route.params.id) {
      pageId = `${String(routeName)}:${route.params.id}`
    }
    const existing = workbench.tabs.value.find(tab => tab.pageId === pageId)
    const tabId = existing?.id ?? workbench.openTab({ pageId, title })
    workbench.activateTab(tabId)
    ensureTabPath(tabId, pageId, existing?.contextKey, path)
  }, { immediate: true })

  watch(() => workbench.tabs.value.length, saveTabs)
  watch(workbench.activeTabId, saveTabs)

  provide('openTab', openPage)
  provide('updateTabTitle', (pageId: string, title: string) => {
    const tab = workbench.tabs.value.find(item => item.pageId === normalizePageId(pageId))
    if (tab) {
      workbench.updateTab(tab.id, { title })
      saveTabs()
    }
  })

  onMounted(() => {
    dict.ensureLoaded()
    restoreTabs()
    window.addEventListener('beforeunload', saveTabs)
  })
  onBeforeUnmount(() => window.removeEventListener('beforeunload', saveTabs))

  return {
    navigation: {
      nodes,
      activeNodeId,
    },
    tabs: {
      items: workbench.tabBarTabs,
      activeId: workbench.activeTabId,
    },
    pageLabel,
    actions: {
      activateNode,
      selectModule,
      selectTab,
      closeTab,
      closeAllTabs,
    },
  }
}
