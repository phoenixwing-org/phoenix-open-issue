import { afterEach, describe, expect, it } from 'vitest'
import ribbonFixture from 'phoenix-wing/fixtures/ribbon-contribution-v1.json'
import {
  PNW_VERSION,
  pnwCheckRibbonContributionCompatibility,
  pnwChoiceDialogOpen as rootDialogOpen,
  pnwChoiceDialogRequest as rootDialogRequest,
  pnwPromptChoice,
  pnwResolveChoice,
} from 'phoenix-wing'
import {
  pnwChoiceDialogOpen as subpathDialogOpen,
  pnwChoiceDialogRequest as subpathDialogRequest,
} from 'phoenix-wing/composables/pnwChoiceDialog'

afterEach(() => {
  if (rootDialogOpen.value) pnwResolveChoice(null)
})

describe('Wing 0.5.1 Registry 契约', () => {
  it('根入口与组件内部 composable 子路径共享同一 singleton', async () => {
    expect(PNW_VERSION).toBe('0.5.1')
    expect(rootDialogOpen).toBe(subpathDialogOpen)
    expect(rootDialogRequest).toBe(subpathDialogRequest)

    const pending = pnwPromptChoice({
      title: 'Registry singleton',
      message: 'Open Issue 与 Host 必须观察同一状态',
      choices: [{ id: 'ok', label: '确定' }],
    })

    expect(subpathDialogOpen.value).toBe(true)
    expect(subpathDialogRequest.value?.title).toBe('Registry singleton')
    pnwResolveChoice('ok')
    await expect(pending).resolves.toEqual({ choiceId: 'ok', checkedIds: [] })
    expect(rootDialogOpen.value).toBe(false)
  })

  it('使用随包发布的 Ribbon v1 fixture，并拒绝未知 schema', () => {
    const current = pnwCheckRibbonContributionCompatibility(ribbonFixture)
    expect(current.compatible).toBe(true)
    if (current.compatible) expect(current.document.tabs.length).toBeGreaterThan(0)

    expect(pnwCheckRibbonContributionCompatibility({
      ...ribbonFixture,
      schemaVersion: 2,
    })).toMatchObject({
      compatible: false,
      code: 'contribution.unsupported-schema-version',
      actualSchemaVersion: 2,
      supportedSchemaVersions: [1],
    })
  })
})
