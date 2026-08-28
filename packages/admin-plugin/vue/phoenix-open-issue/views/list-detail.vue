<script setup lang="ts">
import { onActivated, onMounted, ref, watch, computed, provide, reactive, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '/$/phoenix-open-issue/stores/issueLists'
import { useIssueStore } from '/$/phoenix-open-issue/stores/issues'
import { useSettingsStore } from '/$/phoenix-open-issue/stores/settings'
import { useDictStore } from '/$/phoenix-open-issue/stores/dict'
import {
  visibleColumnsForMode,
  columnLabel,
  ISSUE_COLUMN_WIDTH_DEFAULTS,
  SORTABLE_ISSUE_COLUMNS,
  DEFAULT_ISSUE_SORT,
  primaryIssueSort,
  type IssueColumnKey,
  type IssueListColumnSettings,
} from '/$/phoenix-open-issue/config/issueListColumns'

const dict = useDictStore()
import { getMembers, addMember, removeMember, transferOwner, updateMemberRole } from '/$/phoenix-open-issue/api/issueLists'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import { createCheckpoint, getCheckpointsByList, updateCheckpoint } from '/$/phoenix-open-issue/api/checkpoints'
import { getIncomingPushes, handlePush } from '/$/phoenix-open-issue/api/push'
import { ElMessage } from 'element-plus';
import { Edit, MoreFilled, Plus, Promotion, Search, User } from '@element-plus/icons-vue'
import { pnwPromptChoice, pnwPromptInput, pnwPropGroup, pnwPropEnum, pnwPropBool, pnwPropSheet } from 'phoenix-wing'
import PnwSidebarBlock from 'phoenix-wing/layout/PnwSidebarBlock.vue'
import { usePhoenixViewDialog } from '/@/phoenix/PahViewDialogs'
import PageHelpButton from "/$/phoenix-open-issue/components/PageHelpButton.vue"
import PoiCompactEditorView from '/$/phoenix-open-issue/components/workbench/PoiCompactEditorView.vue'
import { canPerformListAction, DEFAULT_ATTENTION_LEVEL, ISSUE_URGENCY_DICT, formatUserLabel, unknownUserLabel } from '/$/phoenix-open-issue/core'
import type { Checkpoint } from '/$/phoenix-open-issue/core'
import {
  ISSUE_FORM_DIALOG_RENDERER_ID,
  ISSUE_FORM_DIALOG_SIZE,
  issueFormDialogInitial,
  issueFormDialogUsers,
  type IssueFormDialogProps,
  type IssueFormDialogResult,
} from '/$/phoenix-open-issue/components/issueFormDialog'
import IssueQuickEditDialog from '/$/phoenix-open-issue/components/IssueQuickEditDialog.vue'
import type { IssueQuickEditField } from '/$/phoenix-open-issue/components/IssueQuickEditDialog.vue'
import IssueColumnSettingsDialog from '/$/phoenix-open-issue/components/IssueColumnSettingsDialog.vue'
import IssueListCell from '/$/phoenix-open-issue/components/IssueListCell.vue'
import CheckpointFormDialog from '/$/phoenix-open-issue/components/CheckpointFormDialog.vue'
import ListFormDialog from '/$/phoenix-open-issue/components/ListFormDialog.vue'
import MemberManageDialog from '/$/phoenix-open-issue/components/MemberManageDialog.vue'
import PushDialog from '/$/phoenix-open-issue/views/push/PushDialog.vue'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import PoiIssueTablePrimary from '/$/phoenix-open-issue/components/workbench/PoiIssueTablePrimary.vue'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'
import type { IssueHostCapability, ListAction } from '/$/phoenix-open-issue/core'

const route = useRoute()
const router = useRouter()
const listStore = useIssueListStore()
const issueStore = useIssueStore()
const auth = useAuthStore()
const capabilities = useIssueCapabilities()
const viewDialog = usePhoenixViewDialog()
const updateTabTitle = inject<(pageId: string, title: string) => void>('updateTabTitle', () => {})

const listId = computed(() => route.params.id as string)
const settings = useSettingsStore()
const members = ref<any[]>([])
const allUsers = ref<any[]>([])
const quickEdit = ref<{
  issueId: string
  issueTitle: string
  field: IssueQuickEditField
  value: string | number | null
} | null>(null)
const showEditList = ref(false)
const showMembers = ref(false)
const showPush = ref(false)
const pushIssueId = ref<string | null>(null)
const showColumnSettings = ref(false)
const editCheckpoint = ref<{ cp: Checkpoint; issueTitle: string } | null>(null)
const createCheckpointFor = ref<{ id: string; title: string; issueNo?: string } | null>(null)
const statusFilter = ref('')
const priorityFilter = ref('')
const severityFilter = ref('')
const categoryFilter = ref('')
const showUnwatchedOnly = ref(false) // 前端筛选：勾选后仅显示关注度为 0（不关注）的行
const searchText = ref('')
const currentPage = ref(1)
const pageSize = ref(30)
const PAGE_SIZE_OPTIONS = [30, 50, 100]
const viewMode = ref<'simple' | 'complex' | 'timeline'>((settings.defaultViewMode as 'simple' | 'complex' | 'timeline') || 'complex')
watch(viewMode, (v) => { settings.defaultViewMode = v })
const checkpointMap = ref<Record<string, Checkpoint[]>>({})
const incomingPushes = ref<any[]>([])
const showPushInbox = ref(false)
const loadedListId = ref<string | null>(null)
let refreshTask: Promise<void> | null = null

// ── 标签映射 ──
// priority / severity 是兼容字段名，产品语义分别是紧急度 / 重要度。
const statusLabel: Record<string, string> = {
  open: '待处理', in_progress: '处理中', resolved: '待验收', closed: '已完成', cancelled: '已取消',
}
type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const statusTag: Record<string, TagType | undefined> = {
  open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger',
}

const severityTag: Record<string, TagType | undefined> = {
  fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined,
}

const priorityLabel = computed<Record<string, string>>(() => Object.fromEntries(
  ISSUE_URGENCY_DICT.map(item => [
    item.value,
    dict.labelIndex[`priority:${item.value}`] || item.label,
  ]),
))
const priorityTag: Record<string, TagType | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }

// 列表详情页会被 keep-alive 缓存。全局 store 正在加载另一列表时，不能短暂显示其数据。
const currentList = computed(() => listStore.currentList?.id === listId.value ? listStore.currentList : null)

function listTabTitle(name: string) {
  return name.length > 12 ? `${name.slice(0, 12)}…` : name
}

function syncListTabTitle() {
  const name = currentList.value?.name
  if (!name || listStore.currentList?.id !== listId.value) return
  updateTabTitle(`listDetail:${listId.value}`, listTabTitle(name))
}

watch(() => currentList.value?.name, syncListTabTitle)

const myMemberRole = computed(() => {
  const uid = auth.user?.id
  if (!uid) return null
  return members.value.find(m => m.userId === uid)?.role ?? null
})
const actionCapabilities: Record<ListAction, IssueHostCapability> = {
  read: 'phoenix-open-issue:list:read',
  'manage-list': 'phoenix-open-issue:list:update',
  'delete-list': 'phoenix-open-issue:list:delete',
  'manage-members': 'phoenix-open-issue:list:update',
  'create-issue': 'phoenix-open-issue:issue:create',
  'modify-issue': 'phoenix-open-issue:issue:update',
  push: 'phoenix-open-issue:push:create',
  'handle-push': 'phoenix-open-issue:push:handle',
}
const canDo = (action: ListAction) =>
  capabilities.can(actionCapabilities[action]) &&
  canPerformListAction(
    { hostRoot: auth.isHostRoot },
    myMemberRole.value as any,
    action,
  )
const canManageMembers = computed(() => canDo('manage-members'))
const isOwner = computed(() => canManageMembers.value && (auth.isHostRoot || myMemberRole.value === 'owner'))
const canGrantOwner = computed(() => isOwner.value && capabilities.has('base:sys:user:list'))
const canEditList = computed(() => canDo('manage-list'))
const canCreateIssue = computed(() => canDo('create-issue'))
const canHandlePush = computed(() => canDo('handle-push'))

function canModifyRow(row: any) {
  return capabilities.can('phoenix-open-issue:issue:update') && Boolean(row?._canModify)
}

function canAdjustAttention(row: any) {
  return capabilities.can('phoenix-open-issue:issue:update') && Boolean(row?._canSetAttention)
}

function canPushRow(row: any) {
  return capabilities.can('phoenix-open-issue:push:create') && Boolean(row?._canPush)
}

function canCreateCheckpointFor(row: any) {
  return capabilities.can('phoenix-open-issue:checkpoint:create') && Boolean(row?._canModify)
}

function canUpdateCheckpointFor(row: any) {
  return capabilities.can('phoenix-open-issue:checkpoint:update') && Boolean(row?._canModify)
}

const primaryOwnerName = computed(() => {
  const list = currentList.value
  if (!list?.ownerId) return ''
  if (list.ownerName) return list.ownerName
  const m = members.value.find(mem => mem.userId === list.ownerId)
  if (m) return formatUserLabel(m, unknownUserLabel(m.userId))
  return userMap.value[list.ownerId] || unknownUserLabel(list.ownerId)
})

const headerSubtitle = computed(() => {
  const parts: string[] = []
  if (currentList.value?.description) parts.push(currentList.value.description)
  if (primaryOwnerName.value) parts.push(`主负责人：${primaryOwnerName.value}`)
  return parts.length ? parts.join(' · ') : undefined
})

// 用户 ID → 显示名映射
const userMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const issue of issueStore.issues) {
    if (issue.reporterId) {
      map[issue.reporterId] = issue.reporterName || unknownUserLabel(issue.reporterId)
    }
    if (issue.assigneeId) {
      map[issue.assigneeId] = issue.assigneeName || unknownUserLabel(issue.assigneeId)
    }
  }
  for (const checkpoints of Object.values(checkpointMap.value)) {
    for (const checkpoint of checkpoints) {
      if (checkpoint.responsibleUserId) {
        map[checkpoint.responsibleUserId] = checkpoint.responsibleUserName
          || unknownUserLabel(checkpoint.responsibleUserId)
      }
    }
  }
  for (const u of allUsers.value) {
    map[u.id] = formatUserLabel(u)
  }
  return map
})

async function refreshListView() {
  const targetListId = listId.value
  loadedListId.value = null
  await listStore.fetchList(targetListId)
  if (listId.value !== targetListId) return
  syncListTabTitle()
  await loadData(targetListId)
  if (listId.value === targetListId) loadedListId.value = targetListId
}

function scheduleRefreshListView() {
  if (refreshTask) return refreshTask
  refreshTask = refreshListView().finally(() => {
    refreshTask = null
  })
  return refreshTask
}

// legacy 独立 Web 使用 keep-alive，Admin 插件宿主也允许无缓存首次挂载。
onMounted(scheduleRefreshListView)
onActivated(scheduleRefreshListView)

async function loadData(targetListId = listId.value) {
  const tasks: Promise<any>[] = [loadMembers(targetListId), loadAllUsers()]
  if (capabilities.can('phoenix-open-issue:issue:read')) {
    tasks.push(issueStore.fetchIssues(targetListId, {
      sort: settings.issueSort,
    }))
  } else {
    issueStore.issues = []
    issueStore.total = 0
  }
  if (viewMode.value === 'timeline' && capabilities.can('phoenix-open-issue:checkpoint:read')) {
    tasks.push(loadCheckpoints(targetListId))
  }
  if (capabilities.can('phoenix-open-issue:push:read')) {
    tasks.push(loadIncomingPushes(targetListId))
  } else {
    incomingPushes.value = []
  }
  await Promise.all(tasks)
}

async function loadCheckpoints(targetListId = listId.value) {
  try {
    const res = await getCheckpointsByList(targetListId)
    if (listId.value === targetListId) checkpointMap.value = res.data
  } catch {
    if (listId.value === targetListId) checkpointMap.value = {}
  }
}

async function loadIncomingPushes(targetListId = listId.value) {
  try {
    const res = await getIncomingPushes(targetListId)
    if (listId.value === targetListId) {
      incomingPushes.value = res.data
      showPushInbox.value = incomingPushes.value.length > 0
    }
  } catch {
    if (listId.value === targetListId) incomingPushes.value = []
  }
}

async function onAcceptPush(recordId: string) {
  await handlePush(recordId, 'accepted')
  ElMessage.success('已接受推送，Issue 已复制到本列表')
  loadIncomingPushes()
  loadData()
}

async function onRejectPush(recordId: string) {
  try {
    const value = await pnwPromptInput('拒绝推送', '拒绝理由（可选）')
    await handlePush(recordId, 'rejected', value || undefined)
    ElMessage.success('已拒绝推送')
    loadIncomingPushes()
  } catch {
    // 用户取消
  }
}

// 获取某 Issue 的最近 N 条点检（按日期倒序）
function getRecentCheckpoints(issueId: string): Checkpoint[] {
  const maxCount = settings.maxTimelineRows
  const cps = checkpointMap.value[issueId]
  if (!cps || !cps.length) return []
  // 按 checkpointDate 倒序排列（最近的在前）
  const sorted = [...cps].sort((a, b) => b.checkpointDate.localeCompare(a.checkpointDate))
  return sorted.slice(0, maxCount)
}

async function loadMembers(targetListId = listId.value) {
  const res = await getMembers(targetListId)
  if (listId.value === targetListId) members.value = res.data
}

async function loadAllUsers() {
  if (!capabilities.has('base:sys:user:list')) {
    allUsers.value = []
    return
  }
  const res = await getAllUsers({ includeDisabled: true })
  allUsers.value = res.data
}

// 表单下拉选择时排除已禁用用户
const activeUsers = computed(() => allUsers.value.filter((u: any) => !u.disabled))

watch(viewMode, (mode) => {
  if (mode === 'timeline') loadCheckpoints()
})

// Issue 全量加载后，搜索、筛选和分页均在前端完成。
const filteredIssues = computed(() => {
  if (loadedListId.value !== listId.value) return []
  let list = issueStore.issues

  const keyword = searchText.value.trim().toLocaleLowerCase()
  if (keyword) {
    list = list.filter(issue => [issue.issueNo, issue.title, issue.description]
      .some(value => value?.toLocaleLowerCase().includes(keyword)))
  }
  if (showUnwatchedOnly.value) {
    list = list.filter(row => linkAttention(row) === 0)
  } else {
    list = list.filter(row => linkAttention(row) !== 0)
  }
  if (statusFilter.value) {
    list = list.filter(i => i.status === statusFilter.value)
  }
  if (priorityFilter.value) {
    list = list.filter(i => i.priority === priorityFilter.value)
  }
  if (severityFilter.value) {
    list = list.filter(i => i.severity === severityFilter.value)
  }
  if (categoryFilter.value) {
    list = list.filter(i => i.category === categoryFilter.value)
  }
  return list
})

const paginatedIssues = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredIssues.value.slice(start, start + pageSize.value)
})

const hasActiveFilters = computed(() => Boolean(
  searchText.value.trim()
  || statusFilter.value
  || priorityFilter.value
  || severityFilter.value
  || categoryFilter.value
  || showUnwatchedOnly.value,
))

watch(
  [searchText, statusFilter, priorityFilter, severityFilter, categoryFilter, showUnwatchedOnly, pageSize],
  () => { currentPage.value = 1 },
)

watch(() => filteredIssues.value.length, (total) => {
  const lastPage = Math.max(1, Math.ceil(total / pageSize.value))
  if (currentPage.value > lastPage) currentPage.value = lastPage
})

watch(listId, () => { currentPage.value = 1 })

function clearFilters() {
  searchText.value = ''
  statusFilter.value = ''
  priorityFilter.value = ''
  severityFilter.value = ''
  categoryFilter.value = ''
  showUnwatchedOnly.value = false
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiIssueTablePrimary,
    props: computed(() => ({
      viewKey: `phoenix-open-issue-list-detail:${listId.value}`,
      searchText: searchText.value,
      showUnwatchedOnly: showUnwatchedOnly.value,
      status: statusFilter.value,
      priority: priorityFilter.value,
      severity: severityFilter.value,
      category: categoryFilter.value,
      statusOptions: Object.entries(statusLabel).map(([value, label]) => ({ value, label })),
      priorityOptions: dict.getOptions('priority').length ? dict.getOptions('priority') : ISSUE_URGENCY_DICT,
      severityOptions: dict.getOptions('severity'),
      categoryOptions: dict.getOptions('issueCategory'),
      hasActiveFilters: hasActiveFilters.value,
      viewMode: viewMode.value,
      maxTimelineRows: settings.maxTimelineRows,
      checkpointYearThresholdMonths: settings.cpYearThresholdMonths,
      onUpdateSearch: (value: string) => { searchText.value = value },
      onUpdateUnwatched: (value: string | number | boolean) => { showUnwatchedOnly.value = Boolean(value) },
      onUpdateStatus: (value: string) => { statusFilter.value = value },
      onUpdatePriority: (value: string) => { priorityFilter.value = value },
      onUpdateSeverity: (value: string) => { severityFilter.value = value },
      onUpdateCategory: (value: string) => { categoryFilter.value = value },
      onUpdateViewMode: (value: 'simple' | 'complex' | 'timeline') => { viewMode.value = value },
      onUpdateMaxTimelineRows: (value: number) => { settings.maxTimelineRows = value },
      onUpdateCheckpointYearThreshold: (value: number) => { settings.cpYearThresholdMonths = value },
      onOpenColumnSettings: () => { showColumnSettings.value = true },
      onClear: clearFilters,
    })),
  },
})

function goIssueDetail(id: string) {
  void router.push(`/open-issue/issue/${id}`)
}

function openViewIssue(row: { id: string }, e?: Event) {
  e?.stopPropagation()
  goIssueDetail(row.id)
}

async function openEditIssue(row: any, e?: Event) {
  e?.stopPropagation()
  if (!canModifyRow(row)) return
  const outcome = await viewDialog.open<IssueFormDialogProps, IssueFormDialogResult>({
    rendererId: ISSUE_FORM_DIALOG_RENDERER_ID,
    instanceKey: `edit:${row.id}`,
    title: '编辑 Issue',
    props: {
      allUsers: issueFormDialogUsers(activeUsers.value),
      initial: issueFormDialogInitial(row),
    },
    size: ISSUE_FORM_DIALOG_SIZE,
  })
  if (outcome.status === 'failed') {
    ElMessage.error(`打开 Issue 编辑器失败：${outcome.message}`)
    return
  }
  if (outcome.status === 'submitted') await onEditIssue(row, outcome.value)
}

function openQuickEdit(row: any, field: IssueQuickEditField, e?: Event) {
  e?.stopPropagation()
  if (field === 'attention' ? !canAdjustAttention(row) : !canModifyRow(row)) return
  let value: string | number | null
  switch (field) {
    case 'attention':
      value = linkAttention(row)
      break
    case 'assignee':
      value = row.assigneeId ?? null
      break
    case 'function':
      value = row.functionId ?? null
      break
    default:
      value = row[field] ?? null
  }
  quickEdit.value = { issueId: row.id, issueTitle: row.title, field, value }
}

async function onEditIssue(row: any, data: IssueFormDialogResult) {
  const { attentionLevel, ...issueData } = data
  await issueStore.updateIssue(row.id, issueData)
  if (attentionLevel !== undefined && attentionLevel !== linkAttention(row)) {
    await issueStore.setAttentionLevel(listId.value, row.id, attentionLevel)
  }
  loadData()
}

async function onQuickEditConfirm(value: string | number | null) {
  if (!quickEdit.value) return
  const { issueId, field } = quickEdit.value
  if (field === 'status') {
    await issueStore.updateStatus(issueId, value as string)
  } else if (field === 'attention') {
    await issueStore.setAttentionLevel(listId.value, issueId, value as number)
  } else {
    const patch: Record<string, any> = {}
    if (field === 'assignee') patch.assigneeId = value
    else if (field === 'function') patch.functionId = value
    else if (field === 'category') patch.category = value
    else if (field === 'detectionPhase') patch.detectionPhase = value
    else patch[field] = value
    await issueStore.updateIssue(issueId, patch)
  }
  quickEdit.value = null
  loadData()
}

function openEditCheckpoint(cp: Checkpoint, issueTitle: string, e?: Event) {
  e?.stopPropagation()
  if (!canUpdateCheckpointFor(issueStore.issues.find(issue => issue.id === cp.issueId))) return
  editCheckpoint.value = { cp, issueTitle }
}

function openCreateCheckpoint(row: { id: string; title: string; issueNo?: string }, e?: Event) {
  e?.stopPropagation()
  if (!canCreateCheckpointFor(row)) return
  createCheckpointFor.value = { id: row.id, title: row.title, issueNo: row.issueNo }
}

async function onCreateCheckpoint(data: {
  checkpointDate: string
  deadline: string | null
  description: string
  responsibleUserId?: string
}) {
  if (!createCheckpointFor.value || !capabilities.can('phoenix-open-issue:checkpoint:create')) return
  await createCheckpoint(createCheckpointFor.value.id, data)
  createCheckpointFor.value = null
  ElMessage.success('点检项已添加')
  await loadCheckpoints()
}

async function onEditCheckpoint(data: {
  checkpointDate: string
  deadline: string | null
  description: string
  responsibleUserId?: string
  status?: Checkpoint['status']
}) {
  if (!editCheckpoint.value || !capabilities.can('phoenix-open-issue:checkpoint:update')) return
  await updateCheckpoint(editCheckpoint.value.cp.id, data)
  editCheckpoint.value = null
  ElMessage.success('点检已更新')
  await loadCheckpoints()
}

async function onUpdateCheckpointStatus(cp: Checkpoint, status: Checkpoint['status']) {
  if (!canUpdateCheckpointFor(issueStore.issues.find(issue => issue.id === cp.issueId))) return
  if (cp.status === status) return
  await updateCheckpoint(cp.id, { status })
  ElMessage.success('点检状态已更新')
  await loadCheckpoints()
}

async function onCreateIssue(data: any) {
  if (!canCreateIssue.value) return
  await issueStore.createIssue(listId.value, data)
  ElMessage.success('Issue 创建成功')
  loadData()
}

async function openCreateIssue() {
  if (!canCreateIssue.value) return
  const outcome = await viewDialog.open<IssueFormDialogProps, IssueFormDialogResult>({
    rendererId: ISSUE_FORM_DIALOG_RENDERER_ID,
    instanceKey: `create:${listId.value}`,
    title: '新建 Issue',
    props: {
      allUsers: issueFormDialogUsers(activeUsers.value),
    },
    size: ISSUE_FORM_DIALOG_SIZE,
  })
  if (outcome.status === 'failed') {
    ElMessage.error(`打开 Issue 编辑器失败：${outcome.message}`)
    return
  }
  if (outcome.status === 'submitted') await onCreateIssue(outcome.value)
}

async function onEditList(data: { name: string; listType: string; description?: string; ownerId?: string }) {
  if (!canEditList.value) return
  await listStore.updateList(listId.value, data)
  showEditList.value = false
  ElMessage.success('列表已更新')
  syncListTabTitle()
}

function onPushIssue(row: any) {
  if (!canPushRow(row)) return
  pushIssueId.value = row.id
  showPush.value = true
}

async function onVoidIssue(id: string, title: string) {
  const row = issueStore.issues.find(issue => issue.id === id)
  if (!canAdjustAttention(row)) return
  const r = await pnwPromptChoice({
    title: '设为不关注',
    message: `在本列表将 Issue「${title}」设为不关注？（其他列表不受影响，数据保留）`,
    choices: [{ id: 'void', label: '不关注', variant: 'danger' }, { id: 'cancel', label: '取消' }],
  })
  if (r.choiceId !== 'void') return
  await issueStore.setAttentionLevel(listId.value, id, 0)
  loadData()
}

async function onRestoreAttention(id: string) {
  const row = issueStore.issues.find(issue => issue.id === id)
  if (!canAdjustAttention(row)) return
  await issueStore.setAttentionLevel(listId.value, id, DEFAULT_ATTENTION_LEVEL)
  loadData()
}

function linkAttention(row: Record<string, unknown>): number {
  return typeof row._attentionLevel === 'number' ? row._attentionLevel : DEFAULT_ATTENTION_LEVEL
}

function isUnwatched(row: Record<string, unknown>) {
  return linkAttention(row) === 0
}

function isPushedIssue(row: { listId: string }) {
  return row.listId !== listId.value
}

function issueOriginTip(row: { originListName?: string | null }) {
  return row.originListName ? `推送自：${row.originListName}` : '推送 Issue'
}

async function onAddMember(userId: string, role: string) {
  await addMember(listId.value, userId, role)
  ElMessage.success('成员已添加')
  loadMembers()
}

async function onRemoveMember(userId: string) {
  try {
    await removeMember(listId.value, userId)
    ElMessage.success('成员已移除')
    await loadMembers()
    listStore.fetchList(listId.value)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.response?.data?.error || '移除失败')
  }
}

async function onUpdateMemberRole(userId: string, role: string) {
  try {
    await updateMemberRole(listId.value, userId, role)
    ElMessage.success('权限已更新')
    await loadMembers()
    listStore.fetchList(listId.value)
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || e?.response?.data?.error || '更新失败')
    loadMembers()
  }
}

async function onTransferOwner(userId: string) {
  const target = members.value.find(m => m.userId === userId)
  const name = target
    ? formatUserLabel(target, unknownUserLabel(userId))
    : unknownUserLabel(userId)
  const r = await pnwPromptChoice({
    title: '设为主负责人',
    message: `将主负责人设为「${name}」？\n仅变更列表展示与推送审批负责人，不改动各成员的权限级别。`,
    choices: [
      { id: 'transfer', label: '确认', variant: 'primary' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'transfer') return
  await transferOwner(listId.value, userId)
  ElMessage.success('主负责人已更新')
  loadMembers()
  listStore.fetchList(listId.value)
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}

// 最近点检的点检日格式化：同年或差距 < 阈值月数 → MM-DD，否则 → YYYY-MM-DD
function formatCpDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const now = new Date()
  const thisYear = now.getFullYear()
  const threshold = settings.cpYearThresholdMonths
  // -1 = 永不简化，始终显示完整日期
  if (threshold === -1) return dateStr.slice(0, 10)
  const thresholdMs = threshold * 30.44 * 24 * 60 * 60 * 1000
  if (d.getFullYear() === thisYear || Math.abs(d.getTime() - now.getTime()) < thresholdMs) {
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    return `${mm}-${dd}`
  }
  return dateStr.slice(0, 10)
}

function onColResize(newWidth: number, _old: number, col: any) {
  if (col.props?.label) {
    const key = col.props.label
    settings.colWidths[key] = newWidth
  }
}

// sort-change: 用户点击表头排序
function onSortChange({ prop, order }: { prop: string; order: 'ascending' | 'descending' | null }) {
  if (order) {
    settings.issueSort = `${prop}:${order === 'ascending' ? 'asc' : 'desc'}`
  } else {
    settings.issueSort = DEFAULT_ISSUE_SORT
  }
  loadData()
}

const defaultSort = computed(() => {
  const { field, dir } = primaryIssueSort(settings.issueSort)
  return { prop: field, order: dir === 'asc' ? 'ascending' as const : 'descending' as const }
})

const visibleColumns = computed(() =>
  visibleColumnsForMode(viewMode.value, settings.issueListColumns),
)

function columnWidth(key: IssueColumnKey): number {
  return settings.colWidths[columnLabel(key)] || ISSUE_COLUMN_WIDTH_DEFAULTS[key]
}

function isColumnSortable(key: IssueColumnKey): boolean {
  return SORTABLE_ISSUE_COLUMNS.has(key)
}

function onColumnSettingsConfirm(cols: IssueListColumnSettings) {
  settings.setIssueListColumns(cols)
  showColumnSettings.value = false
}

provide('issueListCellCtx', reactive({
  dict,
  userMap,
  severityTag,
  get priorityLabel() { return priorityLabel.value },
  priorityTag,
  statusLabel,
  statusTag,
  linkAttention,
  formatDate,
  formatCpDate,
  getRecentCheckpoints,
  checkpointMap,
  get maxTimelineRows() { return settings.maxTimelineRows },
  canModifyRow,
  canAdjustAttention,
  openViewIssue,
  openQuickEdit,
  openEditCheckpoint,
  openCreateCheckpoint,
  onUpdateCheckpointStatus,
}))
</script>

<template>
  <PoiCompactEditorView
    :title="currentList?.name || '列表详情'"
    content-aria-label="Open Issue 列表详情"
  >
    <template #actions>
      <el-button @click="showMembers = true" data-tour="list-members"><el-icon><User /></el-icon> 成员 ({{ members.length }})</el-button>
      <el-button v-if="canEditList" @click="showEditList = true" data-tour="list-edit"><el-icon><Edit /></el-icon> 编辑</el-button>
      <el-button v-if="canCreateIssue" type="primary" @click="openCreateIssue" data-tour="list-create-issue"><el-icon><Plus /></el-icon> 新建 Issue</el-button>
    </template>
    <template #help><PageHelpButton page-id="listDetail" /></template>

    <el-alert
      v-if="headerSubtitle"
      :title="headerSubtitle"
      type="info"
      :closable="false"
      class="list-context-note"
    />

    <el-alert
      v-if="!capabilities.can('phoenix-open-issue:issue:read')"
      title="当前 Cool 角色可查看列表，但未授予 Issue 读取权限"
      type="warning"
      :closable="false"
      show-icon
      class="permission-note"
    />

    <!-- 推送收件箱 -->
    <el-alert
      v-if="showPushInbox"
      :title="`收到 ${incomingPushes.length} 条推送待审批`"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom:12px"
      data-tour="list-push-inbox"
    >
      <template #default>
        <div class="push-inbox">
          <div v-for="pr in incomingPushes" :key="pr.id" class="push-inbox-item">
            <span class="push-inbox-info">
              📤 <strong>{{ pr.fromListName }}</strong>
              → 📋 <strong>{{ pr.issueTitle }}</strong>
              <span class="push-inbox-meta">{{ new Date(pr.pushedAt).toLocaleString('zh-CN') }}</span>
            </span>
            <span v-if="canHandlePush" class="push-inbox-actions">
              <el-button size="small" type="success" @click.stop="onAcceptPush(pr.id)">接受</el-button>
              <el-button size="small" type="danger" @click.stop="onRejectPush(pr.id)">拒绝</el-button>
            </span>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- Issue 表格（汽车行业 Open Issue 标准列） -->
    <el-table
      :data="paginatedIssues"
      v-loading="issueStore.loading"
      stripe border
      size="small"
      :default-sort="defaultSort"
      @sort-change="onSortChange"
      @header-dragend="onColResize"
      highlight-current-row
      data-tour="list-table"
      :row-class-name="(row: any) => {
        const lv = linkAttention(row)
        if (lv === 0) return 'row-unwatched'
        if (lv >= 4) return 'row-attention-high'
        return ''
      }"
    >
      <el-table-column label="#" width="45" align="center" fixed="left">
        <template #default="{ row, $index }">
          <el-tooltip :content="issueOriginTip(row)" :disabled="!isPushedIssue(row)" placement="top">
            <span class="issue-row-index" :class="{ 'is-pushed': isPushedIssue(row) }">{{ (currentPage - 1) * pageSize + $index + 1 }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip fixed="left" sortable="custom">
        <template #default="{ row }">
          <div class="issue-title-cell">
            <span class="cell-link issue-title-text" title="点击查看" @click="openViewIssue(row, $event)">{{ row.title }}</span>
            <el-tooltip
              v-if="Number(row.listCount) >= 2"
              :content="`当前关联 ${row.listCount} 个点检表`"
              placement="top"
            >
              <span class="issue-list-count" :aria-label="`关联 ${row.listCount} 个点检表`">关联 {{ row.listCount }}</span>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column
        v-for="colKey in visibleColumns"
        :key="colKey"
        :prop="colKey === 'checkpoints' ? undefined : colKey"
        :label="columnLabel(colKey)"
        :width="colKey === 'checkpoints' ? undefined : columnWidth(colKey)"
        :min-width="colKey === 'checkpoints' ? columnWidth(colKey) : undefined"
        :fixed="colKey === 'checkpoints' ? 'right' : undefined"
        resizable
        :sortable="isColumnSortable(colKey) ? 'custom' : false"
        :align="['severity', 'priority', 'attention', 'status', 'createdAt'].includes(colKey) ? 'center' : undefined"
        :show-overflow-tooltip="colKey === 'function'"
      >
        <template #default="{ row }">
          <IssueListCell :column-key="colKey" :row="row" />
        </template>
      </el-table-column>

      <el-table-column label="操作" width="140" fixed="right" align="center">
        <template #default="{ row }">
          <div class="row-actions">
            <el-button class="row-action-btn" plain circle type="primary" size="small" aria-label="查看详情" @click.stop="goIssueDetail(row.id)" title="查看详情">
              <el-icon><Search /></el-icon>
            </el-button>
            <el-button v-if="canModifyRow(row)" class="row-action-btn" plain circle type="primary" size="small" aria-label="编辑" @click.stop="openEditIssue(row)" title="编辑">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button v-if="canPushRow(row)" class="row-action-btn" plain circle type="warning" size="small" aria-label="推送到其他列表" @click.stop="onPushIssue(row)" title="推送到其他列表">
              <el-icon><Promotion /></el-icon>
            </el-button>
            <el-dropdown
              v-if="canCreateCheckpointFor(row) || canAdjustAttention(row)"
              @command="(cmd: string) => {
                if (cmd === 'void') onVoidIssue(row.id, row.title)
                else if (cmd === 'unvoid') onRestoreAttention(row.id)
                else if (cmd === 'checkpoint') openCreateCheckpoint(row)
              }"
              size="small"
              trigger="click"
            >
              <el-button class="row-action-btn" plain circle type="info" size="small" aria-label="更多操作" @click.stop title="更多操作">
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-if="canCreateCheckpointFor(row)" command="checkpoint">添加点检</el-dropdown-item>
                  <template v-if="canAdjustAttention(row) && isUnwatched(row)">
                    <el-dropdown-item command="unvoid" class="attention-restore-action">🔄 恢复默认(三星)</el-dropdown-item>
                  </template>
                  <template v-else-if="canAdjustAttention(row)">
                    <el-dropdown-item command="void" class="attention-disable-action">⊘ 设为不关注</el-dropdown-item>
                  </template>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无 Issue" /></template>
    </el-table>

    <div class="pagination-bar" data-tour="list-pagination">
      <span class="pagination-summary">
        当前 {{ filteredIssues.length }} 条<span v-if="filteredIssues.length !== issueStore.issues.length"> / 共 {{ issueStore.issues.length }} 条</span>
      </span>
      <el-pagination
        v-if="filteredIssues.length > PAGE_SIZE_OPTIONS[0]"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="PAGE_SIZE_OPTIONS"
        :total="filteredIssues.length"
        layout="sizes, prev, pager, next"
        background
        small
      />
    </div>

    <IssueQuickEditDialog
      v-if="quickEdit"
      :field="quickEdit.field"
      :issue-title="quickEdit.issueTitle"
      :value="quickEdit.value"
      :users="activeUsers"
      @confirm="onQuickEditConfirm"
      @close="quickEdit = null"
    />
    <IssueColumnSettingsDialog
      v-if="showColumnSettings"
      :mode="viewMode"
      :settings="settings.issueListColumns"
      @confirm="onColumnSettingsConfirm"
      @close="showColumnSettings = false"
    />
    <CheckpointFormDialog
      v-if="editCheckpoint"
      :users="activeUsers"
      :initial="editCheckpoint.cp"
      :issue-title="editCheckpoint.issueTitle"
      @confirm="onEditCheckpoint"
      @close="editCheckpoint = null"
    />
    <CheckpointFormDialog
      v-if="createCheckpointFor"
      :users="activeUsers"
      :issue-title="createCheckpointFor.title"
      :issue-no="createCheckpointFor.issueNo"
      @confirm="onCreateCheckpoint"
      @close="createCheckpointFor = null"
    />
    <ListFormDialog
      v-if="showEditList && currentList"
      :initial="{
        name: currentList.name,
        description: currentList.description || '',
        listType: currentList.listType,
        ownerId: currentList.ownerId,
      }"
      :can-edit-owner="canGrantOwner"
      @confirm="onEditList"
      @close="showEditList = false"
    />
    <MemberManageDialog
      v-if="showMembers"
      :members="members"
      :all-users="activeUsers"
      :primary-owner-id="currentList?.ownerId"
      :current-user-id="auth.user?.id"
      :can-manage="canManageMembers"
      :can-grant-owner="canGrantOwner"
      :is-owner="isOwner"
      @add="onAddMember"
      @remove="onRemoveMember"
      @update-role="onUpdateMemberRole"
      @transfer-owner="onTransferOwner"
      @close="showMembers = false"
    />
    <PushDialog v-if="showPush" :list-id="listId" :preselected-issue-ids="pushIssueId ? [pushIssueId] : []" @close="showPush = false; pushIssueId = null" />

  </PoiCompactEditorView>
</template>

<style scoped>
.list-context-note,
.permission-note { margin-bottom: 12px; }
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  margin-top: 12px;
}
.pagination-summary {
  color: var(--el-text-color-secondary, #909399);
  font-size: 0.8rem;
  white-space: nowrap;
}
.cell-link {
  cursor: pointer;
  border-radius: 2px;
}
.cell-link:hover {
  color: var(--el-color-primary, #409eff);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.issue-title-cell {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: 6px;
  min-width: 0;
  min-height: 26px;
  padding-right: 4px;
  width: 100%;
}
.issue-title-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.issue-list-count {
  align-self: end;
  padding: 0 4px;
  border: 1px solid var(--el-color-primary-light-5, #79bbff);
  border-radius: 999px;
  background: var(--el-color-primary-light-9, #ecf5ff);
  color: var(--el-color-primary, #409eff);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  line-height: 13px;
  white-space: nowrap;
}
.issue-row-index {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 5px;
  color: var(--el-text-color-regular, #606266);
  font-variant-numeric: tabular-nums;
}
.issue-row-index.is-pushed {
  position: relative;
  background: var(--el-color-primary-light-9, #ecf5ff);
  border: 2px solid var(--el-color-primary, #409eff);
  box-shadow: inset 3px 0 0 var(--el-color-primary, #409eff), 0 0 0 1px var(--el-color-primary-light-5, #79bbff);
  color: var(--el-color-primary, #409eff);
  font-weight: 700;
}
.issue-row-index.is-pushed::after {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 8px;
  height: 8px;
  content: '';
  background: var(--el-color-primary, #409eff);
  border: 2px solid var(--el-bg-color, #fff);
  border-radius: 50%;
}
.row-actions {
  display: inline-grid;
  grid-auto-flow: column;
  grid-auto-columns: 28px;
  align-items: center;
  gap: 4px;
  padding: 0 2px;
}
.row-action-btn { width: 28px; height: 28px; margin: 0; padding: 0; }

/* ── 推送收件箱 ── */
.push-inbox {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 4px;
}
.push-inbox-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
.push-inbox-info {
  font-size: 0.85rem;
}
.push-inbox-meta {
  color: var(--el-text-color-secondary, #909399);
  font-size: 0.75rem;
  margin-left: 12px;
}
.push-inbox-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

/* 不关注行 */
:deep(.row-unwatched) { opacity: 0.45; background: var(--el-fill-color-lighter, #fafafa); }
:deep(.row-attention-high) { background: var(--el-color-warning-light-9, #fdf6ec); }
.attention-restore-action { color: var(--el-color-success, #67c23a); }
.attention-disable-action { color: var(--el-color-warning, #e6a23c); }

</style>
