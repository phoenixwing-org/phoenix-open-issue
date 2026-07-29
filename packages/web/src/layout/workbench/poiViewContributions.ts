import {
  inject,
  provide,
  type InjectionKey,
  type MaybeRefOrGetter,
} from 'vue'
import {
  pnwCreateViewContributionRegistry,
  usePnwRegisteredViewContribution,
  usePnwViewContribution,
  type PnwViewBlockComponentContributions,
  type PnwViewContributionRegistry,
} from 'phoenix-wing'

export type PoiViewContributions = PnwViewBlockComponentContributions
export type PoiViewContributionRegistry = PnwViewContributionRegistry<PoiViewContributions>

const POI_VIEW_CONTRIBUTION_REGISTRY: InjectionKey<PoiViewContributionRegistry> =
  Symbol('poi-view-contribution-registry')

export function createPoiViewContributionRegistry(): PoiViewContributionRegistry {
  return pnwCreateViewContributionRegistry<PoiViewContributions>()
}

export function providePoiViewContributionRegistry(registry: PoiViewContributionRegistry): void {
  provide(POI_VIEW_CONTRIBUTION_REGISTRY, registry)
}

export function usePoiViewContribution(
  viewId: MaybeRefOrGetter<string | null | undefined>,
  contribution: PoiViewContributions,
): void {
  const registry = inject(POI_VIEW_CONTRIBUTION_REGISTRY)
  if (!registry) throw new Error('Poi View contribution registry 尚未由工作台提供')
  usePnwViewContribution(registry, viewId, contribution)
}

export function usePoiRegisteredViewContribution(
  registry: PoiViewContributionRegistry,
  viewId: MaybeRefOrGetter<string | null | undefined>,
) {
  return usePnwRegisteredViewContribution(registry, viewId, {})
}
