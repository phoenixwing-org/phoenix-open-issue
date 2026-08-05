import { service } from '/@/cool'

export const OPEN_ISSUE_MODULE_ID = 'phoenix-open-issue'
export const OPEN_ISSUE_DICTIONARY_PRESET = 'automotive'
export const OPEN_ISSUE_DICTIONARY_TYPE_COUNT = 7

export interface IssueDictionaryItemPlan {
  value: string
  name: string
  orderNum: number
  itemClass: 'core' | 'default' | 'transitional'
  action: 'create' | 'preserve'
  existingId?: number
}

export interface IssueDictionaryTypePlan {
  contributionId: string
  typeKey: string
  typeName: string
  policyVersion: number
  action: 'create' | 'preserve'
  existingTypeId?: number
  items: IssueDictionaryItemPlan[]
  preservedCustomItems: number
}

export interface IssueDictionaryPlan {
  dryRun: true
  moduleId: string
  pluginVersion: string
  catalogHash: string
  fingerprint: string
  types: IssueDictionaryTypePlan[]
  conflicts: string[]
  totals: {
    createTypes: number
    createItems: number
    preserveItems: number
    preserveCustomItems: number
  }
}

export async function getIssueDictionaryPlan(): Promise<IssueDictionaryPlan> {
  return service.request({
    url: '/admin/pah/plugin/dictionary-plan',
    method: 'GET',
    params: { moduleId: OPEN_ISSUE_MODULE_ID },
  }) as Promise<IssueDictionaryPlan>
}

export async function reconcileIssueDictionary(
  fingerprint: string,
): Promise<IssueDictionaryPlan> {
  return service.request({
    url: '/admin/pah/plugin/dictionary-reconcile',
    method: 'POST',
    data: {
      moduleId: OPEN_ISSUE_MODULE_ID,
      dictionaryFingerprint: fingerprint,
      dictionaryConfirmed: true,
    },
  }) as Promise<IssueDictionaryPlan>
}
