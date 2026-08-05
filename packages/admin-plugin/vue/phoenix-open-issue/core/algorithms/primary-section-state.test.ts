import { describe, expect, it } from 'vitest'
import {
  normalizePoiPrimarySectionExpansion,
  poiPrimarySectionKey,
  readPoiPrimarySectionExpanded,
  writePoiPrimarySectionExpanded,
} from './primary-section-state.js'

describe('Open Issue Primary Section 状态算法', () => {
  it('用 viewId 与 sectionId 隔离不同页面和区块', () => {
    expect(poiPrimarySectionKey('lists', 'filters')).toBe('lists:filters')
    expect(poiPrimarySectionKey('list-detail', 'filters')).toBe('list-detail:filters')
    expect(() => poiPrimarySectionKey('', 'filters')).toThrow('viewId')
  })

  it('缺省展开并保留显式 false', () => {
    expect(readPoiPrimarySectionExpanded({}, 'lists', 'filters')).toBe(true)
    expect(readPoiPrimarySectionExpanded(
      { 'lists:filters': false },
      'lists',
      'filters',
    )).toBe(false)
  })

  it('写入时不覆盖其他 View 的状态', () => {
    expect(writePoiPrimarySectionExpanded(
      { 'lists:filters': false },
      'issue-detail',
      'actions',
      true,
    )).toEqual({
      'lists:filters': false,
      'issue-detail:actions': true,
    })
  })

  it('读取旧设置时丢弃非 boolean 污染值', () => {
    expect(normalizePoiPrimarySectionExpansion({
      'lists:filters': false,
      'issue-detail:actions': 'false',
      '': true,
    })).toEqual({ 'lists:filters': false })
  })
})
