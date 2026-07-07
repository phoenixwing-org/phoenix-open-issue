<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { useIssueStore } from '@/stores/issues'
import { useSettingsStore } from '@/stores/settings'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
import { getMembers, addMember, removeMember, transferOwner } from '@/api/issueLists'
import { getAllUsers } from '@/api/auth'
import { getCheckpointsByList } from '@/api/checkpoints'
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
import { isOverdue } from '@open-issue/core'
import type { Checkpoint } from '@open-issue/core'
import IssueFormDialog from '@/components/IssueFormDialog.vue'
import MemberManageDialog from '@/components/MemberManageDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'

const route = useRoute()
const router = useRouter()
const listStore = useIssueListStore()
const issueStore = useIssueStore()

const listId = computed(() => route.params.id as string)
const settings = useSettingsStore()
const members = ref<any[]>([])
const allUsers = ref<any[]>([])
const showCreateIssue = ref(false)
const showMembers = ref(false)
const showPush = ref(false)
const pushIssueId = ref<string | null>(null)
const statusFilter = ref('')
const severityFilter = ref('')
const categoryFilter = ref('')
const includeVoided = ref(false)
const searchText = ref('')
const viewMode = ref<'simple' | 'complex' | 'timeline'>((settings.defaultViewMode as 'simple' | 'complex' | 'timeline') || 'complex')
watch(viewMode, (v) => { settings.defaultViewMode = v })
const checkpointMap = ref<Record<string, Checkpoint[]>>({})
const incomingPushes = ref<any[]>([])
const showPushInbox = ref(false)

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

const currentList = computed(() => listStore.currentList)

// 用户 ID → 显示名映射
const userMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  for (const u of allUsers.value) {
    map[u.id] = u.displayName || u.username
  }
  return map
})

onMounted(async () => {
  dict.load()
  await listStore.fetchList(listId.value)
  await loadData()
})

async function loadData() {
  const tasks: Promise<any>[] = [
    issueStore.fetchIssues(listId.value, {
      status: statusFilter.value || undefined,
      search: searchText.value || undefined,
      sort: settings.issueSort,
      includeVoided: includeVoided.value || undefined,
    }),
    loadMembers(),
    loadAllUsers(),
  ]
  if (viewMode.value === 'timeline') {
    tasks.push(loadCheckpoints())
  }
  tasks.push(loadIncomingPushes())
  await Promise.all(tasks)
}

async function loadCheckpoints() {
  try {
    const res = await getCheckpointsByList(listId.value)
    checkpointMap.value = res.data
  } catch {
    checkpointMap.value = {}
  }
}

async function loadIncomingPushes() {
  try {
    const res = await getIncomingPushes(listId.value)
    incomingPushes.value = res.data
    showPushInbox.value = incomingPushes.value.length > 0
  } catch {
    incomingPushes.value = []
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
    await pnwPromptInput('拒绝推送', '拒绝理由（可选）')
      .then(async ({ value }) => {
        await handlePush(recordId, 'rejected', value || undefined)
        ElMessage.success('已拒绝推送')
        loadIncomingPushes()
      })
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

// 点检状态图标
function cpIcon(cp: Checkpoint): string {
  if (cp.status === 'done') return '✅'
  if (cp.status === 'skipped') return '❌'
  const { overdue } = isOverdue(cp.checkpointDate, cp.status)
  if (overdue) return '⚠️'
  // future pending
  if (cp.checkpointDate > new Date().toISOString().slice(0, 10)) return '📅'
  return '⏳'
}

async function loadMembers() {
  const res = await getMembers(listId.value)
  members.value = res.data
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

// 前端筛选（severity / category — 后端暂不支持，前端过滤）
const filteredIssues = computed(() => {
  let list = issueStore.issues
  if (severityFilter.value) {
    list = list.filter(i => i.severity === severityFilter.value)
  }
  if (categoryFilter.value) {
    list = list.filter(i => i.category === categoryFilter.value)
  }
  return list
})

function goIssue(id: string) { modalIssueId.value = id; showIssueModal.value = true }

async function onCreateIssue(data: any) {
  await issueStore.createIssue(listId.value, data)
  showCreateIssue.value = false
  ElMessage.success('Issue 创建成功')
  loadData()
}

async function onStatusChange(issue: any, newStatus: string) {
  await issueStore.updateStatus(issue.id, newStatus)
  ElMessage.success('状态已更新')
  loadData()
}

function onPushIssue(issueId: string) {
  pushIssueId.value = issueId
  showPush.value = true
}

async function onDeleteIssue(id: string, title: string) {
  const r = await pnwPromptChoice({ title: '确认删除', message: `确定删除 Issue「${title}」及其所有点检项？`, choices: [{ id: 'delete', label: '删除', variant: 'danger' }, { id: 'cancel', label: '取消' }] });
  if (r.choiceId !== 'delete') return
  await issueStore.deleteIssue(id)
  ElMessage.success('已删除')
  loadData()
}

async function onVoidIssue(id: string, title: string) {
  const r = await pnwPromptChoice({
    title: '确认作废',
    message: `确定在本列表作废 Issue「${title}」？（其他列表不受影响）`,
    choices: [{ id: 'void', label: '作废', variant: 'danger' }, { id: 'cancel', label: '取消' }],
  })
  if (r.choiceId !== 'void') return
  await issueStore.voidIssue(listId.value, id)
  loadData()
}

async function onUnvoidIssue(id: string) {
  await issueStore.unvoidIssue(listId.value, id)
  loadData()
}

async function onAddMember(userId: string, role: string) {
  await addMember(listId.value, userId, role)
  ElMessage.success('成员已添加')
  loadMembers()
}

async function onRemoveMember(userId: string) {
  await removeMember(listId.value, userId)
  ElMessage.success('成员已移除')
  loadMembers()
}

async function onTransferOwner(userId: string) {
  const r = await pnwPromptChoice({
    title: '确认转让',
    message: '确定将列表所有者转让给该用户？您将自动降级为管理员。',
    choices: [
      { id: 'transfer', label: '转让', variant: 'primary' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'transfer') return
  await transferOwner(listId.value, userId)
  ElMessage.success('所有者已转让')
  loadMembers()
  loadData()
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

function formatCpDateShort(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${mm}-${dd}`
}

function colWidth(key: string, fallback: number): number {
  return settings.colWidths[key] || fallback
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
    settings.issueSort = 'createdAt:desc'  // 取消排序 → 默认
  }
  loadData()
}

// 从 settings 解析 Element Plus 的 default-sort prop
const defaultSort = computed(() => {
  const [field, dir] = settings.issueSort.split(':')
  return { prop: field, order: dir === 'asc' ? 'ascending' as const : 'descending' as const }
})
</script>

<template>
  <div class="page">
    <PnwPageHeader :title="currentList?.name || '列表详情'" :subtitle="currentList?.description">
      <template #actions>
        <el-button @click="showMembers = true" data-tour="list-members"><el-icon><User /></el-icon> 成员 ({{ members.length }})</el-button>
        <el-button type="primary" @click="showCreateIssue = true" data-tour="list-create-issue"><el-icon><Plus /></el-icon> 新建 Issue</el-button>
      </template>
      <template #help><PageHelpButton page-id="listDetail" /></template>
    </PnwPageHeader>

    <!-- 筛选栏 -->
    <div class="filters" data-tour="list-filters">
      <el-input v-model="searchText" placeholder="搜索标题/描述..." clearable style="width:200px" size="small" />
      <el-checkbox v-model="includeVoided" size="small" @change="loadData" style="margin-left:4px">显示已作废</el-checkbox>
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
      @row-click="(row: any) => goIssue(row.id)"
      @header-dragend="onColResize"
      style="cursor:pointer"
      highlight-current-row
      :row-class-name="(row: any) => row._voided ? 'row-voided' : ''"
    >
      <el-table-column type="index" label="#" width="45" align="center" fixed="left" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip fixed="left" sortable="custom" />
      <el-table-column prop="issueNo" label="编号" :width="colWidth('编号', 145)" resizable sortable="custom" />
      <el-table-column prop="severity" label="严重度" :width="colWidth('严重度', 75)" resizable align="center" sortable="custom">
        <template #default="{ row }">
          <el-tag :type="severityTag[row.severity]" size="small" effect="dark">
            {{ dict.getLabel('severity', row.severity) || row.severity }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="priority" label="优先级" :width="colWidth('优先级', 75)" resizable align="center" sortable="custom">
        <template #default="{ row }">
          <el-tag :type="priorityTag[row.priority]" size="small">{{ priorityLabel[row.priority] || row.priority }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="分类" :width="colWidth('分类', 85)" resizable>
        <template #default="{ row }">
          <span v-if="row.category" class="cell-text">{{ dict.getLabel('issueCategory', row.category) || row.category }}</span>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="发现阶段" :width="colWidth('发现阶段', 100)" resizable>
        <template #default="{ row }">
          <span v-if="row.detectionPhase" class="cell-text">{{ dict.getLabel('detectionPhase', row.detectionPhase) }}</span>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="提出人" :width="colWidth('提出人', 80)" resizable>
        <template #default="{ row }">
          {{ userMap[row.reporterId] || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="责任人" :width="colWidth('责任人', 80)" resizable>
        <template #default="{ row }">
          <el-tag v-if="row.assigneeId && userMap[row.assigneeId]" size="small" type="warning" effect="plain">
            {{ userMap[row.assigneeId] }}
          </el-tag>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column prop="dueDate" label="计划完成日" width="110" sortable="custom">
        <template #default="{ row }">
          {{ formatDate(row.dueDate) }}
        </template>
      </el-table-column>
      <el-table-column prop="status" label="状态" width="90" align="center" sortable="custom">
        <template #default="{ row }">
          <el-tag v-if="row._voided" type="info" size="small">已作废</el-tag>
          <el-tag v-else :type="statusTag[row.status]" size="small">
            {{ statusLabel[row.status] || row.status }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="createdAt" label="创建日期" width="110" align="center" sortable="custom">
        <template #default="{ row }">
          <span class="cell-date">{{ formatCpDate(row.createdAt) }}</span>
        </template>
      </el-table-column>
      <!-- 跟踪模式：最近点检列 -->
      <el-table-column v-if="viewMode === 'timeline'" label="最近点检" min-width="260" fixed="right">
        <template #default="{ row }">
          <div class="cp-mini-list">
            <div
              v-for="cp in getRecentCheckpoints(row.id)"
              :key="cp.id"
              class="cp-mini-item"
              :class="{ 'cp-overdue': isOverdue(cp.checkpointDate, cp.status).overdue }"
            >
              <span class="cp-mini-icon">{{ cpIcon(cp) }}</span>
              <span class="cp-mini-date" :title="'点检日: ' + cp.checkpointDate">{{ formatCpDate(cp.checkpointDate) }}</span>
              <span class="cp-mini-desc">{{ cp.description }}</span>
              <span v-if="cp.responsibleUserId" class="cp-mini-who">{{ userMap[cp.responsibleUserId] || '' }}</span>
            </div>
            <div v-if="getRecentCheckpoints(row.id).length === 0" class="cp-mini-empty">暂无点检记录</div>
            <div v-if="(checkpointMap[row.id]?.length || 0) > settings.maxTimelineRows" class="cp-mini-more">
              … 共 {{ checkpointMap[row.id].length }} 条
            </div>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="操作" fixed="right" align="right">
        <template #default="{ row }">
          <el-dropdown @command="(cmd: string) => {
            if (cmd === 'delete') { ElMessage.warning('删除功能临时禁用'); return }
            if (cmd === 'void') onVoidIssue(row.id, row.title)
            else if (cmd === 'unvoid') onUnvoidIssue(row.id)
            else onStatusChange(row, cmd)
          }" size="small" trigger="click">
            <el-button link type="primary" size="small" @click.stop>状态 ▾</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <template v-if="row._voided">
                  <el-dropdown-item command="unvoid" style="color:#67c23a">🔄 恢复</el-dropdown-item>
                </template>
                <template v-else>
                  <el-dropdown-item command="open">待处理</el-dropdown-item>
                  <el-dropdown-item command="in_progress">进行中</el-dropdown-item>
                  <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                  <el-dropdown-item command="closed">已关闭</el-dropdown-item>
                  <el-dropdown-item command="cancelled">已取消</el-dropdown-item>
                  <el-dropdown-item command="delete" style="color:#f56c6c" divided>🗑 删除</el-dropdown-item>
                  <el-dropdown-item command="void" style="color:#e6a23c" divided>📄 作废</el-dropdown-item>
                </template>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          <el-button link type="warning" size="small" @click.stop="onPushIssue(row.id)" title="推送到其他列表">
            <el-icon><Promotion /></el-icon>
          </el-button>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无 Issue" /></template>
    </el-table>

    <IssueFormDialog v-if="showCreateIssue" :all-users="activeUsers" @confirm="onCreateIssue" @close="showCreateIssue = false" />
    <MemberManageDialog
      v-if="showMembers"
      :members="members"
      :all-users="activeUsers"
      @add="onAddMember"
      @remove="onRemoveMember"
      @transfer-owner="onTransferOwner"
      @close="showMembers = false"
    />
    <PushDialog v-if="showPush" :list-id="listId" :preselected-issue-ids="pushIssueId ? [pushIssueId] : []" @close="showPush = false; pushIssueId = null" />

    <!-- Issue 详情遮罩 -->
    <PnwAppModalOverlay :open="showIssueModal" aria-label="Issue 详情" panel-class="issue-detail-modal" @close="showIssueModal = false">
      <IssueDetailView v-if="showIssueModal" :issue-id="modalIssueId" @close="showIssueModal = false" />
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
.cell-text {
  font-size: 0.85rem;
}
.cell-na {
  color: #c0c4cc;
}
.cell-date {
  font-family: monospace;
  font-size: 0.8rem;
  color: #909399;
}
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

/* ── 跟踪模式：点检迷你列表 ── */
.cp-mini-list {
  font-size: 0.8rem;
  line-height: 1.6;
  position: relative;
  padding-bottom: 18px;
}
.cp-mini-item {
  display: flex;
  gap: 6px;
  align-items: baseline;
  padding: 1px 0;
}
.cp-mini-item.cp-overdue {
  background: #fef0f0;
  border-radius: 2px;
  padding: 1px 4px;
}
.cp-mini-icon {
  flex-shrink: 0;
  font-size: 0.75rem;
}
.cp-mini-date {
  flex-shrink: 0;
  color: #909399;
  font-family: monospace;
  font-size: 0.75rem;
}
.cp-mini-desc {
  flex: 1;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cp-mini-who {
  flex-shrink: 0;
  color: #c0c4cc;
  font-size: 0.7rem;
}
.cp-mini-created {
  flex-shrink: 0;
  color: #c0c4cc;
  font-size: 0.65rem;
  margin-left: 2px;
}
.cp-mini-empty {
  color: #c0c4cc;
  font-style: italic;
}
.cp-mini-more {
  position: absolute;
  bottom: -3px;
  right: 4px;
  color: #909399;
  background: #f0f2f5;
  font-size: 0.62rem;
  padding: 1px 6px;
  border-radius: 10px;
}

/* 跟踪模式：行高自适应 */
:deep(.el-table__body tr) {
  &.timeline-row td {
    vertical-align: top;
    padding-top: 8px;
    padding-bottom: 8px;
  }
}
@media (max-width: 768px) {
  .page-head { flex-direction: column; align-items: flex-start; gap: 8px; }
  .head-actions { flex-wrap: wrap; }
  .filters { flex-wrap: wrap; }
}
/* 作废行样式 */
:deep(.row-voided) { opacity: 0.45; background: #fafafa; }
</style>
<style>
.issue-detail-modal .pnw-modal-panel {
  width: min(900px, 96vw);
  max-height: min(92vh, 900px);
  padding: 0;
}
.issue-detail-modal .pnw-modal-panel .page {
  padding: 24px;
}
</style>
