import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as api from '@/api/issueLists'
import type { IssueList } from '@open-issue/core'

export const useIssueListStore = defineStore('issueLists', () => {
  const lists = ref<IssueList[]>([])
  const currentList = ref<IssueList | null>(null)
  const loading = ref(false)

  async function fetchLists(includeArchived = false) {
    loading.value = true
    try {
      const res = await api.getMyLists(includeArchived)
      lists.value = res.data
    } catch (e: any) {
    } finally {
      loading.value = false
    }
  }

  async function fetchAllLists(includeArchived = false, includeDeleted = false) {
    loading.value = true
    try {
      const res = await api.getAllLists(includeArchived, includeDeleted)
      lists.value = res.data
    } catch (e: any) {
    } finally {
      loading.value = false
    }
  }

  async function fetchDeletedLists() {
    loading.value = true
    try {
      const res = await api.getDeletedLists()
      lists.value = res.data
    } catch (e: any) {
    } finally {
      loading.value = false
    }
  }

  async function fetchArchivedLists() {
    loading.value = true
    try {
      const res = await api.getArchivedLists()
      lists.value = res.data
    } catch (e: any) {
    } finally {
      loading.value = false
    }
  }

  async function fetchList(id: string) {
    const res = await api.getList(id)
    currentList.value = res.data
    return res.data as IssueList
  }

  async function createList(data: { name: string; listType: string; description?: string; orgUnitId?: string }) {
    const res = await api.createList(data)
    lists.value.unshift(res.data)
    ElMessage.success('列表创建成功')
    return res.data as IssueList
  }

  async function updateList(id: string, data: { name?: string; description?: string; listType?: string; ownerId?: string }) {
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
    ElMessage.success('列表已删除')
  }

  async function archiveList(id: string, archived: boolean) {
    await api.archiveList(id, archived)
    lists.value = lists.value.filter(l => l.id !== id)
    ElMessage.success(archived ? '已归档' : '已取消归档')
  }

  async function restoreList(id: string) {
    await api.restoreList(id)
    lists.value = lists.value.filter(l => l.id !== id)
    ElMessage.success('列表已恢复')
  }

  return { lists, currentList, loading, fetchLists, fetchAllLists, fetchArchivedLists, fetchDeletedLists, fetchList, createList, updateList, deleteList, archiveList, restoreList }
})
