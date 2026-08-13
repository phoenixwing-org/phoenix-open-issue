<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, VideoPlay } from '@element-plus/icons-vue'
import { usePahWorkbenchOutput } from '/@/pah/PahWorkbenchOutput'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import {
  getIssueDictionaryPlan,
  OPEN_ISSUE_DICTIONARY_PRESET,
  OPEN_ISSUE_DICTIONARY_TYPE_COUNT,
  reconcileIssueDictionary,
  type IssueDictionaryPlan,
  type IssueDictionaryTypePlan,
} from '/$/phoenix-open-issue/api/dictionary-maintenance'
import {
  getRepairLedger,
  getRepairTasks,
  getRepairPlan,
  executeLegacyImport,
  planLegacyImport,
  runDbRepair,
  type RepairLedgerItem,
  type RepairLedgerStatus,
  type RepairTaskDefinition,
  type RepairTaskId,
  type LegacyImportDryRunPlan,
} from '/$/phoenix-open-issue/api/maintenance'
import {
  getTestFiles,
  getTestStatus,
  runAllTests,
  type TestFileInfo,
  type TestRunResult,
} from '/$/phoenix-open-issue/api/test'
import {
  createLegacyBusinessSubmission,
  formatUserLabel,
  LEGACY_BUSINESS_TABLES,
  previewLegacyMigrationPackage,
  suggestLegacyUserMappings,
  type HostUserIdentity,
  type LegacyBusinessSubmission,
  type LegacyUserIdentity,
} from '/$/phoenix-open-issue/core'
import PoiMaintenancePrimary from '/$/phoenix-open-issue/components/workbench/PoiMaintenancePrimary.vue'
import PoiCompactEditorView from '/$/phoenix-open-issue/components/workbench/PoiCompactEditorView.vue'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'
import {
  maintenanceFailureOutputLine,
  maintenanceOutputLine,
  repairPlanOutputLines,
  repairResultOutputLines,
  testResultOutputLines,
} from '/$/phoenix-open-issue/core/maintenanceOutput'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'

type MaintenanceSection = 'repair' | 'dictionary' | 'tests' | 'audit'

type LegacyImportState = 'idle' | 'selected' | 'checking' | 'ready' | 'blocked'

interface LegacyImportTableSummary {
  table: string
  label: string
  rows: number
}

interface LegacyImportPreview {
  version: number | null
  timestamp: string | null
  exportScope: string | null
  tables: LegacyImportTableSummary[]
  excluded: string[]
  blockers: string[]
  totalRows: number
  userReferences: string[]
  legacyUsers: LegacyUserIdentity[]
}

const route = useRoute()
const router = useRouter()
const workbenchOutput = usePahWorkbenchOutput()
const capabilities = useIssueCapabilities()
const canReadMaintenance = computed(() => capabilities.can('phoenix-open-issue:maintenance:read'))
const canRunMaintenance = computed(() => capabilities.can('phoenix-open-issue:maintenance:run'))
const canListHostUsers = computed(() => capabilities.has('base:sys:user:list'))
const canReadTests = computed(() => capabilities.can('phoenix-open-issue:test:read'))
const canRunTests = computed(() => capabilities.can('phoenix-open-issue:test:run'))
const activeSection = ref<MaintenanceSection>(
  route.path.endsWith('/test-runner') ? 'tests' : 'repair',
)

const tasks = ref<RepairTaskDefinition[]>([])
const loading = ref(false)
const planningTask = ref<RepairTaskId | null>(null)
const repairingTask = ref<RepairTaskId | null>(null)
const ledgerRows = ref<RepairLedgerItem[]>([])
const ledgerLoading = ref(false)
const dictionaryPlan = ref<IssueDictionaryPlan | null>(null)
const dictionaryLoading = ref(false)
const dictionaryReconciling = ref(false)
const legacyImportInput = ref<HTMLInputElement | null>(null)
const legacyImportFile = ref<File | null>(null)
const legacyImportState = ref<LegacyImportState>('idle')
const legacyImportPreview = ref<LegacyImportPreview | null>(null)
const legacyImportError = ref<string | null>(null)
const legacyImportSubmission = ref<LegacyBusinessSubmission | null>(null)
const legacyImportPlanning = ref(false)
const legacyImportExecuting = ref(false)
const legacyImportPlan = ref<LegacyImportDryRunPlan | null>(null)
const legacyImportBackupConfirmed = ref(false)
const legacyHostUsersLoading = ref(false)
const legacyHostUsers = ref<HostUserIdentity[]>([])
const legacyUserMappings = ref<Record<string, string>>({})

const testFiles = ref<TestFileInfo[]>([])
const testsLoading = ref(false)
const testsRunning = ref(false)
const testsAvailable = ref(false)
const testReasonCode = ref<string | null>('PROFILE_NOT_LOADED')
const testProfileFingerprint = ref<string | null>(null)
const testDeclarationFingerprint = ref<string | null>(null)
const lastTestResult = ref<TestRunResult | null>(null)

function appendOutputLines(lines: readonly string[]) {
  for (const line of lines) workbenchOutput?.appendLine(line)
}

function appendOutput(message: string) {
  workbenchOutput?.appendLine(maintenanceOutputLine(message))
}

function repairTaskLabel(taskId: RepairTaskId) {
  if (taskId === 'checkpoints') return '点检数据修正'
  if (taskId === 'links') return 'Issue 链接修正'
  if (taskId === 'list-org-references') return 'IssueList 历史组织引用清理'
  return '全部修正'
}

const legacyBusinessTableLabels = new Map<string, string>(LEGACY_BUSINESS_TABLES)

function legacyExistingReasonLabel(
  reason: LegacyImportDryRunPlan['skippedExisting'][number]['reason'],
) {
  if (reason === 'id') return '相同 ID'
  if (reason === 'member') return '相同列表与用户'
  if (reason === 'issueNo') return '相同 Issue 编号'
  if (reason === 'link') return '相同 Issue 与列表'
  if (reason === 'function') return '相同平台与外部 ID'
  return '相同 Issue 与 8D 内容签名'
}

function legacyConflictKeyLabel(key: LegacyImportDryRunPlan['targetConflicts'][number]['key']) {
  if (key === 'issueNo') return 'Issue 编号'
  if (key === 'member') return '列表成员'
  if (key === 'link') return 'Issue 列表关联'
  if (key === 'function') return '平台功能标识'
  return 'ID'
}

const totalTestCases = computed(() =>
  testFiles.value.reduce((total, file) => total + file.caseCount, 0),
)
const testUnavailableTitle = computed(() => {
  const reason = testReasonCode.value || 'RUNNER_UNAVAILABLE'
  return `当前环境未提供受控 Vitest，测试运行不可用（${reason}）`
})
const dictionaryCanReconcile = computed(() => Boolean(
  dictionaryPlan.value
  && dictionaryPlan.value.conflicts.length === 0
  && (dictionaryPlan.value.totals.createTypes > 0 || dictionaryPlan.value.totals.createItems > 0),
))
const legacyImportStatus = computed(() => {
  if (legacyImportState.value === 'selected') return '待只读预检'
  if (legacyImportState.value === 'checking') return '正在只读预检'
  if (legacyImportState.value === 'ready') return legacyImportPlan.value?.executionAllowed
    ? '执行计划已就绪'
    : '本地预检通过 / 待生成计划'
  if (legacyImportState.value === 'blocked') return '已阻断 / 未写入'
  return '未选择文件'
})
const mappedLegacyUserCount = computed(() =>
  legacyImportPreview.value?.userReferences.filter(id => legacyUserMappings.value[id]).length ?? 0,
)
const legacyImportCanRequest = computed(() => Boolean(
  canRunMaintenance.value
  && legacyImportPreview.value
  && legacyImportPreview.value.blockers.length === 0
  && mappedLegacyUserCount.value === legacyImportPreview.value.userReferences.length
  && legacyImportSubmission.value
  && !legacyImportPlanning.value
  && legacyImportState.value === 'ready',
))
const legacyImportCanExecute = computed(() => Boolean(
  canRunMaintenance.value
  && legacyImportPlan.value?.executionAllowed
  && legacyImportPlan.value.planId
  && legacyImportBackupConfirmed.value
  && !legacyImportExecuting.value,
))

function hostUserLabel(user: HostUserIdentity) {
  return `${formatUserLabel(user)} · ${user.id}${user.disabled ? '（已停用）' : ''}`
}

function dictionaryItemCount(
  type: IssueDictionaryTypePlan,
  action: 'create' | 'preserve',
) {
  return type.items.filter(item => item.action === action).length
}

function applyTestRunnerIdentity(data: {
  available: boolean
  reasonCode: string | null
  profileFingerprint: string
  declarationFingerprint: string | null
}) {
  const sameProfile = !testProfileFingerprint.value
    || testProfileFingerprint.value === data.profileFingerprint
  const sameDeclaration = !testDeclarationFingerprint.value
    || testDeclarationFingerprint.value === data.declarationFingerprint
  const unchanged = sameProfile && sameDeclaration
  testsAvailable.value = data.available && unchanged
  testReasonCode.value = unchanged
    ? data.reasonCode
    : 'PROFILE_FINGERPRINT_CHANGED'
  testProfileFingerprint.value = data.profileFingerprint
  testDeclarationFingerprint.value = data.declarationFingerprint
  return unchanged
}
const taskRows = computed(() => [
  ...tasks.value,
  {
    id: 'all' as const,
    title: '全部执行',
    description: '按顺序执行以上全部修正；所有任务均为幂等，可重复执行。',
  },
])
const embeddedPreview = computed(() => {
  try {
    if (window.self !== window.top) return true
  } catch {
    return true
  }
  return /Electron/i.test(navigator.userAgent)
})
const reportFullUrl = computed(() => {
  const relative = lastTestResult.value?.reportUrl
  return relative ? new URL(relative, window.location.origin).href : null
})

async function loadRepairTasks(announce = false) {
  if (!canReadMaintenance.value) return
  if (announce) appendOutput('正在刷新数据修正任务')
  loading.value = true
  try {
    tasks.value = (await getRepairTasks()).data
    if (announce) appendOutput(`数据修正任务已刷新：${tasks.value.length} 项`)
  } catch (error) {
    if (announce) {
      appendOutputLines([maintenanceFailureOutputLine('刷新数据修正任务', error)])
      ElMessage.error('刷新数据修正任务失败')
      return
    }
    throw error
  } finally {
    loading.value = false
  }
}

async function onRefreshRepairTasks() {
  await loadRepairTasks(true)
}

async function loadLedger(announce = false) {
  if (!canReadMaintenance.value) return
  if (announce) appendOutput('正在刷新修正审计')
  ledgerLoading.value = true
  try {
    ledgerRows.value = (await getRepairLedger(1, 20)).data.list
    if (announce) appendOutput(`修正审计已刷新：${ledgerRows.value.length} 条`)
  } catch (error) {
    if (announce) {
      appendOutputLines([maintenanceFailureOutputLine('刷新修正审计', error)])
      ElMessage.error('刷新修正审计失败')
      return
    }
    throw error
  } finally {
    ledgerLoading.value = false
  }
}

async function onRefreshLedger() {
  await loadLedger(true)
}

async function loadTestFiles(announce = false) {
  if (!canReadTests.value) return
  if (announce) appendOutput('正在刷新受控测试清单')
  testsLoading.value = true
  try {
    const { data } = await getTestFiles()
    testFiles.value = data.files
    applyTestRunnerIdentity(data)
    if (announce) {
      const state = data.available
        ? 'Runner 可用'
        : `Runner 不可用（${data.reasonCode || 'RUNNER_UNAVAILABLE'}）`
      appendOutput(`受控测试清单已刷新：${data.fileCount} files / ${data.caseCount} tests · ${state}`)
    }
  } catch (error: any) {
    if (announce) appendOutputLines([maintenanceFailureOutputLine('刷新受控测试清单', error)])
    ElMessage.error(error?.response?.data?.message || '加载测试文件失败')
  } finally {
    testsLoading.value = false
  }
}

async function onRefreshTestFiles() {
  await loadTestFiles(true)
}

async function loadTestStatus() {
  if (!canReadTests.value) return
  try {
    const { data } = await getTestStatus()
    applyTestRunnerIdentity(data)
    testsRunning.value = data.running
    if (
      data.lastResult
      && data.lastResult.profileFingerprint === data.profileFingerprint
      && data.lastResult.declarationFingerprint === data.declarationFingerprint
    ) {
      lastTestResult.value = data.lastResult
    } else if (data.lastResult) {
      lastTestResult.value = null
    }
  } catch {
    // 状态轮询失败不覆盖已显示的测试清单和最近结果。
  }
}

function selectSection(section: MaintenanceSection) {
  if (section === 'tests' && !canReadTests.value) return
  if (section !== 'tests' && !canReadMaintenance.value) return
  activeSection.value = section
  if (section === 'dictionary' && !dictionaryPlan.value) {
    void loadIssueDictionaryPlan(true)
  }
}

async function loadIssueDictionaryPlan(announce = false) {
  if (!canReadMaintenance.value) return
  if (announce) appendOutput('正在查询 Open Issue 字典补全计划')
  dictionaryLoading.value = true
  try {
    const plan = await getIssueDictionaryPlan()
    dictionaryPlan.value = plan
    if (announce) {
      appendOutput(
        `Issue 字典计划：${plan.types.length} 类；缺失 ${plan.totals.createTypes} 类/${plan.totals.createItems} 项；已存在 ${plan.totals.preserveItems} 项；冲突 ${plan.conflicts.length} 项；指纹 ${plan.fingerprint.slice(0, 12)}`,
      )
    }
  } catch (error) {
    appendOutputLines([maintenanceFailureOutputLine('查询 Issue 字典计划', error)])
    ElMessage.error('Issue 字典计划查询失败')
  } finally {
    dictionaryLoading.value = false
  }
}

async function onReconcileIssueDictionary() {
  const plan = dictionaryPlan.value
  if (!plan || !dictionaryCanReconcile.value) return
  try {
    await ElMessageBox.confirm(
      `将补全 ${plan.totals.createTypes} 个类型和 ${plan.totals.createItems} 个缺失项；保留 ${plan.totals.preserveItems} 个既有项及 ${plan.totals.preserveCustomItems} 个管理员自定义项。`,
      '确认补全 Open Issue 字典',
      {
        type: 'warning',
        confirmButtonText: '确认补全',
        cancelButtonText: '取消',
      },
    )
  } catch {
    appendOutput('已取消 Open Issue 字典补全，未执行写入')
    return
  }
  dictionaryReconciling.value = true
  appendOutput(`开始补全 Open Issue 字典 · 计划 ${plan.fingerprint.slice(0, 12)}`)
  try {
    await reconcileIssueDictionary(plan.fingerprint)
    appendOutput('Open Issue 字典补全完成；正在重新查询计划')
    ElMessage.success('Open Issue 字典补全完成')
    await loadIssueDictionaryPlan(true)
  } catch (error) {
    appendOutputLines([maintenanceFailureOutputLine('补全 Open Issue 字典', error)])
    ElMessage.error('Open Issue 字典补全失败')
  } finally {
    dictionaryReconciling.value = false
  }
}

function openCoolDictionary() {
  void router.push('/dict/list')
}

function selectLegacyImportFile() {
  legacyImportInput.value?.click()
}

function onLegacyImportFileSelected(event: Event) {
  const input = event.currentTarget as HTMLInputElement
  legacyImportFile.value = input.files?.[0] ?? null
  legacyImportPreview.value = null
  legacyImportError.value = null
  legacyImportSubmission.value = null
  legacyImportPlan.value = null
  legacyImportBackupConfirmed.value = false
  legacyHostUsers.value = []
  legacyUserMappings.value = {}
  legacyImportState.value = legacyImportFile.value ? 'selected' : 'idle'
}

function onLegacyUserMappingChanged() {
  legacyImportPlan.value = null
  legacyImportBackupConfirmed.value = false
}

async function loadLegacyHostUserMappings(legacyUsers: LegacyUserIdentity[]) {
  if (!canListHostUsers.value) {
    legacyHostUsers.value = []
    legacyUserMappings.value = {}
    appendOutput('当前角色没有 base:sys:user:list；不能读取 Host 用户候选，请由 Host 管理员完成映射')
    return
  }
  legacyHostUsersLoading.value = true
  try {
    const { data } = await getAllUsers({ includeDisabled: true })
    legacyHostUsers.value = data.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      disabled: Boolean(user.disabled),
    }))
    legacyUserMappings.value = suggestLegacyUserMappings(legacyUsers, legacyHostUsers.value)
    appendOutput(
      `Host 用户映射建议完成：${Object.keys(legacyUserMappings.value).length}/${legacyUsers.length} 个唯一精确命中；仅提交 ID 对照，不上传旧账号资料`,
    )
  } catch {
    legacyHostUsers.value = []
    legacyUserMappings.value = {}
    appendOutput('Host 用户公共列表不可用；请先授予用户列表读取能力或由 Host 提供受信映射，不上传旧账号资料')
  } finally {
    legacyHostUsersLoading.value = false
  }
}

async function fileSha256(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer())
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

async function onPreviewLegacyImport() {
  const file = legacyImportFile.value
  if (!file) return
  legacyImportState.value = 'checking'
  legacyImportError.value = null
  legacyImportSubmission.value = null
  appendOutput('开始旧站 JSON 本地只读预检；不会上传文件或写入数据库')
  try {
    const parsed = JSON.parse(await file.text()) as unknown
    const preview = previewLegacyMigrationPackage(parsed)

    legacyImportPreview.value = {
      version: preview.version,
      timestamp: preview.timestamp,
      exportScope: preview.exportScope,
      tables: preview.tables,
      excluded: preview.excluded.map(item => `${item.table}（${item.rows}）`),
      blockers: preview.blockers,
      totalRows: preview.totalRows,
      userReferences: preview.userReferences,
      legacyUsers: preview.legacyUsers,
    }
    legacyImportState.value = preview.blockers.length ? 'blocked' : 'ready'
    appendOutput(`旧站 JSON 只读预检完成：8 类业务数据共 ${preview.totalRows} 行；排除 ${preview.excluded.length} 类非业务数据；未执行写入`)
    if (preview.blockers.length) {
      ElMessage.error('旧站 JSON 预检未通过，未执行写入')
    } else {
      legacyImportSubmission.value = createLegacyBusinessSubmission(
        parsed,
        await fileSha256(file),
      )
      await loadLegacyHostUserMappings(preview.legacyUsers)
      appendOutput(`已生成剥离后的业务提交物：${preview.totalRows} 行；原始 JSON、账号、组织和字典未上传`)
      ElMessage.success('本地只读预检通过，可继续生成服务端计划')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'JSON 解析失败'
    legacyImportPreview.value = null
    legacyImportError.value = message
    legacyImportState.value = 'blocked'
    appendOutput(`旧站 JSON 只读预检失败：${message}；未上传文件，未写入数据库`)
    ElMessage.error(`只读预检失败：${message}`)
  }
}

async function onRequestLegacyImport() {
  if (!legacyImportCanRequest.value || !legacyImportSubmission.value) return
  legacyImportPlanning.value = true
  legacyImportPlan.value = null
  legacyImportBackupConfirmed.value = false
  appendOutput('开始生成服务端只读迁移计划；只提交已剥离的 Issue 业务数据，不执行写入')
  try {
    const { data } = await planLegacyImport(legacyImportSubmission.value, {
      users: legacyUserMappings.value,
      orgUnits: {},
    })
    legacyImportPlan.value = data
    const insertRows = Object.values(data.insertCounts).reduce((total, count) => total + count, 0)
    appendOutput(`服务端只读计划完成：源数据 ${data.totalRows} 行，计划写入 ${insertRows} 行；数据验证阻断 ${data.validationBlockers.length} 项；执行门禁 ${data.executionBlockers.length} 项；未写入数据库`)
    for (const item of data.skippedExisting) {
      const table = legacyBusinessTableLabels.get(item.table) ?? item.table
      const value = item.value ? `；判重值 ${item.value}` : ''
      appendOutput(`迁移跳过：${table}；判重依据 ${legacyExistingReasonLabel(item.reason)}${value}；源 ID ${item.sourceId}；目标 ID ${item.targetId}；保留目标记录，继续其他数据`)
    }
    for (const item of data.targetConflicts) {
      const table = legacyBusinessTableLabels.get(item.table) ?? item.table
      const value = item.value ? `；冲突值 ${item.value}` : ''
      const identities = item.sourceId || item.targetId
        ? `；源 ID ${item.sourceId ?? '未知'}；目标 ID ${item.targetId ?? '未知'}`
        : ''
      appendOutput(`迁移冲突：${table}；冲突键 ${legacyConflictKeyLabel(item.key)}${value}${identities}；无法安全判定为同一记录`)
    }
    for (const warning of data.warnings) appendOutput(`迁移提示：${warning}`)
    for (const blocker of [...data.validationBlockers, ...data.executionBlockers]) {
      appendOutput(`迁移阻断：${blocker}`)
    }
    legacyImportState.value = 'ready'
    if (data.executionAllowed) {
      ElMessage.success('服务端迁移计划已就绪')
    } else {
      ElMessage.warning('服务端只读计划未就绪；请修正用户映射或目标数据冲突后重试')
    }
  } catch (error) {
    legacyImportState.value = 'blocked'
    appendOutputLines([maintenanceFailureOutputLine('生成旧站数据服务端计划', error)])
    ElMessage.error('服务端只读迁移计划生成失败')
  } finally {
    legacyImportPlanning.value = false
  }
}

async function onExecuteLegacyImport() {
  const plan = legacyImportPlan.value
  if (!plan?.planId || !legacyImportCanExecute.value) return
  const insertRows = Object.values(plan.insertCounts).reduce((total, count) => total + count, 0)
  try {
    await ElMessageBox.confirm(
      `将按计划 ${plan.planId.slice(0, 8)} 写入 ${insertRows} 行 Open Issue 业务数据。核心 Issue/List/Link 等在一个 PostgreSQL 事务中提交；8D 采用独立可选事务，失败不会回滚核心业务。成功后如验收异常，请使用已确认的备份恢复。`,
      '确认执行一次性旧站导入',
      {
        type: 'warning',
        confirmButtonText: '确认导入',
        cancelButtonText: '取消',
      },
    )
  } catch {
    appendOutput('已取消旧站数据导入；未执行写入')
    return
  }
  legacyImportExecuting.value = true
  appendOutput(`开始核心业务单事务导入：计划 ${plan.planId.slice(0, 8)}；已人工确认可恢复备份；8D 使用独立可选事务`)
  try {
    const { data } = await executeLegacyImport(plan.planId, {
      confirmed: true,
      backupConfirmed: legacyImportBackupConfirmed.value,
    })
    for (const warning of data.warnings) appendOutput(`迁移提示：${warning}`)
    const coreInserted = data.totalInserted - data.inserted.eightDReports
    const coreSkipped = data.skippedExisting.filter(item => item.table !== 'eightDReports').length
    const eightDSkipped = data.skippedExisting.filter(item => item.table === 'eightDReports').length
    appendOutput(`旧站业务数据导入完成：核心业务写入 ${coreInserted} 行；核心重复跳过 ${coreSkipped} 行；可选 8D 写入 ${data.inserted.eightDReports} 行；8D 已存在跳过 ${eightDSkipped} 行`)
    legacyImportPlan.value = null
    legacyImportBackupConfirmed.value = false
    ElMessage.success(`旧站业务数据导入完成：${data.totalInserted} 行`)
  } catch (error) {
    appendOutputLines([maintenanceFailureOutputLine('执行旧站核心业务单事务导入', error)])
    ElMessage.error('旧站核心业务导入失败；核心事务已回滚，请修正后重新生成计划')
  } finally {
    legacyImportExecuting.value = false
  }
}

watch(() => route.path, (path) => {
  if (path.endsWith('/test-runner') && canReadTests.value) {
    activeSection.value = 'tests'
  } else if (path.endsWith('/maintenance') && canReadMaintenance.value) {
    activeSection.value = 'repair'
  } else if (path.endsWith('/maintenance') && !canReadMaintenance.value && canReadTests.value) {
    activeSection.value = 'tests'
  }
})

function ledgerStatusType(status: RepairLedgerStatus) {
  if (status === 'succeeded') return 'success'
  if (status === 'failed') return 'danger'
  return 'warning'
}

function ledgerStatusLabel(status: RepairLedgerStatus) {
  if (status === 'succeeded') return '成功'
  if (status === 'failed') return '失败'
  return '执行中'
}

function formatAuditTime(value: string | null) {
  if (!value) return '—'
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

async function onRepairTask(taskId: RepairTaskId) {
  if (!canRunMaintenance.value) return
  const taskTitle = repairTaskLabel(taskId)
  appendOutput(`开始生成执行前 dry-run：${taskTitle}`)
  repairingTask.value = taskId
  try {
    const plan = await loadRepairPlan(taskId)
    appendOutputLines(repairPlanOutputLines(plan))
    const changes = plan.plans.reduce((total, item) => total + item.changeCount, 0)
    if (changes === 0) {
      appendOutput(`${taskTitle}：当前无需写入`)
      ElMessage.info('dry-run 完成，当前没有需要修正的数据')
      return
    }
    const destructive = plan.plans.some(item => item.destructive)
    const description = plan.plans
      .flatMap(item => [`${item.task}：${item.changeCount} 项`, ...item.details])
      .join('\n')
    await ElMessageBox.confirm(
      `${description}\n\n计划有效期至 ${plan.expiresAt}。确认后仅执行该指纹对应的数据变化。`,
      destructive ? '确认执行含去重操作的数据修正' : '确认执行数据修正',
      {
        type: destructive ? 'warning' : 'info',
        confirmButtonText: '确认执行',
        cancelButtonText: '取消',
      },
    )
    appendOutput(`已确认执行：${taskTitle} · 计划 ${plan.fingerprint.slice(0, 12)}`)
    const results = (await runDbRepair(plan)).data
    appendOutputLines(repairResultOutputLines(results))
    const fixed = results.reduce((total, item) => total + item.fixed, 0)
    ElMessage.success(fixed ? `修正完成，共处理 ${fixed} 项` : '检查完成，数据已是最新')
    await loadLedger()
  } catch (error: any) {
    if (error === 'cancel' || error === 'close') {
      appendOutput(`已取消：${taskTitle}，未执行写入`)
      return
    }
    appendOutputLines([maintenanceFailureOutputLine(`执行${taskTitle}`, error)])
    try {
      await loadLedger()
    } catch {
      // 审计刷新失败不应覆盖原操作的安全错误摘要。
    }
    ElMessage.error('数据修正执行失败')
  } finally {
    repairingTask.value = null
  }
}

async function loadRepairPlan(taskId: RepairTaskId) {
  planningTask.value = taskId
  try {
    return (await getRepairPlan(taskId)).data
  } finally {
    planningTask.value = null
  }
}

async function onPreviewTask(taskId: RepairTaskId) {
  if (!canReadMaintenance.value) return
  const taskTitle = repairTaskLabel(taskId)
  appendOutput(`开始 dry-run：${taskTitle}`)
  try {
    const plan = await loadRepairPlan(taskId)
    appendOutputLines(repairPlanOutputLines(plan))
    const changes = plan.plans.reduce((total, item) => total + item.changeCount, 0)
    appendOutput(`${taskTitle} dry-run 完成：${changes} 项待修正，未执行写入`)
    ElMessage.info(changes
      ? `dry-run 完成，发现 ${changes} 项待修正数据；未执行写入`
      : 'dry-run 完成，当前没有需要修正的数据')
  } catch (error) {
    appendOutputLines([maintenanceFailureOutputLine(`${taskTitle} dry-run`, error)])
    ElMessage.error('dry-run 执行失败')
  }
}

async function onRunAllTests() {
  if (!canRunTests.value) return
  appendOutput(`开始运行受控测试：${testFiles.value.length} files / ${totalTestCases.value} tests`)
  testsRunning.value = true
  try {
    const { data } = await runAllTests()
    if (
      data.profileFingerprint !== testProfileFingerprint.value
      || data.declarationFingerprint !== testDeclarationFingerprint.value
    ) {
      testsAvailable.value = false
      testReasonCode.value = 'PROFILE_FINGERPRINT_CHANGED'
      appendOutput('已拒绝运行：受控测试 Profile 指纹已变化')
      ElMessage.error('受控测试 Profile 已变化，请刷新清单后重试')
      return
    }
    lastTestResult.value = data
    appendOutputLines(testResultOutputLines(data))
    ElMessage.success(data.message || '测试运行完成')
  } catch (error: any) {
    if (error?.response?.status === 409) {
      appendOutput('未启动新任务：受控测试已在运行')
      ElMessage.warning('测试正在运行中')
    } else {
      appendOutputLines([maintenanceFailureOutputLine('运行受控测试', error)])
      ElMessage.error(error?.response?.data?.message || '测试运行失败')
    }
  } finally {
    testsRunning.value = false
    void loadTestStatus()
  }
}

let reportOpenLock = false
function openReportInBrowser() {
  const url = reportFullUrl.value
  if (!url || reportOpenLock) return
  reportOpenLock = true
  window.setTimeout(() => { reportOpenLock = false }, 2000)
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function copyReportLink(newTabHint = false) {
  const url = reportFullUrl.value
  if (!url) return
  try {
    await navigator.clipboard.writeText(url)
    ElMessage.success(newTabHint
      ? '已复制。请新建标签页后粘贴打开'
      : '报告链接已复制')
  } catch {
    ElMessage.info(url)
  }
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiMaintenancePrimary,
    props: computed(() => ({
      viewKey: 'phoenix-open-issue-maintenance',
      activeSection: activeSection.value,
      canReadMaintenance: canReadMaintenance.value,
      canReadTests: canReadTests.value,
      repairTaskCount: tasks.value.length,
      dictionaryTypeCount: dictionaryPlan.value?.types.length ?? OPEN_ISSUE_DICTIONARY_TYPE_COUNT,
      testFileCount: testFiles.value.length,
      totalTestCases: totalTestCases.value,
      testsRunning: testsRunning.value,
      onSelectSection: selectSection,
    })),
  },
})

onMounted(async () => {
  if (activeSection.value === 'tests' && !canReadTests.value && canReadMaintenance.value) {
    activeSection.value = 'repair'
  } else if (!canReadMaintenance.value && canReadTests.value) {
    activeSection.value = 'tests'
  }
  await Promise.all([
    loadRepairTasks(),
    loadLedger(),
    loadTestStatus(),
    loadTestFiles(),
  ])
})
</script>

<template>
  <PoiCompactEditorView title="Open Issue 维护" content-aria-label="Open Issue 维护内容">
    <template #actions>
      <el-button
        v-if="activeSection === 'repair' && canReadMaintenance"
        :loading="loading"
        @click="onRefreshRepairTasks"
      ><el-icon><Refresh /></el-icon>刷新</el-button>
      <el-button
        v-else-if="activeSection === 'audit' && canReadMaintenance"
        :loading="ledgerLoading"
        @click="onRefreshLedger"
      ><el-icon><Refresh /></el-icon>刷新</el-button>
      <template v-else-if="activeSection === 'dictionary' && canReadMaintenance">
        <el-button :loading="dictionaryLoading" @click="loadIssueDictionaryPlan(true)"><el-icon><Refresh /></el-icon>刷新计划</el-button>
        <el-button @click="openCoolDictionary">打开 Cool 数据字典</el-button>
        <el-button
          type="primary"
          :loading="dictionaryReconciling"
          :disabled="!dictionaryCanReconcile"
          @click="onReconcileIssueDictionary"
        >补全 Issue 字典</el-button>
      </template>
      <template v-else-if="activeSection === 'tests' && canReadTests">
        <el-button :loading="testsLoading" @click="onRefreshTestFiles"><el-icon><Refresh /></el-icon>刷新</el-button>
        <el-button
          v-if="canRunTests"
          type="primary"
          :loading="testsRunning"
          :disabled="!testsAvailable || testsRunning"
          @click="onRunAllTests"
        ><el-icon><VideoPlay /></el-icon>全部运行</el-button>
      </template>
    </template>

    <el-alert
      v-if="!canReadMaintenance && !canReadTests"
      title="当前 Cool 角色未授予 Issue 维护或测试读取权限"
      type="warning"
      :closable="false"
      show-icon
      class="view-note"
    />

    <section v-if="activeSection === 'repair' && canReadMaintenance" class="view-section" aria-labelledby="maintenance-repair-title">
      <header class="section-head">
        <div>
          <h2 id="maintenance-repair-title">数据检查与修正</h2>
          <p>这里只处理 Open Issue 插件自有数据；账号、登录、字典、DDL 和整库备份由 Host/Pah 管理。</p>
        </div>
      </header>
      <el-alert
        v-if="!canRunMaintenance"
        title="当前角色只能查看 dry-run 能力，未授予修正执行权限"
        type="info"
        :closable="false"
        show-icon
        class="view-note"
      />
      <el-table
        class="view-table"
        :data="taskRows"
        v-loading="loading"
        data-tour="settings-repair"
      >
        <el-table-column prop="title" label="任务" width="150" />
        <el-table-column prop="description" label="说明" min-width="360" show-overflow-tooltip />
        <el-table-column label="操作" width="190" fixed="right">
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :loading="planningTask === row.id && repairingTask !== row.id"
              :disabled="!!planningTask || !!repairingTask"
              @click="onPreviewTask(row.id)"
            >预览 dry-run</el-button>
            <el-button
              v-if="canRunMaintenance"
              link
              :type="row.id === 'all' ? 'warning' : 'danger'"
              :loading="repairingTask === row.id"
              :disabled="!!planningTask || (!!repairingTask && repairingTask !== row.id)"
              @click="onRepairTask(row.id)"
            >{{ row.id === 'all' ? '全部执行' : '执行修正' }}</el-button>
          </template>
        </el-table-column>
      </el-table>

      <section class="legacy-import-section" aria-labelledby="maintenance-legacy-import-title">
        <header class="section-head">
          <div>
            <h2 id="maintenance-legacy-import-title">旧站 JSON 数据迁移</h2>
            <p>一次性导入 Open Issue 业务数据；旧用户映射到现有 Host 人员，不导入账号、密码、登录、角色、组织或 Host 字典。</p>
          </div>
          <el-tag :type="legacyImportState === 'ready' ? 'success' : legacyImportState === 'blocked' ? 'danger' : 'info'">
            {{ legacyImportStatus }}
          </el-tag>
        </header>
        <el-alert
          title="先生成只读计划，再人工确认可恢复的 PostgreSQL 备份并执行核心业务单事务导入"
          description="本地预检不上传原文件；“生成导入计划”只提交剥离后的业务数据与用户 ID 映射，不写库。核心事务失败自动回滚；8D 使用独立可选事务，失败或已存在均不阻断核心业务。"
          type="warning"
          :closable="false"
          show-icon
          class="view-note"
        />
        <el-alert
          v-if="!canRunMaintenance"
          title="当前角色未授予维护执行权限，只能选择文件并查看只读预检"
          type="info"
          :closable="false"
          show-icon
          class="view-note"
        />
        <input
          ref="legacyImportInput"
          class="native-file-input"
          type="file"
          accept=".json,application/json"
          @change="onLegacyImportFileSelected"
        >
        <div class="legacy-import-actions">
          <el-button @click="selectLegacyImportFile">选择 JSON 文件</el-button>
          <el-button
            :loading="legacyImportState === 'checking'"
            :disabled="!legacyImportFile || legacyImportState === 'checking'"
            @click="onPreviewLegacyImport"
          >只读预检</el-button>
          <el-button
            type="primary"
            :loading="legacyImportPlanning"
            :disabled="!legacyImportCanRequest"
            @click="onRequestLegacyImport"
          >生成导入计划</el-button>
          <el-checkbox
            v-model="legacyImportBackupConfirmed"
            :disabled="!legacyImportPlan?.executionAllowed || legacyImportExecuting"
          >已有可恢复的 PostgreSQL 备份</el-checkbox>
          <el-button
            type="danger"
            :loading="legacyImportExecuting"
            :disabled="!legacyImportCanExecute"
            @click="onExecuteLegacyImport"
          >执行一次性导入</el-button>
          <span v-if="legacyImportFile" class="legacy-file-name">{{ legacyImportFile.name }} · {{ legacyImportFile.size }} bytes</span>
        </div>
        <el-alert
          v-if="legacyImportError"
          title="只读预检失败"
          :description="legacyImportError"
          type="error"
          :closable="false"
          show-icon
          class="view-note"
        />
        <template v-if="legacyImportPreview">
          <div class="import-facts" aria-label="旧站 JSON 预检摘要">
            <span>版本 <strong>{{ legacyImportPreview.version ?? '未知' }}</strong></span>
            <span>范围 <strong>{{ legacyImportPreview.exportScope ?? '未声明' }}</strong></span>
            <span>时间 <strong>{{ legacyImportPreview.timestamp ?? '未声明' }}</strong></span>
            <span>业务行数 <strong>{{ legacyImportPreview.totalRows }}</strong></span>
          </div>
          <el-alert
            v-if="legacyImportPreview.blockers.length"
            title="预检存在阻断项"
            :description="legacyImportPreview.blockers.join('；')"
            type="error"
            :closable="false"
            show-icon
            class="view-note"
          />
          <el-alert
            v-if="legacyImportPreview.excluded.length"
            title="以下非 Issue 业务数据已排除，不会导入"
            :description="legacyImportPreview.excluded.join('、')"
            type="info"
            :closable="false"
            show-icon
            class="view-note"
          />
          <el-table class="view-table" :data="legacyImportPreview.tables" size="small">
            <el-table-column prop="label" label="业务数据" min-width="180" />
            <el-table-column prop="table" label="旧站表" min-width="200" />
            <el-table-column prop="rows" label="行数" width="100" align="right" />
          </el-table>
          <section
            v-if="legacyImportPreview.userReferences.length"
            class="legacy-user-mapping"
            aria-labelledby="maintenance-legacy-user-mapping-title"
          >
            <header class="section-head">
              <div>
                <h3 id="maintenance-legacy-user-mapping-title">Legacy 用户映射</h3>
                <p>仅用户名或邮箱唯一精确命中时自动建议；旧账号、密码、角色和组织不会上传或导入。</p>
              </div>
              <el-tag :type="mappedLegacyUserCount === legacyImportPreview.userReferences.length ? 'success' : 'warning'">
                {{ mappedLegacyUserCount }}/{{ legacyImportPreview.userReferences.length }} 已映射
              </el-tag>
            </header>
            <el-table
              class="view-table"
              :data="legacyImportPreview.legacyUsers"
              size="small"
              v-loading="legacyHostUsersLoading"
            >
              <el-table-column label="旧站用户" min-width="210">
                <template #default="{ row }">
                  <strong>{{ row.username || row.displayName || '未知账号' }}</strong>
                  <div class="legacy-user-id">{{ row.id }}</div>
                </template>
              </el-table-column>
              <el-table-column label="Host 用户" min-width="280">
                <template #default="{ row }">
                  <el-select
                    v-model="legacyUserMappings[row.id]"
                    clearable
                    filterable
                    placeholder="请选择 Host 用户"
                    style="width: 100%"
                    @change="onLegacyUserMappingChanged"
                  >
                    <el-option
                      v-for="user in legacyHostUsers"
                      :key="user.id"
                      :label="hostUserLabel(user)"
                      :value="user.id"
                    />
                  </el-select>
                </template>
              </el-table-column>
            </el-table>
          </section>
        </template>
      </section>
    </section>

    <section v-else-if="activeSection === 'dictionary' && canReadMaintenance" class="view-section" aria-labelledby="maintenance-dictionary-title">
      <header class="section-head">
        <div>
          <h2 id="maintenance-dictionary-title">Open Issue 数据字典</h2>
          <p>当前安装预设：{{ OPEN_ISSUE_DICTIONARY_PRESET }}；产品声明 {{ OPEN_ISSUE_DICTIONARY_TYPE_COUNT }} 类。这里只查询和补全缺失项，编辑、停用和删除仍使用 Cool 数据字典页面。</p>
        </div>
      </header>
      <el-alert
        title="补全由 Host/Pah 根管理员接口执行；不会覆盖既有名称、顺序或额外自定义项"
        type="info"
        :closable="false"
        show-icon
        class="view-note"
      />
      <el-alert
        v-if="dictionaryPlan?.conflicts.length"
        title="检测到字典冲突，已禁止补全"
        :description="dictionaryPlan.conflicts.join('；')"
        type="error"
        :closable="false"
        show-icon
        class="view-note"
      />
      <template v-if="dictionaryPlan">
        <div class="dictionary-facts" aria-label="字典计划摘要">
          <span>缺失类型 <strong>{{ dictionaryPlan.totals.createTypes }}</strong></span>
          <span>缺失项目 <strong>{{ dictionaryPlan.totals.createItems }}</strong></span>
          <span>已存在 <strong>{{ dictionaryPlan.totals.preserveItems }}</strong></span>
          <span>保留自定义 <strong>{{ dictionaryPlan.totals.preserveCustomItems }}</strong></span>
          <span>指纹 <code>{{ dictionaryPlan.fingerprint.slice(0, 12) }}</code></span>
        </div>
        <el-table class="view-table" :data="dictionaryPlan.types" v-loading="dictionaryLoading">
          <el-table-column prop="typeName" label="字典类型" min-width="180" />
          <el-table-column prop="typeKey" label="稳定 Key" min-width="260" show-overflow-tooltip />
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.action === 'create' ? 'warning' : 'success'" size="small">
                {{ row.action === 'create' ? '缺失' : '已存在' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="项目" width="170">
            <template #default="{ row }">
              缺失 {{ dictionaryItemCount(row, 'create') }} / 已有 {{ dictionaryItemCount(row, 'preserve') }}
            </template>
          </el-table-column>
          <el-table-column prop="preservedCustomItems" label="自定义保留" width="110" />
        </el-table>
      </template>
      <el-empty v-else v-loading="dictionaryLoading" description="点击“刷新计划”查询 Issue 字典状态" />
    </section>

    <section v-else-if="activeSection === 'tests' && canReadTests" class="view-section" aria-labelledby="maintenance-tests-title">
      <header class="section-head">
        <div>
          <h2 id="maintenance-tests-title">单元测试</h2>
          <p>固定白名单测试集，仅在开发或受控内网环境可运行；页面不接受命令或文件路径。</p>
        </div>
      </header>
      <el-alert
        v-if="!canRunTests"
        title="当前角色只能查看测试清单和最近结果，未授予运行权限"
        type="info"
        :closable="false"
        show-icon
        class="view-note"
      />
      <el-alert
        v-if="!testsAvailable"
        :title="testUnavailableTitle"
        type="info"
        :closable="false"
        show-icon
        class="view-note"
      />
      <el-table class="view-table" :data="testFiles" v-loading="testsLoading" stripe>
        <el-table-column prop="filePath" label="测试文件" min-width="320" show-overflow-tooltip />
        <el-table-column prop="packageName" label="包" width="120" />
        <el-table-column prop="caseCount" label="用例数" width="90" align="center" />
        <template #empty><el-empty description="暂无可用测试文件" /></template>
      </el-table>

      <section v-if="lastTestResult" class="result-panel" aria-label="最近测试结果">
        <div class="result-head">
          <strong>最近运行</strong>
          <span>{{ lastTestResult.ranAt }}</span>
        </div>
        <p class="test-summary">
          {{ lastTestResult.summary.filesTotal }} 个文件 / {{ lastTestResult.summary.total }} 条 ·
          <span class="is-success">{{ lastTestResult.summary.passed }} 通过</span>
          <template v-if="lastTestResult.summary.failed">
            · <span class="is-danger">{{ lastTestResult.summary.failed }} 失败</span>
          </template>
          · {{ lastTestResult.summary.durationMs }} ms
        </p>
        <div v-if="reportFullUrl" class="report-actions">
          <el-button
            v-if="embeddedPreview"
            type="success"
            plain
            @click="copyReportLink(true)"
          >复制报告链接</el-button>
          <template v-else>
            <el-button type="success" plain @click="openReportInBrowser">新标签查看报告</el-button>
            <el-button link type="primary" @click="copyReportLink()">复制链接</el-button>
          </template>
          <code v-if="embeddedPreview" class="report-url">{{ reportFullUrl }}</code>
        </div>
      </section>
    </section>

    <section v-else-if="activeSection === 'audit' && canReadMaintenance" class="view-section" aria-labelledby="maintenance-audit-title">
      <header class="section-head">
        <div>
          <h2 id="maintenance-audit-title">修正审计</h2>
          <p>只展示 actor、状态、时间、指纹和截断错误；before/result 业务快照不进入列表响应。</p>
        </div>
      </header>
      <el-table
        class="view-table"
        v-loading="ledgerLoading"
        :data="ledgerRows"
        empty-text="尚无修正审计记录"
      >
        <el-table-column label="开始时间" min-width="172">
          <template #default="{ row }">{{ formatAuditTime(row.startedAt) }}</template>
        </el-table-column>
        <el-table-column prop="task" label="任务" min-width="110" />
        <el-table-column label="状态" width="88">
          <template #default="{ row }">
            <el-tag :type="ledgerStatusType(row.status)" size="small">
              {{ ledgerStatusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="actorId" label="执行人 ID" min-width="120" />
        <el-table-column label="计划指纹" min-width="120">
          <template #default="{ row }"><code>{{ row.planFingerprint.slice(0, 12) }}</code></template>
        </el-table-column>
        <el-table-column label="完成时间" min-width="172">
          <template #default="{ row }">{{ formatAuditTime(row.finishedAt) }}</template>
        </el-table-column>
        <el-table-column prop="error" label="错误" min-width="180" show-overflow-tooltip />
      </el-table>
    </section>
  </PoiCompactEditorView>
</template>

<style scoped>
.view-section { min-width: 0; padding-bottom: 16px; }
.section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 0 0 12px; }
.section-head h2 { margin: 0; font-size: 1rem; line-height: 1.5; }
.section-head p { margin: 2px 0 0; color: var(--el-text-color-secondary); font-size: .8rem; line-height: 1.5; }
.view-note { margin-bottom: 12px; }
.view-table { width: 100%; }
.legacy-import-section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--el-border-color-lighter); }
.native-file-input { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.legacy-import-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 12px; }
.legacy-import-actions :deep(.el-button + .el-button) { margin-left: 0; }
.legacy-file-name { min-width: 0; color: var(--el-text-color-secondary); font-size: .78rem; overflow-wrap: anywhere; }
.import-facts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; min-height: 40px; margin-bottom: 8px; padding: 0 12px; border-block: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-regular); font-size: .82rem; }
.import-facts strong { color: var(--el-text-color-primary); font-variant-numeric: tabular-nums; }
.legacy-user-mapping { margin-top: 16px; }
.legacy-user-mapping h3 { margin: 0; font-size: .92rem; line-height: 1.5; }
.legacy-user-id { margin-top: 2px; color: var(--el-text-color-secondary); font-family: var(--el-font-family); font-size: .72rem; overflow-wrap: anywhere; }
.dictionary-facts { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; min-height: 40px; margin-bottom: 8px; padding: 0 12px; border-block: 1px solid var(--el-border-color-lighter); color: var(--el-text-color-regular); font-size: .82rem; }
.dictionary-facts strong { color: var(--el-text-color-primary); font-variant-numeric: tabular-nums; }
.dictionary-facts code { color: var(--el-text-color-secondary); }
.result-panel { margin-top: 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 0; background: var(--el-bg-color); }
.result-head { display: flex; align-items: center; flex-wrap: wrap; gap: 12px; min-height: 40px; padding: 0 12px; border-bottom: 1px solid var(--el-border-color-lighter); font-size: .82rem; }
.result-head span { color: var(--el-text-color-secondary); }
.test-summary { margin: 0; padding: 12px; color: var(--el-text-color-regular); font-size: .86rem; }
.is-success { color: var(--el-color-success); }
.is-danger { color: var(--el-color-danger); }
.report-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 0 12px 12px; }
.report-actions :deep(.el-button + .el-button) { margin-left: 0; }
.report-url { max-width: 100%; padding: 6px 10px; background: var(--el-fill-color-lighter); color: var(--el-text-color-regular); font-size: .75rem; word-break: break-all; }
@media (max-width: 720px) {
  .section-head { display: block; }
  .result-head { align-items: flex-start; padding-block: 8px; }
}
</style>
