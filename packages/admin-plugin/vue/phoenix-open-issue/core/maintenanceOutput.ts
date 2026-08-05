import type {
  RepairPlan,
  RepairTaskId,
  RepairTaskResult,
} from '/$/phoenix-open-issue/api/maintenance'
import type { TestRunResult } from '/$/phoenix-open-issue/api/test'

const OUTPUT_PREFIX = '[Open Issue 维护]'
const MAX_OUTPUT_TEXT_LENGTH = 240

function compactOutputText(value: unknown, fallback = '—') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback
  return text.length <= MAX_OUTPUT_TEXT_LENGTH
    ? text
    : `${text.slice(0, MAX_OUTPUT_TEXT_LENGTH - 1)}…`
}

function taskLabel(task: RepairTaskId) {
  if (task === 'checkpoints') return '点检数据修正'
  if (task === 'links') return 'Issue 链接修正'
  return '全部修正'
}

export function maintenanceOutputLine(message: string) {
  return `${OUTPUT_PREFIX} ${compactOutputText(message)}`
}

export function repairPlanOutputLines(plan: RepairPlan) {
  const lines = [
    maintenanceOutputLine(
      `dry-run ${plan.fingerprint.slice(0, 12)} · 有效期至 ${compactOutputText(plan.expiresAt)}`,
    ),
  ]

  for (const item of plan.plans) {
    lines.push(maintenanceOutputLine(
      `${taskLabel(item.task)}：${item.changeCount} 项 · ${item.destructive ? '含去重' : '幂等'}`,
    ))
    for (const detail of item.details) {
      lines.push(maintenanceOutputLine(`  ${compactOutputText(detail)}`))
    }
  }

  return lines
}

export function repairResultOutputLines(results: readonly RepairTaskResult[]) {
  if (!results.length) return [maintenanceOutputLine('执行完成，数据已是最新')]

  return results.flatMap((result) => [
    maintenanceOutputLine(
      `${taskLabel(result.task)}：${compactOutputText(result.message)} · 处理 ${result.fixed} 项`,
    ),
    ...result.details.map(detail => maintenanceOutputLine(`  ${compactOutputText(detail)}`)),
  ])
}

export function testResultOutputLines(result: TestRunResult) {
  const summary = result.summary
  return [
    maintenanceOutputLine(
      `受控测试完成：${summary.filesTotal} files / ${summary.total} tests · ${summary.passed} 通过 · ${summary.failed} 失败 · ${summary.durationMs} ms`,
    ),
  ]
}

export function maintenanceFailureOutputLine(action: string, error: unknown) {
  const response = (error as {
    message?: unknown
    response?: { status?: unknown; data?: unknown }
  } | null)?.response
  const data = response?.data
  const detail = typeof data === 'string'
    ? data
    : data && typeof data === 'object'
      ? (data as { message?: unknown; msg?: unknown }).message
        ?? (data as { message?: unknown; msg?: unknown }).msg
      : (error as { message?: unknown } | null)?.message
  const status = Number(response?.status)
  const suffix = detail
    ? compactOutputText(detail)
    : Number.isInteger(status) && status >= 400 && status <= 599
      ? `HTTP ${status}`
      : '未知错误'
  return maintenanceOutputLine(`${compactOutputText(action)}失败（${suffix}）`)
}
