import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as api from '/$/phoenix-open-issue/api/issues'
import type { Issue } from '/$/phoenix-open-issue/core'

export interface IssueEntityRequestState {
  requestId: number
  loading: boolean
  error: string | null
}

export const useIssueStore = defineStore('phoenix-open-issue-issues', () => {
  const issues = ref<Issue[]>([])
  const issueById = ref<Record<string, Issue>>({})
  const issueRequestById = ref<Record<string, IssueEntityRequestState>>({})
  const total = ref(0)
  const loading = ref(false)
  let fetchRequestId = 0

  function getIssueById(id: string): Issue | null {
    return issueById.value[id] ?? null
  }

  function getIssueRequestState(id: string): IssueEntityRequestState {
    return issueRequestById.value[id] ?? { requestId: 0, loading: false, error: null }
  }

  function setIssueEntity(issue: Issue): void {
    issueById.value = { ...issueById.value, [issue.id]: issue }
  }

  function removeIssueEntity(id: string): void {
    if (!(id in issueById.value)) return
    const next = { ...issueById.value }
    delete next[id]
    issueById.value = next
  }

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
    const requestId = getIssueRequestState(id).requestId + 1
    issueRequestById.value = {
      ...issueRequestById.value,
      [id]: { requestId, loading: true, error: null },
    }
    try {
      const res = await api.getIssue(id)
      const issue = res.data as Issue
      if (getIssueRequestState(id).requestId === requestId) setIssueEntity(issue)
      return getIssueById(id) ?? issue
    } catch (error) {
      if (getIssueRequestState(id).requestId === requestId) {
        issueRequestById.value = {
          ...issueRequestById.value,
          [id]: {
            requestId,
            loading: true,
            error: error instanceof Error ? error.message : 'Issue 加载失败',
          },
        }
      }
      throw error
    } finally {
      if (getIssueRequestState(id).requestId === requestId) {
        issueRequestById.value = {
          ...issueRequestById.value,
          [id]: { ...getIssueRequestState(id), loading: false },
        }
      }
    }
  }

  async function createIssue(listId: string, data: {
    title: string; description?: string; priority?: string
    severity?: string; category?: string; detectionPhase?: string
    reporterId?: string; assigneeId?: string; dueDate?: string; functionId?: string
    issueNo?: string
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
    setIssueEntity(res.data)
    ElMessage.success('Issue 已更新')
    return res.data as Issue
  }

  async function updateStatus(id: string, status: string) {
    const res = await api.updateIssueStatus(id, status)
    const idx = issues.value.findIndex(i => i.id === id)
    if (idx >= 0) issues.value[idx] = res.data
    setIssueEntity(res.data)
    ElMessage.success('状态已更新')
    return res.data as Issue
  }

  async function deleteIssue(id: string) {
    await api.deleteIssue(id)
    issues.value = issues.value.filter(i => i.id !== id)
    total.value--
    removeIssueEntity(id)
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

  return {
    issues,
    issueById,
    issueRequestById,
    total,
    loading,
    getIssueById,
    getIssueRequestState,
    fetchIssues,
    fetchIssue,
    createIssue,
    updateIssue,
    updateStatus,
    deleteIssue,
    reorder,
    setAttentionLevel,
  }
})
