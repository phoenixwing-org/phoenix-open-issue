import { describe, expect, it } from 'vitest'
import { POI_AUTHENTICATED_WORKBENCH_ROUTES } from '@/router/workbenchRoutes'
import {
  POI_WORKBENCH_PRIMARY_POLICIES,
  poiWorkbenchPrimaryPolicy,
  resolvePoiPrimaryContribution,
} from './poiWorkbenchPrimaryPolicy'

const Primary = { component: 'test-primary' }
const Secondary = { component: 'test-secondary' }
const Bottom = { component: 'test-bottom' }
const DefaultPrimary = { component: 'default-primary' }

describe('Open Issue Workbench Primary 路由策略', () => {
  it('每个认证工作台子路由都有显式策略，且只有 Dashboard 禁用 Primary', () => {
    const routeNames = POI_AUTHENTICATED_WORKBENCH_ROUTES.map(route => String(route.name))

    expect(routeNames.sort()).toEqual(Object.keys(POI_WORKBENCH_PRIMARY_POLICIES).sort())
    for (const route of POI_AUTHENTICATED_WORKBENCH_ROUTES) {
      const routeName = String(route.name)
      expect(route.meta?.workbenchPrimary).toBe(POI_WORKBENCH_PRIMARY_POLICIES[routeName as keyof typeof POI_WORKBENCH_PRIMARY_POLICIES])
    }
    expect(poiWorkbenchPrimaryPolicy('dashboard')).toBe('none')
    for (const routeName of routeNames.filter(name => name !== 'dashboard')) {
      expect(poiWorkbenchPrimaryPolicy(routeName)).toBe('required')
    }
  })

  it('Dashboard 强制移除 Primary，但保留其他分区', () => {
    const registered = {
      primary: Primary,
      secondary: Secondary,
      bottom: Bottom,
    }
    const resolved = resolvePoiPrimaryContribution('dashboard', registered, DefaultPrimary)

    expect(resolved.primary).toBeUndefined()
    expect(resolved.secondary).toBe(registered.secondary)
    expect(resolved.bottom).toBe(registered.bottom)
  })

  it('已有页面专用 Primary 优先，不覆盖 Secondary 与 Bottom', () => {
    const registered = {
      primary: Primary,
      secondary: Secondary,
      bottom: Bottom,
    }
    const resolved = resolvePoiPrimaryContribution('settings', registered, DefaultPrimary)

    expect(resolved.primary).toBe(Primary)
    expect(resolved.secondary).toBe(Secondary)
    expect(resolved.bottom).toBe(Bottom)
  })

  it('缺少 Primary 时按分区补入有内容的默认导航，并保留 Issue Secondary', () => {
    const registered = {
      secondary: Secondary,
    }
    const resolved = resolvePoiPrimaryContribution('issueDetail', registered, DefaultPrimary)

    expect(resolved.primary).toBe(DefaultPrimary)
    expect(resolved.secondary).toBe(registered.secondary)
  })

  it('未来认证子路由即使漏写策略也不会静默缺少 Primary', () => {
    expect(poiWorkbenchPrimaryPolicy('futureView')).toBe('required')
    expect(resolvePoiPrimaryContribution('futureView', {}, DefaultPrimary).primary)
      .toBe(DefaultPrimary)
  })
})
