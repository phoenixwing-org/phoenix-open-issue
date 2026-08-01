import { computed } from 'vue'
import { useDictStore, type DictGroupName } from '/$/phoenix-open-issue/stores/dict'

/**
 * 便捷访问单个字典分组（基于 Pinia 全局缓存）
 *
 * @example
 * const listType = useDictGroup('listType')
 * listType.options.value        // 下拉选项
 * listType.label('monthly')     // 显示名
 * listType.color('monthly')     // 标签颜色
 * listType.defaultOf('custom')  // 默认值
 */
export function useDictGroup(groupName: DictGroupName) {
  const dict = useDictStore()

  const options = computed(() => dict.options[groupName])
  const taggedOptions = computed(() => dict.taggedOptions[groupName])

  const label = (value: string | null | undefined) => dict.getLabel(groupName, value)
  const color = (value: string) => dict.getGroupColor(groupName, value)
  const defaultOf = (prefer?: string) => dict.getDefaultValue(groupName, prefer)

  return {
    options,
    taggedOptions,
    label,
    color,
    defaultOf,
    ensureLoaded: dict.ensureLoaded,
  }
}

/** 访问全部字典分组 */
export function useDict() {
  const dict = useDictStore()
  return {
    ...dict,
    group: useDictGroup,
  }
}
