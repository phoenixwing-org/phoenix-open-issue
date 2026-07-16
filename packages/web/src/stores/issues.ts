import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as api from '@/api/issues'
import type { Issue } from '@open-issue/core'

export const useIssueStore = defineStore('issues', () => {
  const issues = ref<Issue[]>([])
  const currentIssue = ref<Issue | null>(null)
  const total = ref(0)
  const loading = ref(false)
  let fetchRequestId = 0

  async function fetchIssues(listId: string, params?: Record<string, any>) {
    const requestId = ++fetchRequestId
    loading.value = true
    try {
      // 列表页在前端完成筛选和分页；这里分批取回当前列表的全部 Issue，
      // 避免后端默认 50 条上限让前端只能筛选到部分数据。
      const pageSize = 500
      const allIssues: Issue[] = []
      let page = 1
      let expectedTotal = 0

      do {
        const res = await api.getIssues(listId, { ...params, page, size: pageSize })
        const pageItems = Array.isArray(res.data.items) ? res.data.items as Issue[] : []
        expectedTotal = Number(res.data.total) || 0
        allIssues.push(...pageItems)
        page++
        if (pageItems.length === 0) break
      } while (allIssues.length < expectedTotal)

      if (requestId !== fetchRequestId) return
      issues.value = allIssues
      total.value = expectedTotal
    } catch (e: any) {
      // 拦截器已弹错误，此处仅阻止向上抛
      if (requestId === fetchRequestId) {
        issues.value = []
        total.value = 0
      }
    } finally {
      if (requestId === fetchRequestId) loading.value = false
    }
  }

  async function fetchIssue(id: string) {
    const res = await api.getIssue(id)
    currentIssue.value = res.data
    return res.data as Issue
  }

  async function createIssue(listId: string, data: {
    title: string; description?: string; priority?: string
    severity?: string; category?: string; detectionPhase?: string
    reporterId?: string; assigneeId?: string; dueDate?: string; functionId?: string
    issueNo?: string; containment?: string; rootCause?: string; correctiveAction?: string
  }) {
    const res = await api.createIssue(listId, data)
    issues.value.push(res.data)
    total.value++
    ElMessage.success('Issue 创建成功')
    return res.data as Issue
  }

  async function updateIssue(id: string, data: Record<string, any>) {
    const res = await api.updateIssue(id, data)
    const idx = issues.value.findIndex(i => i.id === id)
    if (idx >= 0) issues.value[idx] = res.data
    if (currentIssue.value?.id === id) currentIssue.value = res.data
    ElMessage.success('Issue 已更新')
    return res.data as Issue
  }

  async function updateStatus(id: string, status: string) {
    const res = await api.updateIssueStatus(id, status)
    const idx = issues.value.findIndex(i => i.id === id)
    if (idx >= 0) issues.value[idx] = res.data
    if (currentIssue.value?.id === id) currentIssue.value = res.data
    ElMessage.success('状态已更新')
    return res.data as Issue
  }

  async function deleteIssue(id: string) {
    await api.deleteIssue(id)
    issues.value = issues.value.filter(i => i.id !== id)
    total.value--
    if (currentIssue.value?.id === id) currentIssue.value = null
    ElMessage.success('已删除')
  }

  async function reorder(listId: string, issueIds: string[]) {
    await api.reorderIssues(listId, issueIds)
  }

  async function setAttentionLevel(listId: string, issueId: string, attentionLevel: number) {
    await api.setIssueAttention(listId, issueId, attentionLevel)
    ElMessage.success('关注级别已更新')
    return true
  }

  return { issues, currentIssue, total, loading, fetchIssues, fetchIssue, createIssue, updateIssue, updateStatus, deleteIssue, reorder, setAttentionLevel }
})
