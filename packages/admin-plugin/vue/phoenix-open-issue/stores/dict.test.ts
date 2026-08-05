import { createPinia, setActivePinia } from 'pinia'
import { nextTick, reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DictItem } from '../core'

const mocks = vi.hoisted(() => ({
  getAllDict: vi.fn(),
  hostUser: null as { token: string; info: null } | null,
}))

vi.mock('/$/base', () => ({
  useBase: () => ({ user: mocks.hostUser }),
}))

vi.mock('/$/phoenix-open-issue/api/dict', () => ({
  getAllDict: mocks.getAllDict,
}))

import {
  DICT_CACHE_STORAGE_KEY,
  encodeDictCache,
  useDictStore,
} from './dict'

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

function dictItem(label: string): DictItem {
  return {
    id: 'cool:1',
    groupName: 'severity',
    value: 'minor',
    label,
    sortOrder: 1,
    enabled: 1,
    tags: 'core',
    createdAt: '',
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return { promise, resolve }
}

describe('插件字典缓存生命周期', () => {
  let storage: MemoryStorage

  beforeEach(() => {
    storage = new MemoryStorage()
    vi.stubGlobal('localStorage', storage)
    mocks.hostUser = reactive({ token: '', info: null })
    mocks.getAllDict.mockReset()
    setActivePinia(createPinia())
  })

  it('同步恢复非敏感缓存，并在已登录插件中刷新 Host 字典', async () => {
    storage.setItem(DICT_CACHE_STORAGE_KEY, encodeDictCache([dictItem('缓存显示名')]))
    mocks.hostUser!.token = 'host-token'
    const hostResponse = deferred<{ data: DictItem[] }>()
    mocks.getAllDict.mockReturnValue(hostResponse.promise)

    const store = useDictStore()

    expect(store.getLabel('severity', 'minor')).toBe('缓存显示名')
    expect(store.loaded).toBe(true)
    expect(mocks.getAllDict).toHaveBeenCalledTimes(1)

    hostResponse.resolve({ data: [dictItem('Host 最新显示名')] })
    await store.refresh()

    expect(store.getLabel('severity', 'minor')).toBe('Host 最新显示名')
    const persisted = JSON.parse(storage.getItem(DICT_CACHE_STORAGE_KEY)!)
    expect(persisted.items).toEqual([{
      groupName: 'severity',
      value: 'minor',
      label: 'Host 最新显示名',
      sortOrder: 1,
      enabled: 1,
      tags: 'core',
    }])
    expect(storage.getItem(DICT_CACHE_STORAGE_KEY)).not.toContain('host-token')
    expect(storage.getItem(DICT_CACHE_STORAGE_KEY)).not.toContain('createdAt')
  })

  it('从未登录切换为已登录时刷新 Host 字典', async () => {
    storage.setItem(DICT_CACHE_STORAGE_KEY, encodeDictCache([dictItem('启动缓存显示名')]))
    const hostResponse = deferred<{ data: DictItem[] }>()
    mocks.getAllDict.mockReturnValue(hostResponse.promise)
    const store = useDictStore()

    expect(store.getLabel('severity', 'minor')).toBe('启动缓存显示名')
    expect(mocks.getAllDict).not.toHaveBeenCalled()
    mocks.hostUser!.token = 'host-token'
    await nextTick()
    expect(mocks.getAllDict).toHaveBeenCalledTimes(1)

    hostResponse.resolve({ data: [dictItem('Host 显示名')] })
    await store.refresh()

    expect(mocks.getAllDict).toHaveBeenCalledTimes(1)
    expect(store.getLabel('severity', 'minor')).toBe('Host 显示名')
  })

  it('登出清除缓存，并丢弃登出前仍在途的 Host 响应', async () => {
    storage.setItem(DICT_CACHE_STORAGE_KEY, encodeDictCache([dictItem('缓存显示名')]))
    mocks.hostUser!.token = 'host-token'
    const hostResponse = deferred<{ data: DictItem[] }>()
    mocks.getAllDict.mockReturnValue(hostResponse.promise)
    const store = useDictStore()
    const pendingRefresh = store.refresh()

    mocks.hostUser!.token = ''
    await nextTick()

    expect(store.items).toEqual([])
    expect(storage.getItem(DICT_CACHE_STORAGE_KEY)).toBeNull()

    hostResponse.resolve({ data: [dictItem('不应回填')] })
    await pendingRefresh

    expect(store.items).toEqual([])
    expect(store.loaded).toBe(false)
    expect(storage.getItem(DICT_CACHE_STORAGE_KEY)).toBeNull()
  })
})
