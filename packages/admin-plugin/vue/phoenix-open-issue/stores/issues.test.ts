import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Issue } from '../core'
import {
  issueFormDialogInitial,
  issueFormDialogUsers,
} from '../components/issueFormDialog'

const mocks = vi.hoisted(() => ({
  getIssue: vi.fn(),
}))

vi.mock('/$/phoenix-open-issue/api/issues', () => ({
  getIssue: mocks.getIssue,
}))

import { useIssueStore } from './issues'

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

function issue(id: string, title: string): Issue {
  return { id, title } as Issue
}

describe('Issue 详情实体与请求隔离', () => {
  beforeEach(() => {
    mocks.getIssue.mockReset()
    setActivePinia(createPinia())
  })

  it('让两个 Issue 详情实例按 issueId 保留各自实体和加载状态', async () => {
    const first = deferred<{ data: Issue }>()
    const second = deferred<{ data: Issue }>()
    mocks.getIssue.mockImplementation((id: string) => (
      id === 'issue-a' ? first.promise : second.promise
    ))
    const store = useIssueStore()

    const firstRun = store.fetchIssue('issue-a')
    const secondRun = store.fetchIssue('issue-b')
    expect(store.getIssueRequestState('issue-a')).toMatchObject({ requestId: 1, loading: true })
    expect(store.getIssueRequestState('issue-b')).toMatchObject({ requestId: 1, loading: true })

    second.resolve({ data: issue('issue-b', '第二个 Issue') })
    await secondRun
    expect(store.getIssueById('issue-b')?.title).toBe('第二个 Issue')
    expect(store.getIssueRequestState('issue-b').loading).toBe(false)
    expect(store.getIssueRequestState('issue-a').loading).toBe(true)

    first.resolve({ data: issue('issue-a', '第一个 Issue') })
    await firstRun
    expect(store.getIssueById('issue-a')?.title).toBe('第一个 Issue')
    expect(store.getIssueById('issue-b')?.title).toBe('第二个 Issue')
    expect(store.getIssueRequestState('issue-a').loading).toBe(false)
  })

  it('同一 Issue 请求乱序返回时只接受最新 generation', async () => {
    const stale = deferred<{ data: Issue }>()
    const latest = deferred<{ data: Issue }>()
    mocks.getIssue
      .mockReturnValueOnce(stale.promise)
      .mockReturnValueOnce(latest.promise)
    const store = useIssueStore()

    const staleRun = store.fetchIssue('issue-a')
    const latestRun = store.fetchIssue('issue-a')
    expect(store.getIssueRequestState('issue-a')).toMatchObject({ requestId: 2, loading: true })

    latest.resolve({ data: issue('issue-a', '最新响应') })
    await latestRun
    stale.resolve({ data: issue('issue-a', '陈旧响应') })
    expect((await staleRun)?.title).toBe('最新响应')

    expect(store.getIssueById('issue-a')?.title).toBe('最新响应')
    expect(store.getIssueRequestState('issue-a')).toEqual({
      requestId: 2,
      loading: false,
      error: null,
    })
  })
})

describe('Issue 表单 Host props', () => {
  it('只保留可序列化的用户与 Issue 字段', () => {
    expect(issueFormDialogUsers([{
      id: 7,
      username: 'operator',
      displayName: undefined,
      callback: () => undefined,
    }])).toEqual([{
      id: '7',
      username: 'operator',
      displayName: null,
    }])

    expect(issueFormDialogInitial({
      id: 'issue-a',
      title: '可序列化 Issue',
      priority: 'high',
      _attentionLevel: 4,
      callback: () => undefined,
    })).toEqual({
      title: '可序列化 Issue',
      issueNo: '',
      description: '',
      priority: 'high',
      severity: '',
      category: '',
      detectionPhase: '',
      reporterId: '',
      assigneeId: '',
      dueDate: '',
      functionId: '',
      _attentionLevel: 4,
    })
  })

  it('非法关注度回落到产品默认值', () => {
    expect(issueFormDialogInitial({ title: 'Issue', _attentionLevel: 'not-a-number' }))
      .toMatchObject({ title: 'Issue', _attentionLevel: 3 })
  })
})
