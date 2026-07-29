import {
  onScopeDispose,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue'
import {
  pnwApplyColorScheme,
  type PnwColorScheme,
} from 'phoenix-wing'

const POI_SYSTEM_COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

/**
 * Wing 保存用户偏好；Open Issue 负责把解析后的主题接到应用根节点和 Element Plus。
 */
export function usePoiColorScheme(
  colorScheme: MaybeRefOrGetter<PnwColorScheme>,
): void {
  const mediaQuery = window.matchMedia(POI_SYSTEM_COLOR_SCHEME_QUERY)

  const apply = (): void => {
    const resolved = pnwApplyColorScheme(toValue(colorScheme))
    document.documentElement.classList.toggle('dark', resolved === 'dark')
  }
  const stopWatching = watch(() => toValue(colorScheme), apply, {
    immediate: true,
  })
  const onSystemColorSchemeChange = (): void => {
    if (toValue(colorScheme) === 'system') apply()
  }

  mediaQuery.addEventListener('change', onSystemColorSchemeChange)
  onScopeDispose(() => {
    stopWatching()
    mediaQuery.removeEventListener('change', onSystemColorSchemeChange)
  })
}
