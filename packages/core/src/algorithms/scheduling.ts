import type { CheckpointStatus } from '../types/index.js'

/**
 * 判断点检项是否逾期
 * @param deadline 可选截止日 'YYYY-MM-DD'（当天结束前均不算逾期）
 * @param status 点检状态
 * @param now 当前日期（默认为今天）
 * @returns 逾期信息
 */
export function isOverdue(
  deadline: string | null | undefined,
  status: CheckpointStatus,
  now: Date = new Date(),
): { overdue: boolean; daysOverdue: number } {
  if (status === 'done' || status === 'skipped' || status === 'voided') {
    return { overdue: false, daysOverdue: 0 }
  }
  if (!deadline) return { overdue: false, daysOverdue: 0 }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(deadline)
  const target = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 23, 59, 59, 999)
    : new Date(deadline)
  if (Number.isNaN(target.getTime())) return { overdue: false, daysOverdue: 0 }
  const diffMs = now.getTime() - target.getTime()
  const overdue = diffMs > 0
  const days = overdue ? Math.ceil(diffMs / (1000 * 60 * 60 * 24)) : 0

  return {
    overdue,
    daysOverdue: days,
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
