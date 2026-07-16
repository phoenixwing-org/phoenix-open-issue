import { describe, expect, it } from 'vitest'
import {
  filterListsByLifecycle,
  listArchiveConfirmation,
  listLifecycleStatus,
} from '../../packages/web/src/utils/listLifecycle'

describe('列表生命周期显示与筛选', () => {
  it('删除优先于归档，状态文案与列表管理一致', () => {
    expect(listLifecycleStatus({ archived: 0, isDeleted: 0 })).toEqual({
      key: 'active', label: '正常', type: 'success',
    })
    expect(listLifecycleStatus({ archived: 1, isDeleted: 0 })).toEqual({
      key: 'archived', label: '已归档', type: 'info',
    })
    expect(listLifecycleStatus({ archived: 1, isDeleted: 1 })).toEqual({
      key: 'deleted', label: '已删除', type: 'danger',
    })
  })

  it('仪表盘按列表真实状态筛选，不依赖当前按钮视图', () => {
    const lists = [
      { id: 'active', archived: 0, isDeleted: 0 },
      { id: 'archived', archived: 1, isDeleted: 0 },
      { id: 'deleted', archived: 0, isDeleted: 1 },
    ]

    expect(filterListsByLifecycle(lists, 'active').map(list => list.id)).toEqual(['active'])
    expect(filterListsByLifecycle(lists, 'archived').map(list => list.id)).toEqual(['archived'])
  })

  it('两页共用相同的归档与取消归档确认文案', () => {
    expect(listArchiveConfirmation('质量问题', true)).toMatchObject({
      title: '确认归档',
      options: { confirmButtonText: '归档', cancelButtonText: '返回', type: 'warning' },
    })
    expect(listArchiveConfirmation('质量问题', true).message).toContain('「已归档」视图')

    expect(listArchiveConfirmation('质量问题', false)).toMatchObject({
      title: '确认取消归档',
      options: { confirmButtonText: '取消归档', cancelButtonText: '返回', type: 'info' },
    })
    expect(listArchiveConfirmation('质量问题', false).message).toContain('回到正常视图')
  })
})
