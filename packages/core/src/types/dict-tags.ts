/** 解析 tags 字符串为标签数组（兼容旧格式 core,general 与新格式 ,core,general,） */
export function parseDictTags(tags?: string | null): string[] {
  if (!tags) return []
  return tags.split(',').map(t => t.trim()).filter(Boolean)
}

/** 规范为 ,tag1,tag2, 格式；无标签时返回空字符串 */
export function formatDictTags(tags: string | string[] | null | undefined): string {
  const list = Array.isArray(tags) ? tags : parseDictTags(tags)
  const unique = [...new Set(list.map(t => t.trim()).filter(Boolean))]
  if (!unique.length) return ''
  return `,${unique.join(',')},`
}

export function normalizeDictTags(tags?: string | null): string {
  return formatDictTags(tags)
}

/** 是否包含某标签（按 ,tag, 精确匹配，便于 LIKE '%,automotive,%' 搜索） */
export function hasDictTag(tags: string | undefined | null, tag: string): boolean {
  const t = tag.trim()
  if (!t) return false
  const normalized = normalizeDictTags(tags)
  if (!normalized) return false
  return normalized.includes(`,${t},`)
}

/** SQL LIKE 模式：匹配含指定标签的行 */
export function dictTagLikePattern(tag: string): string {
  return `%,${tag.trim()},%`
}

export function mergeDictTags(existing: string | null | undefined, added: string | string[]): string {
  return formatDictTags([...parseDictTags(existing), ...parseDictTags(Array.isArray(added) ? added.join(',') : added)])
}
