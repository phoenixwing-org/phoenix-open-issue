import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  HOST_DICT_KEY_BY_ISSUE_GROUP,
  toIssueDictItems,
  type IssueDictGroup,
} from '../adapters/host-dict'

interface CatalogItem {
  value: string
  presets?: string[]
}

interface DictionaryContribution {
  typeKey: string
  installPresets?: string[]
  items: CatalogItem[]
}

const manifest = JSON.parse(
  readFileSync(new URL('../../../manifest.json', import.meta.url), 'utf8'),
) as { dictionaryContributions: DictionaryContribution[] }

function installedValues(contribution: DictionaryContribution) {
  const presets = new Set(contribution.installPresets ?? [])
  return contribution.items
    .filter(item => !item.presets?.length || item.presets.some(preset => presets.has(preset)))
    .map(item => item.value)
}

describe('Issue manifest 字典 catalog', () => {
  it('为每个前端消费 key 声明稳定且不重复的默认物化值', () => {
    const fallback = toIssueDictItems({})
    const catalogByKey = new Map(
      manifest.dictionaryContributions.map(item => [item.typeKey, item]),
    )

    for (const [group, typeKey] of Object.entries(HOST_DICT_KEY_BY_ISSUE_GROUP) as Array<
      [IssueDictGroup, string]
    >) {
      const contribution = catalogByKey.get(typeKey)
      expect(contribution, `${group} catalog`).toBeDefined()
      const values = installedValues(contribution!)
      expect(new Set(values).size).toBe(values.length)
      expect(values).toEqual(
        fallback.filter(item => item.groupName === group).map(item => item.value),
      )
    }
  })

  it('保留 software preset 但默认只物化 automotive 基线', () => {
    const category = manifest.dictionaryContributions.find(
      item => item.typeKey === HOST_DICT_KEY_BY_ISSUE_GROUP.issueCategory,
    )!
    expect(category.items.find(item => item.value === 'ui')?.presets).toContain('software')
    expect(installedValues(category)).not.toContain('ui')
    expect(installedValues(category)).toContain('appearance')
  })
})
