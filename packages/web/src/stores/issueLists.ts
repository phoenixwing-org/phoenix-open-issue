import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/issueLists'
import type { IssueList } from '@phoenix-wing/open-issue-core'

export const useIssueListStore = defineStore('issueLists', () => {
  const lists = ref<IssueList[]>([])
  const currentList = ref<IssueList | null>(null)
  const loading = ref(false)

  async function fetchLists() {
    loading.value = true
    try {
      const res = await api.getMyLists()
      lists.value = res.data
    } finally {
      loading.value = false
    }
  }

  async function fetchList(id: string) {
    const res = await api.getList(id)
    currentList.value = res.data
    return res.data as IssueList
  }

  async function createList(data: { name: string; list_type: string; description?: string }) {
    const res = await api.createList(data)
    lists.value.unshift(res.data)
    return res.data as IssueList
  }

  async function updateList(id: string, data: { name?: string; description?: string }) {
    const res = await api.updateList(id, data)
    const idx = lists.value.findIndex(l => l.id === id)
    if (idx >= 0) lists.value[idx] = res.data
    if (currentList.value?.id === id) currentList.value = res.data
    return res.data as IssueList
  }

  async function deleteList(id: string) {
    await api.deleteList(id)
    lists.value = lists.value.filter(l => l.id !== id)
    if (currentList.value?.id === id) currentList.value = null
  }

  return { lists, currentList, loading, fetchLists, fetchList, createList, updateList, deleteList }
})
