import { service } from '/@/cool'
import type { LegacyResponse } from '/$/phoenix-open-issue/api/request'
import type { DictItem } from '/$/phoenix-open-issue/core'
import {
  HOST_DICT_KEY_BY_ISSUE_GROUP,
  toIssueDictItems,
  type HostDictItem,
  type IssueDictGroup,
} from '/$/phoenix-open-issue/adapters/host-dict'

async function loadIssueDict(): Promise<DictItem[]> {
  const data = await service.dict.info.data({
    types: Object.values(HOST_DICT_KEY_BY_ISSUE_GROUP),
  }) as Record<string, HostDictItem[]>
  return toIssueDictItems(data)
}

export async function getAllDict(): Promise<LegacyResponse<DictItem[]>> {
  return { data: await loadIssueDict() }
}

export async function getDictByGroup(
  groupName: IssueDictGroup,
): Promise<LegacyResponse<DictItem[]>> {
  return {
    data: (await loadIssueDict()).filter(item => item.groupName === groupName),
  }
}
