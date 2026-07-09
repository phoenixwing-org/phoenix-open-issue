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
