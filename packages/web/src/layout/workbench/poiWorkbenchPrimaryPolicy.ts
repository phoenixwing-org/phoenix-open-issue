export const POI_WORKBENCH_PRIMARY_POLICIES = {
  welcome: 'required',
  dashboard: 'none',
  lists: 'required',
  listDetail: 'required',
  issueDetail: 'required',
  org: 'required',
  pushHistory: 'required',
  settings: 'required',
  functions: 'required',
  testRunner: 'required',
} as const

export type PoiWorkbenchRouteName = keyof typeof POI_WORKBENCH_PRIMARY_POLICIES
export type PoiWorkbenchPrimaryPolicy = 'required' | 'none'

export function poiWorkbenchPrimaryPolicy(
  routeName: string | symbol | null | undefined,
): PoiWorkbenchPrimaryPolicy {
  if (typeof routeName !== 'string') return 'required'
  return POI_WORKBENCH_PRIMARY_POLICIES[routeName as PoiWorkbenchRouteName] ?? 'required'
}

export function resolvePoiPrimaryContribution<
  TContribution extends object,
  TPrimary,
>(
  routeName: string | symbol | null | undefined,
  registered: TContribution,
  fallbackPrimary: TPrimary,
): Omit<TContribution, 'primary'> & {
  primary?: (TContribution extends { primary?: infer TRegisteredPrimary }
    ? TRegisteredPrimary
    : never) | TPrimary
} {
  type ResolvedContribution = Omit<TContribution, 'primary'> & {
    primary?: (TContribution extends { primary?: infer TRegisteredPrimary }
      ? TRegisteredPrimary
      : never) | TPrimary
  }
  const registeredWithOptionalPrimary = registered as TContribution & { primary?: unknown }
  if (poiWorkbenchPrimaryPolicy(routeName) === 'none') {
    const { primary: _ignoredPrimary, ...remaining } = registeredWithOptionalPrimary
    return remaining as ResolvedContribution
  }
  if (registeredWithOptionalPrimary.primary) return registered as ResolvedContribution
  return {
    ...registered,
    primary: fallbackPrimary,
  } as ResolvedContribution
}
