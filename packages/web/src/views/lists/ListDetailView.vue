<script setup lang="ts">
import { onActivated, ref, watch, computed, provide, reactive, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { useIssueStore } from '@/stores/issues'
import { useSettingsStore } from '@/stores/settings'
import { useDictStore } from '@/stores/dict'
import {
  visibleColumnsForMode,
  columnLabel,
  ISSUE_COLUMN_WIDTH_DEFAULTS,
  SORTABLE_ISSUE_COLUMNS,
  DEFAULT_ISSUE_SORT,
  primaryIssueSort,
  type IssueColumnKey,
  type IssueListColumnSettings,
} from '@/config/issueListColumns'

const dict = useDictStore()
import { getMembers, addMember, removeMember, transferOwner, updateMemberRole } from '@/api/issueLists'
import { getAllUsers } from '@/api/auth'
import { createCheckpoint, getCheckpointsByList, updateCheckpoint } from '@/api/checkpoints'
import { getIncomingPushes, handlePush } from '@/api/push'
import { ElMessage } from 'element-plus';
import { pnwPromptChoice, pnwPromptInput, pnwPropGroup, pnwPropEnum, pnwPropBool, pnwPropSheet } from 'phoenix-wing'
import PnwAppModalOverlay from 'phoenix-wing/components/PnwAppModalOverlay.vue'
import PnwSidebarBlock from 'phoenix-wing/layout/PnwSidebarBlock.vue'
import IssueDetailView from '@/views/issues/IssueDetailView.vue'

const showIssueModal = ref(false)
const modalIssueId = ref('')
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import { canAddMemberAsUser, canManageList, canTransferPrimaryOwnerAsUser, isSystemAdmin, DEFAULT_ATTENTION_LEVEL } from '@open-issue/core'
import type { Checkpoint } from '@open-issue/core'
import IssueFormDialog from '@/components/IssueFormDialog.vue'
import IssueQuickEditDialog from '@/components/IssueQuickEditDialog.vue'
import type { IssueQuickEditField } from '@/components/IssueQuickEditDialog.vue'
import IssueColumnSettingsDialog from '@/components/IssueColumnSettingsDialog.vue'
import IssueListCell from '@/components/IssueListCell.vue'
import CheckpointFormDialog from '@/components/CheckpointFormDialog.vue'
import ListFormDialog from '@/components/ListFormDialog.vue'
import MemberManageDialog from '@/components/MemberManageDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const listStore = useIssueListStore()
const issueStore = useIssueStore()
const auth = useAuthStore()
const updateTabTitle = inject<(pageId: string, title: string) => void>('updateTabTitle', () => {})

const listId = computed(() => route.params.id as string)
const settings = useSettingsStore()
const members = ref<any[]>([])
const allUsers = ref<any[]>([])
const showCreateIssue = ref(false)
const showEditIssue = ref(false)
const editIssueRow = ref<any | null>(null)
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
const severityFilter = ref('')
const categoryFilter = ref('')
const showUnwatchedOnly = ref(false) // 前端筛选：勾选后仅显示关注度为 0（不关注）的行
const searchText = ref('')
const viewMode = ref<'simple' | 'complex' | 'timeline'>((settings.defaultViewMode as 'simple' | 'complex' | 'timeline') || 'complex')
watch(viewMode, (v) => { settings.defaultViewMode = v })
const checkpointMap = ref<Record<string, Checkpoint[]>>({})
const incomingPushes = ref<any[]>([])
const showPushInbox = ref(false)
const loadedListId = ref<string | null>(null)

// ── 标签映射（汽车行业标准） ──
const statusLabel: Record<string, string> = {
  open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭', cancelled: '已取消',
}
const statusTag: Record<string, string | undefined> = {
  open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger',
}

const severityTag: Record<string, string | undefined> = {
  fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined,
}

const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }
const priorityTag: Record<string, string | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }

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
const isSysAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))
const canManageMembers = computed(() => canAddMemberAsUser(myMemberRole.value as any, auth.user ?? undefined))
const canGrantOwner = computed(() => isSysAdmin.value || myMemberRole.value === 'owner' || myMemberRole.value === 'admin')
const isOwner = computed(() => canTransferPrimaryOwnerAsUser(myMemberRole.value as any, auth.user ?? undefined))
const canEditList = computed(() => {
  if (isSysAdmin.value) return true
  return canManageList(myMemberRole.value as any)
})

const primaryOwnerName = computed(() => {
  const list = currentList.value
  if (!list?.ownerId) return ''
  if (list.ownerName) return list.ownerName
  const m = members.value.find(mem => mem.userId === list.ownerId)
  if (m) return m.displayName || m.username
  return userMap.value[list.ownerId] || ''
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
  for (const u of allUsers.value) {
    map[u.id] = u.displayName || u.username
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

onActivated(refreshListView)

async function loadData(targetListId = listId.value) {
  const tasks: Promise<any>[] = [
    issueStore.fetchIssues(targetListId, {
      status: statusFilter.value || undefined,
      search: searchText.value || undefined,
      sort: settings.issueSort,
    }),
    loadMembers(targetListId),
    loadAllUsers(),
  ]
  if (viewMode.value === 'timeline') {
    tasks.push(loadCheckpoints(targetListId))
  }
  tasks.push(loadIncomingPushes(targetListId))
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
  const res = await getAllUsers({ includeDisabled: true })
  allUsers.value = res.data
}

// 表单下拉选择时排除已禁用用户
const activeUsers = computed(() => allUsers.value.filter((u: any) => !u.disabled))

watch([statusFilter, searchText], () => loadData())
watch(viewMode, (mode) => {
  if (mode === 'timeline') loadCheckpoints()
})

// 前端筛选（severity / category / 不关注）
const filteredIssues = computed(() => {
  if (loadedListId.value !== listId.value) return []
  let list = issueStore.issues
  if (showUnwatchedOnly.value) {
    list = list.filter(row => linkAttention(row) === 0)
  } else {
    list = list.filter(row => linkAttention(row) !== 0)
  }
  if (severityFilter.value) {
    list = list.filter(i => i.severity === severityFilter.value)
  }
  if (categoryFilter.value) {
    list = list.filter(i => i.category === categoryFilter.value)
  }
  return list
})

function goIssueDetail(id: string) { modalIssueId.value = id; showIssueModal.value = true }

function openViewIssue(row: { id: string }, e?: Event) {
  e?.stopPropagation()
  goIssueDetail(row.id)
}

function openEditIssue(row: any, e?: Event) {
  e?.stopPropagation()
  editIssueRow.value = row
  showEditIssue.value = true
}

function openQuickEdit(row: any, field: IssueQuickEditField, e?: Event) {
  e?.stopPropagation()
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

async function onEditIssue(data: any) {
  if (!editIssueRow.value) return
  const { attentionLevel, ...issueData } = data
  await issueStore.updateIssue(editIssueRow.value.id, issueData)
  if (attentionLevel !== undefined && attentionLevel !== linkAttention(editIssueRow.value)) {
    await issueStore.setAttentionLevel(listId.value, editIssueRow.value.id, attentionLevel)
  }
  showEditIssue.value = false
  editIssueRow.value = null
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
  editCheckpoint.value = { cp, issueTitle }
}

function openCreateCheckpoint(row: { id: string; title: string; issueNo?: string }, e?: Event) {
  e?.stopPropagation()
  createCheckpointFor.value = { id: row.id, title: row.title, issueNo: row.issueNo }
}

async function onCreateCheckpoint(data: {
  checkpointDate: string
  description: string
  responsibleUserId?: string
}) {
  if (!createCheckpointFor.value) return
  await createCheckpoint(createCheckpointFor.value.id, data)
  createCheckpointFor.value = null
  ElMessage.success('点检项已添加')
  await loadCheckpoints()
}

async function onEditCheckpoint(data: {
  checkpointDate: string
  description: string
  responsibleUserId?: string
  status?: Checkpoint['status']
}) {
  if (!editCheckpoint.value) return
  await updateCheckpoint(editCheckpoint.value.cp.id, data)
  editCheckpoint.value = null
  ElMessage.success('点检已更新')
  await loadCheckpoints()
}

async function onUpdateCheckpointStatus(cp: Checkpoint, status: Checkpoint['status']) {
  if (cp.status === status) return
  await updateCheckpoint(cp.id, { status })
  ElMessage.success('点检状态已更新')
  await loadCheckpoints()
}

async function onCheckpointCreated() {
  if (viewMode.value === 'timeline') await loadCheckpoints()
}

async function onCreateIssue(data: any) {
  await issueStore.createIssue(listId.value, data)
  showCreateIssue.value = false
  ElMessage.success('Issue 创建成功')
  loadData()
}

async function onEditList(data: { name: string; listType: string; description?: string; ownerId?: string }) {
  await listStore.updateList(listId.value, data)
  showEditList.value = false
  ElMessage.success('列表已更新')
  syncListTabTitle()
}

function onPushIssue(issueId: string) {
  pushIssueId.value = issueId
  showPush.value = true
}

async function onVoidIssue(id: string, title: string) {
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
  const name = target?.displayName || target?.username || '该用户'
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

// 点检日期格式化：同年或差距 < 阈值月数 → MM-DD，否则 → YYYY-MM-DD
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
  priorityLabel,
  priorityTag,
  statusLabel,
  statusTag,
  linkAttention,
  formatDate,
  formatCpDate,
  getRecentCheckpoints,
  checkpointMap,
  get maxTimelineRows() { return settings.maxTimelineRows },
  openViewIssue,
  openQuickEdit,
  openEditCheckpoint,
  openCreateCheckpoint,
  onUpdateCheckpointStatus,
}))
</script>

<template>
  <div class="page">
    <PnwPageHeader :title="currentList?.name || '列表详情'" :subtitle="headerSubtitle">
      <template #actions>
        <el-button @click="showMembers = true" data-tour="list-members"><el-icon><User /></el-icon> 成员 ({{ members.length }})</el-button>
        <el-button v-if="canEditList" @click="showEditList = true" data-tour="list-edit"><el-icon><Edit /></el-icon> 编辑</el-button>
        <el-button type="primary" @click="showCreateIssue = true" data-tour="list-create-issue"><el-icon><Plus /></el-icon> 新建 Issue</el-button>
      </template>
      <template #help><PageHelpButton page-id="listDetail" /></template>
    </PnwPageHeader>

    <!-- 筛选栏 -->
    <div class="filters" data-tour="list-filters">
      <el-input v-model="searchText" placeholder="搜索标题/描述..." clearable style="width:200px" size="small" />
      <el-checkbox v-model="showUnwatchedOnly" size="small" style="margin-left:4px">只显示【不关注】</el-checkbox>
      <el-select v-model="statusFilter" placeholder="状态" clearable size="small" style="width:110px">
        <el-option v-for="(l, v) in statusLabel" :key="v" :label="l" :value="v" />
      </el-select>
      <el-select v-model="severityFilter" placeholder="严重度" clearable size="small" style="width:100px">
        <el-option v-for="o in dict.getOptions('severity')" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="categoryFilter" placeholder="分类" clearable size="small" style="width:100px">
        <el-option v-for="o in dict.getOptions('issueCategory')" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <span v-if="viewMode === 'timeline'" style="font-size:0.8rem;color:#909399;display:inline-flex;align-items:center;gap:4px">
        显示最近
        <el-select :model-value="settings.maxTimelineRows" @update:model-value="settings.maxTimelineRows = $event" size="small" style="width:65px">
          <el-option v-for="n in [1,2,3,4,5,6,7,8,9,10]" :key="n" :label="String(n)" :value="n" />
        </el-select>
        条 · 日期简化
        <el-select :model-value="settings.cpYearThresholdMonths" @update:model-value="settings.cpYearThresholdMonths = $event" size="small" style="width:70px">
          <el-option :label="'当月'" :value="0" />
          <el-option :label="'2个月'" :value="2" />
          <el-option :label="'3个月'" :value="3" />
          <el-option :label="'半年'" :value="6" />
          <el-option :label="'全年'" :value="12" />
          <el-option :label="'不简化'" :value="-1" />
        </el-select>
      </span>
      <el-radio-group v-model="viewMode" size="small" class="view-toggle" data-tour="list-view-toggle">
        <el-radio-button value="simple">📋 简单</el-radio-button>
        <el-radio-button value="complex">📋📋 复杂</el-radio-button>
        <el-radio-button value="timeline">📋📋📋 跟踪</el-radio-button>
      </el-radio-group>
      <el-button size="small" @click="showColumnSettings = true" title="配置各视图的显示列与顺序">
        <el-icon><Setting /></el-icon> 列设置
      </el-button>
    </div>

    <!-- 推送收件箱 -->
    <el-alert
      v-if="showPushInbox"
      :title="`收到 ${incomingPushes.length} 条推送待审批`"
      type="warning"
      :closable="false"
      show-icon
      style="margin-bottom:12px"
    >
      <template #default>
        <div class="push-inbox">
          <div v-for="pr in incomingPushes" :key="pr.id" class="push-inbox-item">
            <span class="push-inbox-info">
              📤 <strong>{{ pr.fromListName }}</strong>
              → 📋 <strong>{{ pr.issueTitle }}</strong>
              <span class="push-inbox-meta">{{ new Date(pr.pushedAt).toLocaleString('zh-CN') }}</span>
            </span>
            <span class="push-inbox-actions">
              <el-button size="small" type="success" @click.stop="onAcceptPush(pr.id)">接受</el-button>
              <el-button size="small" type="danger" @click.stop="onRejectPush(pr.id)">拒绝</el-button>
            </span>
          </div>
        </div>
      </template>
    </el-alert>

    <!-- Issue 表格（汽车行业 Open Issue 标准列） -->
    <el-table
      :data="filteredIssues"
      v-loading="issueStore.loading"
      stripe border
      size="small"
      :default-sort="defaultSort"
      @sort-change="onSortChange"
      @header-dragend="onColResize"
      highlight-current-row
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
            <span class="issue-row-index" :class="{ 'is-pushed': isPushedIssue(row) }">{{ $index + 1 }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip fixed="left" sortable="custom">
        <template #default="{ row }">
          <span class="cell-link" title="点击查看" @click="openViewIssue(row, $event)">{{ row.title }}</span>
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
            <el-button class="row-action-btn" plain circle type="primary" size="small" aria-label="编辑" @click.stop="openEditIssue(row)" title="编辑">
              <el-icon><Edit /></el-icon>
            </el-button>
            <el-button class="row-action-btn" plain circle type="warning" size="small" aria-label="推送到其他列表" @click.stop="onPushIssue(row.id)" title="推送到其他列表">
              <el-icon><Promotion /></el-icon>
            </el-button>
            <el-dropdown
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
                  <el-dropdown-item command="checkpoint">添加点检</el-dropdown-item>
                  <template v-if="isUnwatched(row)">
                    <el-dropdown-item command="unvoid" style="color:#67c23a">🔄 恢复默认(三星)</el-dropdown-item>
                  </template>
                  <template v-else>
                    <el-dropdown-item command="void" style="color:#e6a23c">⊘ 设为不关注</el-dropdown-item>
                  </template>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无 Issue" /></template>
    </el-table>

    <IssueFormDialog v-if="showCreateIssue" :all-users="activeUsers" @confirm="onCreateIssue" @close="showCreateIssue = false" />
    <IssueFormDialog
      v-if="showEditIssue && editIssueRow"
      :all-users="activeUsers"
      :initial="editIssueRow"
      @confirm="onEditIssue"
      @close="showEditIssue = false; editIssueRow = null"
    />
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

    <!-- Issue 详情遮罩 -->
    <PnwAppModalOverlay :open="showIssueModal" aria-label="Issue 详情" panel-class="issue-detail-modal" @close="showIssueModal = false">
      <IssueDetailView
        v-if="showIssueModal"
        :issue-id="modalIssueId"
        @checkpoint-created="onCheckpointCreated"
        @close="showIssueModal = false"
      />
    </PnwAppModalOverlay>
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.page-head h2 {
  font-size: 1.3rem;
  font-weight: 650;
}
.list-desc {
  color: #909399;
  font-size: 0.85rem;
  margin-top: 2px;
}
.head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.filters {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}
.cell-link {
  cursor: pointer;
  border-radius: 2px;
}
.cell-link:hover {
  color: #409eff;
  text-decoration: underline;
  text-underline-offset: 2px;
}
.issue-row-index {
  display: inline-grid;
  place-items: center;
  width: 26px;
  height: 26px;
  box-sizing: border-box;
  border: 1px solid transparent;
  border-radius: 5px;
  color: #606266;
  font-variant-numeric: tabular-nums;
}
.issue-row-index.is-pushed {
  position: relative;
  background: #d9ecff;
  border: 2px solid #409eff;
  box-shadow: inset 3px 0 0 #1677ff, 0 0 0 1px rgba(64, 158, 255, 0.16);
  color: #1677ff;
  font-weight: 700;
}
.issue-row-index.is-pushed::after {
  position: absolute;
  top: -5px;
  right: -5px;
  width: 8px;
  height: 8px;
  content: '';
  background: #1677ff;
  border: 2px solid #fff;
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
.view-toggle {
  margin-left: 12px;
  flex-shrink: 0;
}

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
  color: #909399;
  font-size: 0.75rem;
  margin-left: 12px;
}
.push-inbox-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .page-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .head-actions { flex-wrap: wrap; }
  .filters { flex-wrap: wrap; }
}
/* 不关注行 */
:deep(.row-unwatched) { opacity: 0.45; background: #fafafa; }
:deep(.row-attention-high) { background: #fff7f0; }

</style>
<style>
.pnw-modal-panel.issue-detail-modal {
  width: min(90vw, 1680px);
  max-height: min(92vh, 980px);
  padding: 0;
}
.pnw-modal-panel.issue-detail-modal .page {
  padding: 24px;
}
@media (max-width: 720px) {
  .pnw-modal-panel.issue-detail-modal { width: calc(100vw - 24px); }
  .pnw-modal-panel.issue-detail-modal .page { padding: 16px; }
}
</style>
