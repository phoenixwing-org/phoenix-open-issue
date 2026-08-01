/** Issue 在某列表中的关注系数：0=不关注，1~5=关注递增 */
export type AttentionLevel = 0 | 1 | 2 | 3 | 4 | 5

export const ATTENTION_LEVELS = [0, 1, 2, 3, 4, 5] as const satisfies readonly AttentionLevel[]

/** 新建链接、从「作废」恢复时的默认关注级别 */
export const DEFAULT_ATTENTION_LEVEL: AttentionLevel = 3

export const ATTENTION_LEVEL_LABELS: Record<AttentionLevel, string> = {
  0: '不关注',
  1: '一星',
  2: '二星',
  3: '三星',
  4: '四星',
  5: '五星',
}

export function isLinkActive(level: number | null | undefined): boolean {
  return (level ?? DEFAULT_ATTENTION_LEVEL) > 0
}

export function normalizeAttentionLevel(value: unknown): AttentionLevel {
  const n = typeof value === 'number' ? value : parseInt(String(value), 10)
  if (n >= 0 && n <= 5) return n as AttentionLevel
  return DEFAULT_ATTENTION_LEVEL
}
