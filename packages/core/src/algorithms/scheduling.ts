import type { CheckpointStatus } from '../types/index.js'

/**
 * 判断点检项是否逾期
 * @param checkpointDate 点检日期 'YYYY-MM-DD'
 * @param status 点检状态
 * @param now 当前日期（默认为今天）
 * @returns 逾期信息
 */
export function isOverdue(
  checkpointDate: string,
  status: CheckpointStatus,
  now: Date = new Date(),
): { overdue: boolean; daysOverdue: number } {
  if (status === 'done' || status === 'skipped' || status === 'voided') {
    return { overdue: false, daysOverdue: 0 }
  }

  const target = new Date(checkpointDate)
  const diffMs = now.getTime() - target.getTime()
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  return {
    overdue: days > 0,
    daysOverdue: Math.max(0, days),
  }
}

/**
 * 计算下一个点检日期
 */
export function calculateNextCheckpoint(
  currentDate: Date,
  rule: {
    frequency: 'daily' | 'weekly' | 'monthly'
    interval: number
  },
): Date {
  const next = new Date(currentDate)
  switch (rule.frequency) {
    case 'daily':
      next.setDate(next.getDate() + rule.interval)
      break
    case 'weekly':
      next.setDate(next.getDate() + rule.interval * 7)
      break
    case 'monthly':
      next.setMonth(next.getMonth() + rule.interval)
      break
  }
  return next
}
