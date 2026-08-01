export type OrgUnitType = 'group' | 'department' | 'division'

export interface OrgUnit {
  id: string
  name: string
  unitType: OrgUnitType
  parentId: string | null
  createdAt: string
}

export interface OrgTreeNode extends OrgUnit {
  children: OrgTreeNode[]
}
