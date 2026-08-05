import { markRaw } from 'vue'
import {
  pnwNavigationFromRibbonTabs,
  type PnwNavigationNode,
} from 'phoenix-wing'
import { RIBBON_TABS, openIssueRibbonIconFor } from '../ribbon/ribbonConfig'

/**
 * Open Issue 只维护既有 Ribbon contribution；Wing 将它投影为 Ribbon/Tree 共用导航树。
 * Router、权限和点击动作继续由 Open Issue 持有。
 */
export function createOpenIssueNavigationNodes(): readonly PnwNavigationNode[] {
  const nodes = pnwNavigationFromRibbonTabs(RIBBON_TABS, {
    iconFor: openIssueRibbonIconFor,
  })
  return markRaw(nodes)
}
