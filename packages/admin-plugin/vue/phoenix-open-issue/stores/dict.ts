import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
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

export const useDictStore = defineStore('phoenix-open-issue-dict', () => {
  const items = ref<DictItem[]>([])
  /** 启用项，按 groupName 索引 */
  const groupCache = ref<Record<string, DictItem[]>>({})
  /** 显示名索引：groupName:value → label（含已禁用项） */
  const labelIndex = ref<Record<string, string>>({})
  const loaded = ref(false)
  const loading = ref(false)

  let loadPromise: Promise<void> | null = null

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
    if (loaded.value && !force) return
    if (loadPromise && !force) return loadPromise

    loadPromise = (async () => {
      loading.value = true
      try {
        const res = await api.getAllDict()
        items.value = res.data
        rebuildCache()
        loaded.value = true
      } catch { /* ignore */ }
      finally {
        loading.value = false
        loadPromise = null
      }
    })()

    return loadPromise
  }

  const ensureLoaded = load

  function clear() {
    items.value = []
    groupCache.value = {}
    labelIndex.value = {}
    loaded.value = false
    loadPromise = null
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
    loaded.value = false
    return load(true)
  }

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
