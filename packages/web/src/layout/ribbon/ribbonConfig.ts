import type { PnwRibbonTabDef } from 'phoenix-wing'
import { pnwRegisterRibbonIcons } from 'phoenix-wing'
import { HomeFilled, Setting, List, Share, Odometer, TrendCharts, Collection } from '@element-plus/icons-vue'

export const RIBBON_TABS: PnwRibbonTabDef[] = [
  {
    id: 'issue',
    label: 'Issue',
    groups: [
      {
        id: 'issue-nav',
        label: '导航',
        items: [
          { pageId: 'dashboard', label: '仪表盘' },
          { pageId: 'lists', label: '列表管理' },
          { pageId: 'push-history', label: '推送历史' },
        ],
      },
    ],
  },
  {
    id: 'system',
    label: '系统',
    groups: [
      {
        id: 'system-nav',
        label: '管理',
        items: [
          { pageId: 'org', label: '组织架构' },
          { pageId: 'functions', label: '功能' },
          { pageId: 'settings', label: '设置' },
        ],
      },
    ],
  },
]

export function setupRibbonIcons() {
  pnwRegisterRibbonIcons({
    dashboard: Odometer,
    lists: List,
    'push-history': TrendCharts,
    org: Share,
    functions: Collection,
    settings: Setting,
    welcome: HomeFilled,
  })
}
