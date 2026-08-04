import { describe, expect, it } from 'vitest'
import { validateAdminPluginDictionaryContract } from '../../../../scripts/lib/admin-plugin-dictionary-contract.mjs'

const baseContribution = {
  id: 'phoenix-open-issue-severity',
  typeKey: 'phoenix-open-issue.severity',
  typeName: 'Open Issue · 重要度',
  policyVersion: 1,
  retainOnUninstall: true,
  items: [{
    value: 'fatal',
    name: '关键',
    orderNum: 3,
    itemClass: 'core',
    customizable: ['name'],
  }],
}

describe('Admin plugin dictionary contract', () => {
  it('accepts a stable consumed namespace with uninstall retention', () => {
    expect(validateAdminPluginDictionaryContract({
      moduleId: 'phoenix-open-issue',
      hostReuse: ['dictionary'],
      dictionaryContributions: [baseContribution],
      consumedTypeKeys: ['phoenix-open-issue.severity'],
    })).toEqual([])
  })

  it('fails closed for unsafe presets and mutable core protocol order', () => {
    const errors = validateAdminPluginDictionaryContract({
      moduleId: 'phoenix-open-issue',
      hostReuse: ['dictionary'],
      dictionaryContributions: [{
        ...baseContribution,
        installPresets: ['general', 'general', 'bad preset'],
        items: [{
          ...baseContribution.items[0],
          presets: ['optional', 'optional'],
          customizable: ['name', 'name', 'orderNum'],
        }],
      }],
      consumedTypeKeys: ['phoenix-open-issue.severity'],
    })

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('安装 preset 无效'),
      expect.stringContaining('重复安装 preset'),
      expect.stringContaining('重复 preset'),
      expect.stringContaining('不能受 preset 过滤'),
      expect.stringContaining('customizable 重复'),
      expect.stringContaining('不得定制顺序'),
    ]))
  })

  it('requires declaration and consumption to stay in exact lockstep', () => {
    const errors = validateAdminPluginDictionaryContract({
      moduleId: 'phoenix-open-issue',
      hostReuse: ['dictionary'],
      dictionaryContributions: [baseContribution],
      consumedTypeKeys: ['phoenix-open-issue.priority'],
    })

    expect(errors).toEqual(expect.arrayContaining([
      '前端消费的字典 typeKey 未声明 catalog：phoenix-open-issue.priority',
      'catalog 字典 typeKey 未被前端消费：phoenix-open-issue.severity',
    ]))
  })
})
