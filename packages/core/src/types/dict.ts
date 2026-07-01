export interface DictItem {
  id: string
  groupName: string
  value: string
  label: string
  sortOrder: number
  enabled: number
  tags: string      // 逗号分隔的标签，如 "automotive,software"，用于标记来源预设
  createdAt: string
}
