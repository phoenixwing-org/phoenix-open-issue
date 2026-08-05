const TYPE_KEY_PATTERN = /^[a-z][a-z0-9-]*(\.[a-zA-Z][a-zA-Z0-9-]*)+$/
const ITEM_VALUE_PATTERN = /^[a-z][a-z0-9_]*$/
const PRESET_PATTERN = /^[a-z][a-z0-9-]*$/
const ITEM_CLASSES = new Set(['core', 'default', 'transitional'])
const CUSTOMIZABLE_FIELDS = new Set(['name', 'orderNum'])

function duplicates(values) {
  const seen = new Set()
  const repeated = new Set()
  for (const value of values) {
    if (seen.has(value)) repeated.add(value)
    seen.add(value)
  }
  return [...repeated]
}

export function validateAdminPluginDictionaryContract({
  moduleId,
  hostReuse = [],
  dictionaryContributions,
  consumedTypeKeys = [],
}) {
  const errors = []
  const contributions = Array.isArray(dictionaryContributions)
    ? dictionaryContributions
    : []
  if (dictionaryContributions !== undefined && !Array.isArray(dictionaryContributions)) {
    errors.push('dictionaryContributions 必须是数组')
  }
  if (hostReuse.includes('dictionary') && contributions.length === 0) {
    errors.push('声明复用 Host dictionary 时必须提供 dictionaryContributions catalog')
  }

  const typeKeys = new Set()
  const typeNames = new Set()
  for (const contribution of contributions) {
    if (!contribution?.id?.startsWith(`${moduleId}-`)) {
      errors.push(`字典贡献 ID 越界：${contribution?.id}`)
    }
    if (typeof contribution?.typeKey !== 'string' ||
        contribution.typeKey.length > 128 ||
        !contribution.typeKey.startsWith(`${moduleId}.`) ||
        !TYPE_KEY_PATTERN.test(contribution.typeKey)) {
      errors.push(`字典 typeKey 越界或不安全：${contribution?.typeKey}`)
    }
    if (typeKeys.has(contribution?.typeKey)) {
      errors.push(`重复字典 typeKey：${contribution?.typeKey}`)
    }
    typeKeys.add(contribution?.typeKey)
    if (!contribution?.typeName?.trim() || typeNames.has(contribution.typeName)) {
      errors.push(`字典 typeName 缺失或重复：${contribution?.typeName}`)
    }
    typeNames.add(contribution?.typeName)
    if (!Number.isInteger(contribution?.policyVersion) || contribution.policyVersion < 1) {
      errors.push(`字典策略版本无效：${contribution?.id}`)
    }
    if (contribution?.retainOnUninstall !== true) {
      errors.push(`字典贡献卸载时必须保留：${contribution?.id}`)
    }
    if (!Array.isArray(contribution?.items) || contribution.items.length === 0) {
      errors.push(`字典贡献缺少 items：${contribution?.id}`)
      continue
    }

    const installPresets = Array.isArray(contribution.installPresets)
      ? contribution.installPresets
      : []
    if (contribution.installPresets !== undefined && !Array.isArray(contribution.installPresets)) {
      errors.push(`字典安装 presets 必须是数组：${contribution.id}`)
    }
    for (const preset of installPresets) {
      if (typeof preset !== 'string' || !PRESET_PATTERN.test(preset)) {
        errors.push(`字典安装 preset 无效：${contribution.id}:${String(preset)}`)
      }
    }
    for (const preset of duplicates(installPresets)) {
      errors.push(`字典重复安装 preset：${contribution.id}:${preset}`)
    }

    const values = new Set()
    for (const item of contribution.items) {
      if (typeof item?.value !== 'string' ||
          item.value.length > 128 ||
          !ITEM_VALUE_PATTERN.test(item.value) ||
          values.has(item.value)) {
        errors.push(`字典 item value 缺失、重复或不安全：${contribution.id}:${item?.value}`)
      }
      values.add(item?.value)
      if (!item?.name?.trim()) errors.push(`字典 item name 缺失：${contribution.id}:${item?.value}`)
      if (!Number.isInteger(item?.orderNum) || item.orderNum < 0) {
        errors.push(`字典 item orderNum 无效：${contribution.id}:${item?.value}`)
      }
      if (!ITEM_CLASSES.has(item?.itemClass)) {
        errors.push(`字典 itemClass 无效：${contribution.id}:${item?.value}:${item?.itemClass}`)
      }

      const presets = Array.isArray(item?.presets) ? item.presets : []
      if (item?.presets !== undefined && !Array.isArray(item.presets)) {
        errors.push(`字典 item presets 必须是数组：${contribution.id}:${item?.value}`)
      }
      for (const preset of presets) {
        if (typeof preset !== 'string' || !PRESET_PATTERN.test(preset)) {
          errors.push(`字典 item preset 无效：${contribution.id}:${item?.value}:${String(preset)}`)
        }
      }
      for (const preset of duplicates(presets)) {
        errors.push(`字典 item 重复 preset：${contribution.id}:${item?.value}:${preset}`)
      }
      if (item?.itemClass === 'core' && presets.length > 0) {
        errors.push(`core 字典协议项不能受 preset 过滤：${contribution.id}:${item.value}`)
      }

      const customizable = Array.isArray(item?.customizable) ? item.customizable : []
      if (!Array.isArray(item?.customizable) ||
          customizable.some(field => !CUSTOMIZABLE_FIELDS.has(field))) {
        errors.push(`字典 customizable 缺失或含非受控字段：${contribution.id}:${item?.value}`)
      }
      for (const field of duplicates(customizable)) {
        errors.push(`字典 customizable 重复：${contribution.id}:${item?.value}:${field}`)
      }
      if (item?.itemClass === 'core' && customizable.includes('orderNum')) {
        errors.push(`core 字典协议项不得定制顺序：${contribution.id}:${item.value}`)
      }
    }
  }

  const consumed = new Set(consumedTypeKeys)
  for (const typeKey of consumed) {
    if (!typeKeys.has(typeKey)) errors.push(`前端消费的字典 typeKey 未声明 catalog：${typeKey}`)
  }
  for (const typeKey of typeKeys) {
    if (!consumed.has(typeKey)) errors.push(`catalog 字典 typeKey 未被前端消费：${typeKey}`)
  }
  return errors
}
