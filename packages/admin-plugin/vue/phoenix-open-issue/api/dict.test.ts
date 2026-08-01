import { describe, expect, it } from 'vitest'
import {
  HOST_DICT_KEY_BY_ISSUE_GROUP,
  toIssueDictItems,
} from '../adapters/host-dict'

describe('COOL 字典适配', () => {
  it('没有 Host 配置时保留 Issue 协议默认值', () => {
    const items = toIssueDictItems({})
    expect(items).toEqual(expect.arrayContaining([
      expect.objectContaining({ groupName: 'listType', value: 'custom', label: '自定义' }),
      expect.objectContaining({ groupName: 'severity', value: 'fatal', label: '关键' }),
    ]))
  })

  it('优先采用产品命名空间下的 Host 字典', () => {
    const items = toIssueDictItems({
      [HOST_DICT_KEY_BY_ISSUE_GROUP.listType]: [
        { id: 7, name: '客户专项', value: 'customer', orderNum: 2 },
      ],
    })
    expect(items.filter(item => item.groupName === 'listType')).toEqual([
      expect.objectContaining({ value: 'yearly', tags: 'core' }),
      expect.objectContaining({ value: 'monthly', tags: 'core' }),
      expect.objectContaining({ value: 'project', tags: 'core' }),
      expect.objectContaining({ value: 'custom', tags: 'core' }),
      expect.objectContaining({
        id: 'cool:7',
        value: 'customer',
        label: '客户专项',
        tags: 'host',
      }),
    ])
  })

  it('重要度和紧急度只接受固定协议值并允许覆盖显示名', () => {
    const items = toIssueDictItems({
      [HOST_DICT_KEY_BY_ISSUE_GROUP.severity]: [
        { id: 8, name: '最高影响', value: 'fatal', orderNum: 99 },
        { id: 9, name: '非法扩展', value: 'extreme', orderNum: 0 },
      ],
    }).filter(item => item.groupName === 'severity')

    expect(items.map(item => item.value)).toEqual([
      'trivial',
      'minor',
      'major',
      'fatal',
    ])
    expect(items.at(-1)).toEqual(expect.objectContaining({
      id: 'cool:8',
      label: '最高影响',
      sortOrder: 3,
      tags: 'core',
    }))
  })
})
