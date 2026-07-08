import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/functions'
import type { PoiFunction } from '@open-issue/core'

export const useFunctionStore = defineStore('functions', () => {
  const items = ref<PoiFunction[]>([])
  const loading = ref(false)
  const loaded = ref(false)

  async function load(params?: Record<string, any>) {
    loading.value = true
    try {
      const res = await api.getFunctions(params)
      items.value = res.data
      loaded.value = true
    } finally {
      loading.value = false
    }
  }

  async function refresh() {
    loaded.value = false
    return load()
  }

  return { items, loading, loaded, load, refresh }
})
