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

/**
 * Open Issue 现有七个字典分组的内置中文显示名。
 *
 * 业务表始终保存稳定的 value；前端优先采用服务端/本地缓存中的可配置 label，
 * 只有缓存尚未取得或旧迁移把 value 原样写入 label 时才使用这些显示兜底。
 */
export const ISSUE_BUILTIN_DICTS = {
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
    { value: 'division', label: '部' },
  ],
  severity: ISSUE_IMPORTANCE_DICT,
  priority: ISSUE_URGENCY_DICT,
  closeReason: [
    { value: 'completed', label: '已完成' },
    { value: 'cancelled', label: '已取消' },
    { value: 'duplicate', label: '重复' },
    { value: 'transferred', label: '已转交' },
    { value: 'unreproducible', label: '不可复现' },
  ],
  listType: [
    { value: 'yearly', label: '年度' },
    { value: 'monthly', label: '月度' },
    { value: 'project', label: '项目' },
    { value: 'custom', label: '自定义' },
    { value: 'personal', label: '个人' },
    { value: 'group', label: '小组' },
    { value: 'department', label: '科室' },
    { value: 'division', label: '部门' },
    { value: 'company', label: '公司' },
  ],
} as const

/** 前端显示用内置字典标签；未知分组和值仍由调用方原样显示。 */
export function getIssueBuiltinDictLabel(groupName: string, value: string): string | undefined {
  const group = ISSUE_BUILTIN_DICTS[groupName as keyof typeof ISSUE_BUILTIN_DICTS]
  return group?.find(item => item.value === value)?.label
}

export const ISSUE_SYSTEM_DICT_GROUPS = ['severity', 'priority'] as const

/** severity / priority 是固定系统字段，字典只开放显示名。 */
export function isIssueSystemDictGroup(groupName: string): boolean {
  return (ISSUE_SYSTEM_DICT_GROUPS as readonly string[]).includes(groupName)
}
