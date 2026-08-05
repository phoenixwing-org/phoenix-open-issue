import { effectScope, nextTick, ref } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePoiColorScheme } from './usePoiColorScheme'

function createPoiThemeEnvironment(initiallyDark = false) {
  const classes = new Set<string>()
  const root = {
    dataset: {} as Record<string, string>,
    classList: {
      toggle(name: string, force?: boolean) {
        if (force === true) classes.add(name)
        else if (force === false) classes.delete(name)
        else if (classes.has(name)) classes.delete(name)
        else classes.add(name)
        return classes.has(name)
      },
      contains(name: string) {
        return classes.has(name)
      },
    },
  }
  let listener: (() => void) | undefined
  let dark = initiallyDark
  const mediaQuery = {
    get matches() {
      return dark
    },
    addEventListener(_type: string, next: () => void) {
      listener = next
    },
    removeEventListener(_type: string, next: () => void) {
      if (listener === next) listener = undefined
    },
  }

  vi.stubGlobal('document', { documentElement: root })
  vi.stubGlobal('window', { matchMedia: () => mediaQuery })

  return {
    root,
    setSystemDark(value: boolean) {
      dark = value
      listener?.()
    },
    hasSystemListener() {
      return Boolean(listener)
    },
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Open Issue 根主题接线', () => {
  it('同步 Wing 受控值到 data-theme 与 Element Plus dark class', async () => {
    const environment = createPoiThemeEnvironment()
    const colorScheme = ref<'light' | 'dark' | 'system'>('light')
    const scope = effectScope()
    scope.run(() => usePoiColorScheme(colorScheme))

    expect(environment.root.dataset.theme).toBe('light')
    expect(environment.root.classList.contains('dark')).toBe(false)

    colorScheme.value = 'dark'
    await nextTick()
    expect(environment.root.dataset.theme).toBe('dark')
    expect(environment.root.classList.contains('dark')).toBe(true)

    scope.stop()
    expect(environment.hasSystemListener()).toBe(false)
  })

  it('system 模式跟随系统配色变化，显式偏好不受系统事件覆盖', async () => {
    const environment = createPoiThemeEnvironment()
    const colorScheme = ref<'light' | 'dark' | 'system'>('system')
    const scope = effectScope()
    scope.run(() => usePoiColorScheme(colorScheme))

    environment.setSystemDark(true)
    expect(environment.root.dataset.theme).toBe('dark')
    expect(environment.root.classList.contains('dark')).toBe(true)

    colorScheme.value = 'light'
    await nextTick()
    environment.setSystemDark(true)
    expect(environment.root.dataset.theme).toBe('light')
    expect(environment.root.classList.contains('dark')).toBe(false)

    scope.stop()
  })
})
