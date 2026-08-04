import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useBase } from '/$/base'
import * as api from '/$/phoenix-open-issue/api/dict'
import { hasDictTag, type DictItem } from '/$/phoenix-open-issue/core'

/** 已知数据字典分组 */
export const DICT_GROUPS = {
  issueCategory: '问题分类',
  detectionPhase: '发现阶段',
  orgUnitType: '组织类型',
  // 历史分组名 severity / priority 保持兼容；界面采用二维模型语义。
  severity: '重要度',
  priority: '紧急度',
  closeReason: '关闭理由',
  listType: '点检表类型',
} as const

export type DictGroupName = keyof typeof DICT_GROUPS

export type DictOption = { value: string; label: string }
export type DictTaggedOption = DictOption & { tags: string }

const GROUP_COLORS = ['#409EFF', '#67C23A', '#E6A23C', '#909399', '#F56C6C', '#9B59B6', '#1ABC9C', '#3498DB', '#E74C3C']

export const DICT_CACHE_STORAGE_KEY = 'phoenix-open-issue.dict-cache.v1'

type DictCacheItem = Pick<
  DictItem,
  'groupName' | 'value' | 'label' | 'sortOrder' | 'enabled' | 'tags'
>

interface DictCachePayload {
  version: 1
  items: DictCacheItem[]
}

type DictCacheStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): DictCacheStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function toCachedDictItem(value: unknown): DictItem | null {
  if (!isRecord(value)) return null
  if (typeof value.groupName !== 'string' || !(value.groupName in DICT_GROUPS)) return null
  if (typeof value.value !== 'string' || !value.value) return null
  if (typeof value.label !== 'string' || !value.label) return null
  if (typeof value.sortOrder !== 'number' || !Number.isFinite(value.sortOrder)) return null
  if (value.enabled !== 0 && value.enabled !== 1) return null
  if (typeof value.tags !== 'string') return null

  return {
    id: `cache:${value.groupName}:${value.value}`,
    groupName: value.groupName,
    value: value.value,
    label: value.label,
    sortOrder: value.sortOrder,
    enabled: value.enabled,
    tags: value.tags,
    createdAt: '',
  }
}

export function decodeDictCache(raw: string | null): DictItem[] | null {
  if (!raw) return null
  try {
    const payload: unknown = JSON.parse(raw)
    if (!isRecord(payload) || payload.version !== 1 || !Array.isArray(payload.items)) {
      return null
    }
    const items = payload.items.map(toCachedDictItem)
    if (items.length === 0 || items.some(item => item === null)) return null
    return items as DictItem[]
  } catch {
    return null
  }
}

export function encodeDictCache(items: DictItem[]): string {
  const payload: DictCachePayload = {
    version: 1,
    items: items.map(item => ({
      groupName: item.groupName,
      value: item.value,
      label: item.label,
      sortOrder: item.sortOrder,
      enabled: item.enabled,
      tags: item.tags,
    })),
  }
  return JSON.stringify(payload)
}

export const useDictStore = defineStore('phoenix-open-issue-dict', () => {
  const { user: hostUser } = useBase()
  const items = ref<DictItem[]>([])
  /** 启用项，按 groupName 索引 */
  const groupCache = ref<Record<string, DictItem[]>>({})
  /** 显示名索引：groupName:value → label（含已禁用项） */
  const labelIndex = ref<Record<string, string>>({})
  const loaded = ref(false)
  const loading = ref(false)

  let loadPromise: Promise<void> | null = null
  let loadGeneration = 0

  function restore() {
    const storage = browserStorage()
    if (!storage) return
    try {
      const cached = decodeDictCache(storage.getItem(DICT_CACHE_STORAGE_KEY))
      if (!cached) return
      items.value = cached
      rebuildCache()
      loaded.value = true
    } catch { /* storage may be unavailable */ }
  }

  function persist() {
    const storage = browserStorage()
    if (!storage) return
    try {
      storage.setItem(DICT_CACHE_STORAGE_KEY, encodeDictCache(items.value))
    } catch { /* quota/security errors must not break dictionary display */ }
  }

  function rebuildCache() {
    const groups: Record<string, DictItem[]> = {}
    const labels: Record<string, string> = {}

    for (const item of items.value) {
      labels[`${item.groupName}:${item.value}`] = item.label
      if (!item.enabled) continue
      if (!groups[item.groupName]) groups[item.groupName] = []
      groups[item.groupName].push(item)
    }

    for (const g of Object.keys(groups)) {
      groups[g].sort((a, b) => a.sortOrder - b.sortOrder)
    }

    groupCache.value = groups
    labelIndex.value = labels
  }

  async function load(force = false) {
    if (loadPromise) return loadPromise
    if (loaded.value && !force) return

    const generation = loadGeneration
    let request!: Promise<void>
    request = (async () => {
      loading.value = true
      try {
        const res = await api.getAllDict()
        if (generation !== loadGeneration) return
        items.value = res.data
        rebuildCache()
        loaded.value = true
        persist()
      } catch { /* ignore */ }
      finally {
        if (loadPromise === request) {
          loading.value = false
          loadPromise = null
        }
      }
    })()
    loadPromise = request

    return loadPromise
  }

  const ensureLoaded = load

  function clear() {
    loadGeneration += 1
    items.value = []
    groupCache.value = {}
    labelIndex.value = {}
    loaded.value = false
    loading.value = false
    loadPromise = null
    const storage = browserStorage()
    try {
      storage?.removeItem(DICT_CACHE_STORAGE_KEY)
    } catch { /* storage may be unavailable */ }
  }

  function getGroup(groupName: string): DictItem[] {
    return groupCache.value[groupName] ?? []
  }

  function getLabel(groupName: string, value: string | null | undefined): string {
    if (!value) return ''
    return labelIndex.value[`${groupName}:${value}`] || value
  }

  function getOptions(groupName: string): DictOption[] {
    return getGroup(groupName).map(i => ({ value: i.value, label: i.label }))
  }

  function getTaggedOptions(groupName: string): DictTaggedOption[] {
    return getGroup(groupName).map(i => ({ value: i.value, label: i.label, tags: i.tags }))
  }

  function getDefaultValue(groupName: string, prefer?: string): string {
    const g = getGroup(groupName)
    if (prefer && g.some(i => i.value === prefer)) return prefer
    return g[0]?.value ?? prefer ?? ''
  }

  function getGroupColor(groupName: string, value: string): string {
    const idx = getGroup(groupName).findIndex(i => i.value === value)
    return idx >= 0 ? GROUP_COLORS[idx % GROUP_COLORS.length] : '#909399'
  }

  function getListTypeColor(value: string): string {
    return getGroupColor('listType', value)
  }

  function isCoreItem(item: DictItem): boolean {
    return hasDictTag(item.tags, 'core')
  }

  async function refresh() {
    return load(true)
  }

  // 先同步恢复非敏感显示缓存，再在进入已登录插件时刷新 Host 字典。
  // 初始 token 可能仍在 Host 恢复中，不能把“尚未恢复”误判为登出并立即删掉缓存；
  // 只有真实的已登录 -> 未登录转换才清除缓存。
  restore()
  if (hostUser.token) void refresh()
  watch(
    () => Boolean(hostUser.token),
    (loggedIn, wasLoggedIn) => {
      if (loggedIn) void refresh()
      else if (wasLoggedIn) clear()
    },
  )

  /** 各分组选项（响应式，模板可直接 dict.options.listType） */
  const options = computed(() => {
    const result = {} as Record<DictGroupName, DictOption[]>
    for (const g of Object.keys(DICT_GROUPS) as DictGroupName[]) {
      result[g] = getOptions(g)
    }
    return result
  })

  /** 各分组带 tags 的选项 */
  const taggedOptions = computed(() => {
    const result = {} as Record<DictGroupName, DictTaggedOption[]>
    for (const g of Object.keys(DICT_GROUPS) as DictGroupName[]) {
      result[g] = getTaggedOptions(g)
    }
    return result
  })

  return {
    items,
    groupCache,
    labelIndex,
    options,
    taggedOptions,
    loaded,
    loading,
    load,
    ensureLoaded,
    clear,
    getGroup,
    getLabel,
    getOptions,
    getTaggedOptions,
    getDefaultValue,
    getGroupColor,
    getListTypeColor,
    isCoreItem,
    refresh,
  }
})
