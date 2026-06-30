import { defineStore } from 'pinia'
import { ref } from 'vue'
import * as api from '@/api/issues'
import type { Issue } from '@phoenix-wing/open-issue-core'

export const useIssueStore = defineStore('issues', () => {
  const issues = ref<Issue[]>([])
  const currentIssue = ref<Issue | null>(null)
  const total = ref(0)
  const loading = ref(false)

  async function fetchIssues(listId: string, params?: Record<string, any>) {
    loading.value = true
    try {
      const res = await api.getIssues(listId, params)
      issues.value = res.data.items
      total.value = res.data.total
    } finally {
      loading.value = false
    }
  }

  async function fetchIssue(id: string) {
    const res = await api.getIssue(id)
    currentIssue.value = res.data
    return res.data as Issue
  }

  async function createIssue(listId: string, data: { title: string; description?: string; priority?: string }) {
    const res = await api.createIssue(listId, data)
    issues.value.push(res.data)
    total.value++
    return res.data as Issue
  }

  async function updateIssue(id: string, data: Record<string, any>) {
    const res = await api.updateIssue(id, data)
    const idx = issues.value.findIndex(i => i.id === id)
    if (idx >= 0) issues.value[idx] = res.data
    if (currentIssue.value?.id === id) currentIssue.value = res.data
    return res.data as Issue
  }

  async function updateStatus(id: string, status: string) {
    const res = await api.updateIssueStatus(id, status)
    const idx = issues.value.findIndex(i => i.id === id)
    if (idx >= 0) issues.value[idx] = res.data
    if (currentIssue.value?.id === id) currentIssue.value = res.data
    return res.data as Issue
  }

  async function deleteIssue(id: string) {
    await api.deleteIssue(id)
    issues.value = issues.value.filter(i => i.id !== id)
    total.value--
    if (currentIssue.value?.id === id) currentIssue.value = null
  }

  async function reorder(listId: string, issueIds: string[]) {
    await api.reorderIssues(listId, issueIds)
  }

  return { issues, currentIssue, total, loading, fetchIssues, fetchIssue, createIssue, updateIssue, updateStatus, deleteIssue, reorder }
})
