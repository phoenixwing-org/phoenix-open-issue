import type { MaybeRefOrGetter } from 'vue'
import {
  usePahViewContributions,
  type PahViewBlockComponentContributions,
} from '/@/phoenix/PahViewContributions'

/**
 * Legacy View 的窄兼容层。
 *
 * 页面继续调用原来的 usePoiViewContribution；插件只在此处把贡献登记到
 * Phoenix Admin Host 的 Pah registry，避免三个业务 View 分别感知宿主实现。
 */
export function usePoiViewContribution(
  viewId: MaybeRefOrGetter<string | null | undefined>,
  contribution: PahViewBlockComponentContributions,
): void {
  usePahViewContributions(viewId, contribution)
}
