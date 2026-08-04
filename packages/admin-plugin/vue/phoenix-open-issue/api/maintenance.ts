import request from './request'
import type {
  LegacyBusinessSubmission,
  LegacyBusinessTableName,
} from '/$/phoenix-open-issue/core'

export type RepairTaskId = 'checkpoints' | 'links' | 'list-org-references' | 'all'

export interface RepairTaskDefinition {
  id: Exclude<RepairTaskId, 'all'>
  title: string
  description: string
}

export interface RepairTaskResult {
  task: Exclude<RepairTaskId, 'all'>
  message: string
  details: string[]
  fixed: number
  ledgerId: string
}

export interface RepairPlanSummary {
  task: Exclude<RepairTaskId, 'all'>
  changeCount: number
  destructive: boolean
  details: string[]
}

export interface RepairPlan {
  task: RepairTaskId
  fingerprint: string
  generatedAt: string
  expiresAt: string
  plans: RepairPlanSummary[]
}

export type RepairLedgerStatus = 'running' | 'succeeded' | 'failed'

export interface RepairLedgerItem {
  id: string
  task: RepairTaskId
  planFingerprint: string
  actorId: string
  status: RepairLedgerStatus
  error: string | null
  startedAt: string
  finishedAt: string | null
}

export interface RepairLedgerPage {
  list: RepairLedgerItem[]
  page: number
  size: number
  total: number
}

export interface LegacyImportMappings {
  users: Record<string, string>
  orgUnits: Record<string, string>
}

export interface LegacyImportDryRunPlan {
  dryRun: true
  planId: string | null
  expiresAt: string | null
  executionAllowed: boolean
  sourceSha256: string | null
  businessSha256: string | null
  mappingSha256: string | null
  counts: Record<LegacyBusinessTableName, number>
  insertCounts: Record<LegacyBusinessTableName, number>
  totalRows: number
  userReferences: number
  orgUnitReferences: number
  idRemaps: Array<{
    table: LegacyBusinessTableName
    sourceId: string
    targetId: string
    reason: 'target-id-length'
  }>
  validationBlockers: string[]
  executionBlockers: string[]
  warnings: string[]
  targetConflicts: Array<{
    table: LegacyBusinessTableName
    key: 'id' | 'member' | 'issueNo' | 'link' | 'function'
    count: number
    sourceId?: string
    targetId?: string
    value?: string
  }>
  skippedExisting: Array<{
    table: LegacyBusinessTableName
    sourceId: string
    targetId: string
    reason: 'id' | 'member' | 'issueNo' | 'link' | 'function' | 'content-signature'
    value?: string
  }>
  targetSnapshotSha256: string | null
}

export interface LegacyImportExecutionResult {
  planId: string
  executedAt: string
  inserted: Record<LegacyBusinessTableName, number>
  totalInserted: number
  skippedExisting: LegacyImportDryRunPlan['skippedExisting']
  warnings: string[]
}

export function getRepairTasks() {
  return request.get<RepairTaskDefinition[]>('/maintenance/repair-tasks')
}

export function getRepairPlan(task: RepairTaskId) {
  return request.get<RepairPlan>('/maintenance/repair-plan', {
    params: { task },
  })
}

export function getRepairLedger(page = 1, size = 20) {
  return request.get<RepairLedgerPage>('/maintenance/repair-ledger', {
    params: { page, size },
  })
}

export function runDbRepair(plan: RepairPlan) {
  return request.post<RepairTaskResult[]>('/maintenance/repair', {
    task: plan.task,
    fingerprint: plan.fingerprint,
    generatedAt: plan.generatedAt,
    confirmed: true,
  })
}

/** 只提交已剥离账号、组织和字典后的业务数据与用户 ID 映射。 */
export function planLegacyImport(
  migrationPackage: LegacyBusinessSubmission,
  mappings: LegacyImportMappings,
) {
  return request.post<LegacyImportDryRunPlan>('/maintenance/legacy-import/plan', {
    package: migrationPackage,
    mappings,
  })
}

export function executeLegacyImport(
  planId: string,
  confirmation: { confirmed: boolean; backupConfirmed: boolean },
) {
  return request.post<LegacyImportExecutionResult>('/maintenance/legacy-import/execute', {
    planId,
    confirmed: confirmation.confirmed,
    backupConfirmed: confirmation.backupConfirmed,
  })
}
