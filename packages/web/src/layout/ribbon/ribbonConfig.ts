import type { PnwRibbonTabDef } from 'phoenix-wing'
import { pnwRegisterRibbonIcons } from 'phoenix-wing'
import {
  HomeFilled, Setting, List, Document, Files,
} from '@element-plus/icons-vue'

/** Open Issue 的 Ribbon 配置 */
export const RIBBON_TABS: PnwRibbonTabDef[] = [
  {
    id: 'system',
    label: '系统',
    groups: [
      {
        id: 'system-common',
        label: '常用',
        items: [
          { pageId: 'dashboard', label: '仪表盘' },
          { pageId: 'settings', label: '设置' },
        ],
      },
    ],
  },
  {
    id: 'issue',
    label: 'Issue',
    groups: [
      {
        id: 'issue-index',
        label: '索引',
        items: [
          { pageId: 'lists', label: '列表管理' },
          { pageId: 'org', label: '组织架构' },
        ],
      },
    ],
  },
]

/** 注册图标映射 */
export function setupRibbonIcons() {
  pnwRegisterRibbonIcons({
    dashboard: HomeFilled,
    settings: Setting,
    lists: List,
    listDetail: Document,
    issueDetail: Files,
    org: Files,
  })
}
