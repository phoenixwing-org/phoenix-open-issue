import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/orgUnits'
import type { OrgTreeNode } from '@phoenix-wing/open-issue-core'

export const useOrgUnitStore = defineStore('orgUnits', () => {
  const tree = ref<OrgTreeNode[]>([])
  const loading = ref(false)

  async function fetchTree() {
    loading.value = true
    try {
      const res = await api.getOrgTree()
      tree.value = res.data
    } finally {
      loading.value = false
    }
  }

  return { tree, loading, fetchTree }
})
