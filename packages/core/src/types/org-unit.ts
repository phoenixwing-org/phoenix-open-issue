/** 组织单元类型 */
export type OrgUnitType = 'group' | 'department' | 'division'

export interface OrgUnit {
  id: string
  name: string
  unit_type: OrgUnitType
  parent_id: string | null
  created_at: string
}

export interface OrgTreeNode extends OrgUnit {
  children: OrgTreeNode[]
}
