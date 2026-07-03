import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/dict'
import type { DictItem } from '@open-issue/core'

export const useDictStore = defineStore('dict', () => {
  const items = ref<DictItem[]>([])
  const loaded = ref(false)

  async function load() {
    if (loaded.value) return
    try {
      const res = await api.getAllDict()
      items.value = res.data
      loaded.value = true
    } catch { /* ignore */ }
  }

  function getGroup(groupName: string): DictItem[] {
    return items.value.filter(i => i.groupName === groupName && i.enabled).sort((a, b) => a.sortOrder - b.sortOrder)
  }

  function getLabel(groupName: string, value: string): string {
    const item = items.value.find(i => i.groupName === groupName && i.value === value && i.enabled)
    return item?.label || value
  }

  function getOptions(groupName: string) {
    const g = getGroup(groupName)
    if (!g || !g.length) return []
    return g.map(i => ({ value: i.value, label: i.label }))
  }

  /** 返回带 tags 的选项（供 PnwDictSelect 分组用） */
  function getTaggedOptions(groupName: string) {
    const g = getGroup(groupName)
    if (!g || !g.length) return []
    return g.map(i => ({ value: i.value, label: i.label, tags: (i as any).tags }))
  }

  function refresh() {
    loaded.value = false
    return load()
  }

  return { items, loaded, load, getGroup, getLabel, getOptions, getTaggedOptions, refresh }
})
