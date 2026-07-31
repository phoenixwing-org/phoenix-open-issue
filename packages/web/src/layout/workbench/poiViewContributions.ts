import {
  computed,
  inject,
  provide,
  toValue,
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
import PoiDefaultPrimary from '../../components/workbench/PoiDefaultPrimary.vue'
import {
  resolvePoiPrimaryContribution,
} from './poiWorkbenchPrimaryPolicy'

export {
  POI_WORKBENCH_PRIMARY_POLICIES,
  poiWorkbenchPrimaryPolicy,
  type PoiWorkbenchPrimaryPolicy,
  type PoiWorkbenchRouteName,
} from './poiWorkbenchPrimaryPolicy'

export type PoiViewContributions = PnwViewBlockComponentContributions
export type PoiViewContributionRegistry = PnwViewContributionRegistry<PoiViewContributions>

const POI_VIEW_CONTRIBUTION_REGISTRY: InjectionKey<PoiViewContributionRegistry> =
  Symbol('poi-view-contribution-registry')

export interface PoiDefaultPrimaryProps {
  title: string
  routeName: string
  onNavigate: (path: string) => void
}

export function resolvePoiViewContributions(
  routeName: string | symbol | null | undefined,
  registered: PoiViewContributions,
  fallbackProps: PoiDefaultPrimaryProps,
): PoiViewContributions {
  return resolvePoiPrimaryContribution(
    routeName,
    registered,
    {
      component: PoiDefaultPrimary,
      props: fallbackProps,
    },
  ) as PoiViewContributions
}

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
  routeName: MaybeRefOrGetter<string | symbol | null | undefined>,
  fallbackProps: MaybeRefOrGetter<PoiDefaultPrimaryProps>,
) {
  const registered = usePnwRegisteredViewContribution(registry, viewId, {})
  return computed(() => resolvePoiViewContributions(
    toValue(routeName),
    registered.value,
    toValue(fallbackProps),
  ))
}
