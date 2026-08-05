import {
  ISSUE_IMPORTANCE_DICT,
  ISSUE_URGENCY_DICT,
  type DictItem,
} from '../core'

export type IssueDictGroup =
  | 'issueCategory'
  | 'detectionPhase'
  | 'orgUnitType'
  | 'severity'
  | 'priority'
  | 'closeReason'
  | 'listType'

export interface HostDictItem {
  id: number | string
  name: string
  value?: string | number | null
  orderNum?: number | null
}

/**
 * COOL 字典是共享 Host 资源，插件使用产品命名空间，避免和其他业务插件重名。
 * 尚未配置 Host 字典时使用插件内置协议值，页面无需依赖第二套字典数据库。
 */
export const HOST_DICT_KEY_BY_ISSUE_GROUP: Record<IssueDictGroup, string> = {
  issueCategory: 'phoenix-open-issue.issueCategory',
  detectionPhase: 'phoenix-open-issue.detectionPhase',
  orgUnitType: 'phoenix-open-issue.orgUnitType',
  severity: 'phoenix-open-issue.severity',
  priority: 'phoenix-open-issue.priority',
  closeReason: 'phoenix-open-issue.closeReason',
  listType: 'phoenix-open-issue.listType',
}

const FALLBACK_ITEMS: Record<
  IssueDictGroup,
  ReadonlyArray<{ value: string; label: string; tags?: string }>
> = {
  issueCategory: [
    { value: 'appearance', label: '外观' },
    { value: 'dimension', label: '尺寸' },
    { value: 'function', label: '功能' },
    { value: 'process', label: '过程' },
    { value: 'safety', label: '安全' },
    { value: 'other', label: '其他' },
  ],
  detectionPhase: [
    { value: 'incoming', label: '来料检验' },
    { value: 'in_process', label: '过程检验' },
    { value: 'final', label: '终检' },
    { value: 'customer', label: '客户反馈' },
    { value: 'audit', label: '审核发现' },
    { value: 'supplier', label: '供应商端' },
  ],
  orgUnitType: [
    { value: 'group', label: '小组' },
    { value: 'department', label: '科室' },
    { value: 'division', label: '部门' },
  ],
  severity: ISSUE_IMPORTANCE_DICT.map(item => ({ ...item, tags: 'core' })),
  priority: ISSUE_URGENCY_DICT.map(item => ({ ...item, tags: 'core' })),
  closeReason: [
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
    { value: 'duplicate', label: '重复' },
    { value: 'transferred', label: '已转交' },
    { value: 'unreproducible', label: '不可复现' },
  ],
  listType: [
    { value: 'yearly', label: '年度', tags: 'core' },
    { value: 'monthly', label: '月度', tags: 'core' },
    { value: 'project', label: '项目', tags: 'core' },
    { value: 'custom', label: '自定义', tags: 'core' },
    { value: 'personal', label: '个人' },
    { value: 'group', label: '小组' },
    { value: 'department', label: '科室' },
    { value: 'division', label: '部门' },
    { value: 'company', label: '公司' },
  ],
}

function fallbackGroup(groupName: IssueDictGroup): DictItem[] {
  return FALLBACK_ITEMS[groupName].map((item, sortOrder) => ({
    id: `builtin:${groupName}:${item.value}`,
    groupName,
    value: item.value,
    label: item.label,
    sortOrder,
    enabled: 1,
    tags: item.tags ?? 'general',
    createdAt: '',
  }))
}

function hostValue(item: HostDictItem): string {
  return String(item.value ?? item.id)
}

/**
 * COOL 在未配置显示名时可能把稳定协议 value 原样放进 name。
 * 这不是自定义显示名：已知协议值继续使用插件内置中文；只有非空且不等于
 * value 的 Host name 才覆盖 fallback。Host 扩展值没有内置中文时退回 value。
 */
function resolveHostLabel(item: HostDictItem, fallbackLabel?: string): string {
  const value = hostValue(item)
  const name = String(item.name ?? '').trim()
  if (name && name !== value) return name
  return fallbackLabel ?? value
}

function toHostItem(
  groupName: IssueDictGroup,
  item: HostDictItem,
  sortOrder: number,
  tags = 'host',
  fallbackLabel?: string,
): DictItem {
  return {
    id: `cool:${item.id}`,
    groupName,
    value: hostValue(item),
    label: resolveHostLabel(item, fallbackLabel),
    sortOrder,
    enabled: 1,
    tags,
    createdAt: '',
  }
}

function protocolGroup(
  groupName: 'severity' | 'priority',
  items: HostDictItem[],
): DictItem[] {
  const byValue = new Map(items.map(item => [hostValue(item), item]))
  return fallbackGroup(groupName).map((fallback, sortOrder) => {
    const host = byValue.get(fallback.value)
    return {
      ...fallback,
      id: host ? `cool:${host.id}` : fallback.id,
      label: host ? resolveHostLabel(host, fallback.label) : fallback.label,
      sortOrder,
      tags: 'core',
    }
  })
}

function listTypeGroup(items: HostDictItem[]): DictItem[] {
  if (items.length === 0) return fallbackGroup('listType')
  const core = fallbackGroup('listType').filter(item => item.tags === 'core')
  const hostByValue = new Map(items.map(item => [hostValue(item), item]))
  const protectedItems = core.map((fallback, sortOrder) => {
    const host = hostByValue.get(fallback.value)
    hostByValue.delete(fallback.value)
    return {
      ...fallback,
      id: host ? `cool:${host.id}` : fallback.id,
      label: host ? resolveHostLabel(host, fallback.label) : fallback.label,
      sortOrder,
    }
  })
  const extensions = [...hostByValue.values()].map((item, index) =>
    toHostItem('listType', item, core.length + (item.orderNum ?? index)),
  )
  return [...protectedItems, ...extensions]
}

export function toIssueDictItems(
  response: Record<string, HostDictItem[]>,
): DictItem[] {
  return (Object.keys(HOST_DICT_KEY_BY_ISSUE_GROUP) as IssueDictGroup[]).flatMap(groupName => {
    const hostKey = HOST_DICT_KEY_BY_ISSUE_GROUP[groupName]
    const items = response[hostKey] ?? []
    if (groupName === 'severity' || groupName === 'priority') {
      return protocolGroup(groupName, items)
    }
    if (groupName === 'listType') return listTypeGroup(items)
    if (items.length === 0) return fallbackGroup(groupName)
    const fallbackByValue = new Map(
      fallbackGroup(groupName).map(item => [item.value, item.label]),
    )
    return items.map((item, index) => {
      const value = hostValue(item)
      return toHostItem(
        groupName,
        item,
        item.orderNum ?? index,
        'host',
        fallbackByValue.get(value),
      )
    })
  })
}
