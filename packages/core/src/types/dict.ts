export interface DictItem {
  id: string
  groupName: string
  value: string
  label: string
  sortOrder: number
  enabled: number
  tags: string      // 多标签，存储格式 ,core,general,automotive, 便于 LIKE '%,automotive,%' 搜索
  createdAt: string
}

/**
 * Issue 二维决策模型的内置字典。
 *
 * 数据库字段继续使用历史名称 severity / priority，避免破坏 API、排序和旧数据；
 * 产品语义分别是“重要度 / 紧急度”。这些 value 是系统协议，只允许管理员改 label。
 */
export const ISSUE_IMPORTANCE_DICT = [
  { value: 'trivial', label: '较低' },
  { value: 'minor', label: '一般' },
  { value: 'major', label: '重要' },
  { value: 'fatal', label: '关键' },
] as const

export const ISSUE_URGENCY_DICT = [
  { value: 'low', label: '可延后' },
  { value: 'medium', label: '正常' },
  { value: 'high', label: '尽快' },
  { value: 'critical', label: '立即' },
] as const

export const ISSUE_SYSTEM_DICT_GROUPS = ['severity', 'priority'] as const

/** severity / priority 是固定系统字段，字典只开放显示名。 */
export function isIssueSystemDictGroup(groupName: string): boolean {
  return (ISSUE_SYSTEM_DICT_GROUPS as readonly string[]).includes(groupName)
}
