import { describe, expect, it } from 'vitest'
import type { VNode } from 'vue'

interface PoiLocalViewContributionRegistry<TContribution> {
  set(viewId: string, contribution: TContribution): void
  get(viewId?: string | null): TContribution | undefined
}

interface PoiLocalWingViewContributionApi {
  pnwCreateViewContributionRegistry<TContribution>(): PoiLocalViewContributionRegistry<TContribution>
  pnwCreateViewContributionRegistration<TContribution>(
    registry: PoiLocalViewContributionRegistry<TContribution>,
    viewId: () => string,
    contribution: TContribution,
  ): {
    activate(): void
    deactivate(): void
    sync(): void
    dispose(): void
  }
  pnwResolveWorkbenchResponsiveState(
    presentation: 'ribbon' | 'tree',
    tabBarPlacement: 'header' | 'after-navigation' | 'editor-bottom',
    containerWidth?: number,
  ): object
}

async function importPoiLocalWing(): Promise<PoiLocalWingViewContributionApi> {
  return await import('phoenix-wing') as unknown as PoiLocalWingViewContributionApi
}

function poiFindVNodes(node: unknown, type: string): VNode[] {
  if (Array.isArray(node)) return node.flatMap(child => poiFindVNodes(child, type))
  if (!node || typeof node !== 'object') return []
  const vnode = node as VNode
  return [
    ...(vnode.type === type ? [vnode] : []),
    ...poiFindVNodes(vnode.children, type),
  ]
}

const localDescribe = import.meta.env.VITE_PHOENIX_WING_SOURCE === 'LOCAL'
  ? describe
  : describe.skip

localDescribe('Wing LOCAL View contribution 契约', () => {
  it('路由切换、KeepAlive 停用/恢复与卸载都维护正确注册', async () => {
    const {
      pnwCreateViewContributionRegistry,
      pnwCreateViewContributionRegistration,
    } = await importPoiLocalWing()
    let viewId = '/dashboard'
    const contribution = { primary: { component: 'dashboard-filter' } }
    const registry = pnwCreateViewContributionRegistry<typeof contribution>()
    const registration = pnwCreateViewContributionRegistration(
      registry,
      () => viewId,
      contribution,
    )

    registration.activate()
    expect(registry.get('/dashboard')).toBe(contribution)

    viewId = '/settings'
    registration.sync()
    expect(registry.get('/dashboard')).toBeUndefined()
    expect(registry.get('/settings')).toBe(contribution)

    registration.deactivate()
    expect(registry.get('/settings')).toBeUndefined()

    registration.activate()
    expect(registry.get('/settings')).toBe(contribution)

    registration.dispose()
    expect(registry.get('/settings')).toBeUndefined()
  })

  it('空标签不解析残留贡献，窄屏仅采用 Shell 的有效布局', async () => {
    const {
      pnwCreateViewContributionRegistry,
      pnwResolveWorkbenchResponsiveState,
    } = await importPoiLocalWing()
    const registry = pnwCreateViewContributionRegistry<object>()
    registry.set('/settings', { bottom: true })

    expect(registry.get(null)).toBeUndefined()
    expect(pnwResolveWorkbenchResponsiveState('tree', 'header', 700)).toEqual({
      narrow: true,
      preferredPresentation: 'tree',
      effectivePresentation: 'ribbon',
      preferredTabBarPlacement: 'header',
      effectiveTabBarPlacement: 'after-navigation',
    })
  })

  it('Footer 固定渲染三区入口，并按当前 View contribution 原生禁用', async () => {
    const { default: footerComponent } = await import(
      'phoenix-wing/layout/PnwWorkbenchFooter.vue'
    )
    const setup = (footerComponent as unknown as {
      setup: (
        props: Record<string, unknown>,
        context: { emit: () => void },
      ) => (context: { $slots: Record<string, unknown> }, cache: unknown[]) => VNode
    }).setup
    const render = setup(
      {
        contributions: { primary: true },
        visibility: { primary: false, bottom: false, secondary: false },
        ariaLabel: '测试工作台布局开关',
      },
      { emit: () => undefined },
    )
    const buttons = poiFindVNodes(render({ $slots: {} }, []), 'button')

    expect(buttons).toHaveLength(3)
    expect(buttons.map(button => button.props?.['aria-label'])).toEqual([
      '显示/隐藏 Primary Block',
      '显示/隐藏 Bottom Panel',
      '显示/隐藏 Secondary Block',
    ])
    expect(buttons.map(button => button.props?.disabled)).toEqual([false, true, true])
  })
})
