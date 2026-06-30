<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { useIssueStore } from '@/stores/issues'
import { useSettingsStore } from '@/stores/settings'
import { getMembers, addMember, removeMember } from '@/api/issueLists'
import { getAllUsers } from '@/api/auth'
import { getCheckpointsByList } from '@/api/checkpoints'
import { getIncomingPushes, handlePush } from '@/api/push'
import { ElMessage, ElMessageBox } from 'element-plus'
import { isOverdue } from '@phoenix-wing/open-issue-core'
import type { Checkpoint } from '@phoenix-wing/open-issue-core'
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

const severityLabel: Record<string, string> = {
  fatal: '致命', major: '严重', minor: '一般', trivial: '轻微',
}
const severityTag: Record<string, string | undefined> = {
  fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined,
}

const categoryLabel: Record<string, string> = {
  appearance: '外观', dimension: '尺寸', function: '功能', process: '过程', safety: '安全', other: '其他',
}

const detectionPhaseLabel: Record<string, string> = {
  incoming: '来料检验', in_process: '过程检验', final: '终检', customer: '客户反馈', audit: '审核发现', supplier: '供应商端',
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
  await listStore.fetchList(listId.value)
  await loadData()
})

async function loadData() {
  const tasks: Promise<any>[] = [
    issueStore.fetchIssues(listId.value, {
      status: statusFilter.value || undefined,
      search: searchText.value || undefined,
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
    await ElMessageBox.prompt('拒绝理由（可选）', '拒绝推送', { confirmButtonText: '确认拒绝', cancelButtonText: '取消' })
      .then(async ({ value }) => {
        await handlePush(recordId, 'rejected', value || undefined)
        ElMessage.success('已拒绝推送')
        loadIncomingPushes()
      })
  } catch {
    // 用户取消
  }
}

// 获取某 Issue 的最近 N 条点检
function getRecentCheckpoints(issueId: string): Checkpoint[] {
  const maxCount = settings.maxTimelineRows
  const cps = checkpointMap.value[issueId]
  if (!cps || !cps.length) return []
  return cps.slice(0, maxCount)
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
  const res = await getAllUsers()
  allUsers.value = res.data
}

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

function goIssue(id: string) { router.push(`/issues/${id}`) }

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
  await ElMessageBox.confirm(`确定删除 Issue「${title}」及其所有点检项？`, '确认删除', { type: 'warning' })
  await issueStore.deleteIssue(id)
  ElMessage.success('已删除')
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

function formatDate(d: string | null) {
  if (!d) return '—'
  return d.slice(0, 10)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ currentList?.name }}</h2>
        <p v-if="currentList?.description" class="list-desc">{{ currentList.description }}</p>
      </div>
      <div class="head-actions">
        <el-button @click="showMembers = true"><el-icon><User /></el-icon> 成员 ({{ members.length }})</el-button>
        <el-button type="primary" @click="showCreateIssue = true"><el-icon><Plus /></el-icon> 新建 Issue</el-button>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filters">
      <el-input v-model="searchText" placeholder="搜索标题/描述..." clearable style="width:200px" size="small" />
      <el-select v-model="statusFilter" placeholder="状态" clearable size="small" style="width:110px">
        <el-option v-for="(l, v) in statusLabel" :key="v" :label="l" :value="v" />
      </el-select>
      <el-select v-model="severityFilter" placeholder="严重度" clearable size="small" style="width:100px">
        <el-option v-for="(l, v) in severityLabel" :key="v" :label="l" :value="v" />
      </el-select>
      <el-select v-model="categoryFilter" placeholder="分类" clearable size="small" style="width:100px">
        <el-option v-for="(l, v) in categoryLabel" :key="v" :label="l" :value="v" />
      </el-select>
      <span v-if="viewMode === 'timeline'" style="font-size:0.8rem;color:#909399;display:inline-flex;align-items:center;gap:4px">
        显示最近
        <el-select :model-value="settings.maxTimelineRows" @update:model-value="settings.maxTimelineRows = $event" size="small" style="width:65px">
          <el-option v-for="n in [1,2,3,4,5,6,7,8,9,10]" :key="n" :label="String(n)" :value="n" />
        </el-select>
        条点检
      </span>
      <el-radio-group v-model="viewMode" size="small" class="view-toggle">
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
      stripe
      size="small"
      @row-click="(row: any) => goIssue(row.id)"
      style="cursor:pointer"
      highlight-current-row
    >
      <el-table-column type="index" label="#" width="45" align="center" fixed="left" />
      <el-table-column prop="title" label="标题" min-width="180" show-overflow-tooltip fixed="left" />
      <el-table-column prop="issueNo" label="编号" width="145" />
      <el-table-column label="严重度" width="75" align="center">
        <template #default="{ row }">
          <el-tag :type="severityTag[row.severity]" size="small" effect="dark">
            {{ severityLabel[row.severity] || row.severity }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="优先级" width="75" align="center">
        <template #default="{ row }">
          <el-tag :type="priorityTag[row.priority]" size="small">{{ priorityLabel[row.priority] || row.priority }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="分类" width="85">
        <template #default="{ row }">
          <span v-if="row.category" class="cell-text">{{ categoryLabel[row.category] || row.category }}</span>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="发现阶段" width="100">
        <template #default="{ row }">
          <span v-if="row.detectionPhase" class="cell-text">{{ detectionPhaseLabel[row.detectionPhase] }}</span>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column v-if="viewMode === 'complex'" label="提出人" width="80">
        <template #default="{ row }">
          {{ userMap[row.reporterId] || '—' }}
        </template>
      </el-table-column>
      <el-table-column label="责任人" width="80">
        <template #default="{ row }">
          <el-tag v-if="row.assigneeId && userMap[row.assigneeId]" size="small" type="warning" effect="plain">
            {{ userMap[row.assigneeId] }}
          </el-tag>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <el-table-column label="计划完成日" width="110">
        <template #default="{ row }">
          {{ formatDate(row.dueDate) }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="statusTag[row.status]" size="small">
            {{ statusLabel[row.status] || row.status }}
          </el-tag>
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
              <span class="cp-mini-date">{{ cp.checkpointDate }}</span>
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
          <el-button link type="warning" size="small" @click.stop="onPushIssue(row.id)" title="推送"><el-icon><Promotion /></el-icon></el-button>
          <el-dropdown @command="(cmd: string) => cmd === 'delete' ? onDeleteIssue(row.id, row.title) : onStatusChange(row, cmd)" size="small" trigger="click">
            <el-button link type="primary" size="small" @click.stop>状态 ▾</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="open">待处理</el-dropdown-item>
                <el-dropdown-item command="in_progress">进行中</el-dropdown-item>
                <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                <el-dropdown-item command="closed">已关闭</el-dropdown-item>
                <el-dropdown-item command="cancelled">已取消</el-dropdown-item>
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

    <IssueFormDialog v-if="showCreateIssue" :all-users="allUsers" @confirm="onCreateIssue" @close="showCreateIssue = false" />
    <MemberManageDialog
      v-if="showMembers"
      :members="members"
      :all-users="allUsers"
      @add="onAddMember"
      @remove="onRemoveMember"
      @close="showMembers = false"
    />
    <PushDialog v-if="showPush" :list-id="listId" :preselected-issue-ids="pushIssueId ? [pushIssueId] : []" @close="showPush = false; pushIssueId = null" />
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
</style>
