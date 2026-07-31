<script setup lang="ts">
import { computed, inject, onActivated, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pnwPromptInput } from 'phoenix-wing'
import type {
  DashboardPushTask,
  DashboardTaskCounts,
  DashboardTasks,
  DashboardTaskScope,
  DashboardTaskTab,
  ExternalBindRequestAdminView,
  PushTargetListOption,
  UserPublic,
} from '@open-issue/core'
import { getDashboardTasks } from '@/api/dashboard'
import { approveUser } from '@/api/auth'
import { getPushTargetLists, handlePush, withdrawPush } from '@/api/push'
import { useAuthStore } from '@/stores/auth'

type DashboardSection = 'overview' | DashboardTaskTab

const activeTab = defineModel<DashboardSection>('activeTab', { default: 'overview' })
const emit = defineEmits<{
  countsChange: [counts: DashboardTaskCounts]
}>()

const MAX_VISIBLE_TASKS = 5
const EMPTY_TASKS: DashboardTasks = {
  scope: 'summary',
  incomingPushes: [],
  outgoingPushes: [],
  pendingUsers: [],
  externalBindRequests: [],
  counts: { incoming: 0, outgoing: 0, admin: 0, total: 0 },
}

const auth = useAuthStore()
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab', () => {})
const tasks = ref<DashboardTasks>(EMPTY_TASKS)
const loading = ref(false)
let requestSequence = 0
let skipFirstActivation = true
const isAdmin = computed(() => auth.user?.systemRole === 'admin')
const incomingTasks = computed(() => tasks.value.incomingPushes.slice(0, MAX_VISIBLE_TASKS))
const outgoingTasks = computed(() => tasks.value.outgoingPushes.slice(0, MAX_VISIBLE_TASKS))
const pendingUsers = computed(() => tasks.value.pendingUsers.slice(0, MAX_VISIBLE_TASKS))
const externalBindRequests = computed(() => tasks.value.externalBindRequests.slice(0, MAX_VISIBLE_TASKS))
const hiddenIncoming = computed(() => Math.max(0, tasks.value.counts.incoming - incomingTasks.value.length))
const hiddenOutgoing = computed(() => Math.max(0, tasks.value.counts.outgoing - outgoingTasks.value.length))
const acceptDialog = reactive({
  visible: false,
  loading: false,
  submitting: false,
  recordId: '',
  toListId: '',
  lists: [] as PushTargetListOption[],
})

function activeScope(): DashboardTaskScope {
  return activeTab.value === 'overview' ? 'summary' : activeTab.value
}

function releaseTaskData() {
  tasks.value = {
    ...tasks.value,
    scope: 'summary',
    incomingPushes: [],
    outgoingPushes: [],
    pendingUsers: [],
    externalBindRequests: [],
  }
}

async function loadTasks(scope: DashboardTaskScope = activeScope()): Promise<void> {
  const sequence = ++requestSequence
  loading.value = true
  try {
    const response = await getDashboardTasks(scope, MAX_VISIBLE_TASKS)
    if (sequence !== requestSequence || scope !== activeScope()) return
    tasks.value = response.data
    emit('countsChange', response.data.counts)
  } finally {
    if (sequence === requestSequence) loading.value = false
  }
}

function scheduleLoad(scope: DashboardTaskScope = activeScope()) {
  void loadTasks(scope).catch(() => { /* 请求层已显示错误 */ })
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function targetLabel(record: DashboardPushTask) {
  if (record.targetType === 'user') return record.toUserName ? `人员：${record.toUserName}` : '指定人员'
  return record.toListName ? `列表：${record.toListName}` : '目标列表'
}

async function onAccept(record: DashboardPushTask) {
  if (record.targetType === 'list') {
    await handlePush(record.id, 'accepted')
    ElMessage.success('已接受推送')
    await loadTasks()
    return
  }

  acceptDialog.visible = true
  acceptDialog.loading = true
  acceptDialog.recordId = record.id
  acceptDialog.toListId = ''
  acceptDialog.lists = []
  try {
    const response = await getPushTargetLists(record.id)
    acceptDialog.lists = response.data
    if (acceptDialog.lists.length === 1) acceptDialog.toListId = acceptDialog.lists[0].id
  } catch (error) {
    acceptDialog.visible = false
    throw error
  } finally {
    acceptDialog.loading = false
  }
}

async function confirmAccept() {
  if (!acceptDialog.toListId) return
  acceptDialog.submitting = true
  try {
    await handlePush(acceptDialog.recordId, 'accepted', undefined, acceptDialog.toListId)
    ElMessage.success('已接受推送，Issue 已关联到所选列表')
    acceptDialog.visible = false
    await loadTasks()
  } finally {
    acceptDialog.submitting = false
  }
}

async function onReject(record: DashboardPushTask) {
  try {
    const reason = await pnwPromptInput('拒绝推送', `拒绝「${record.issueTitle}」的理由（可选）`)
    await handlePush(record.id, 'rejected', reason || undefined)
    ElMessage.success('已拒绝推送')
    await loadTasks()
  } catch { /* 用户取消时保持当前待办 */ }
}

async function onWithdraw(record: DashboardPushTask) {
  try {
    await ElMessageBox.confirm(
      `确定撤回「${record.issueTitle}」的推送吗？`,
      '撤回推送',
      { type: 'warning', confirmButtonText: '确认撤回', cancelButtonText: '取消' },
    )
    await withdrawPush(record.id)
    ElMessage.success('推送已撤回')
    await loadTasks()
  } catch { /* 用户取消 */ }
}

async function onApproveUser(user: UserPublic) {
  try {
    await ElMessageBox.confirm(
      `批准账号「${user.displayName || user.username}」登录并使用系统？`,
      '批准用户',
      { type: 'info', confirmButtonText: '批准', cancelButtonText: '取消' },
    )
    await approveUser(user.id, true)
    ElMessage.success('用户已批准')
    await loadTasks()
  } catch { /* 用户取消 */ }
}

function goPushHistory() {
  openTab('pushHistory', '推送历史')
}

function goOrg() {
  openTab('org', '组织架构')
}

function goIssue(record: DashboardPushTask) {
  const title = record.issueTitle.length > 12 ? `${record.issueTitle.slice(0, 12)}…` : record.issueTitle
  openTab(`issueDetail:${record.issueId}`, title, record.issueId)
}

function bindRequestName(request: ExternalBindRequestAdminView) {
  return request.proposedDisplayName || request.displayName || request.proposedUsername || '待关联用户'
}

watch(activeTab, () => {
  releaseTaskData()
  scheduleLoad()
})

onMounted(() => scheduleLoad('summary'))
onActivated(() => {
  if (skipFirstActivation) {
    skipFirstActivation = false
    return
  }
  scheduleLoad()
})
</script>

<template>
  <section class="dashboard-content" data-tour="dashboard-task-center" aria-label="仪表盘视图">
    <div v-if="activeTab === 'overview'" id="dashboard-panel-overview" role="tabpanel">
      <slot name="overview" />
    </div>

    <div v-else-if="activeTab === 'incoming'" id="dashboard-panel-incoming" role="tabpanel" class="task-pane" v-loading="loading">
          <header class="task-pane-head">
            <span>发给本人或本人管理列表、等待处理的推送</span>
            <el-button link type="primary" :loading="loading" @click="scheduleLoad()" aria-label="刷新待我处理">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
          </header>
          <div v-if="incomingTasks.length" class="task-list">
          <article v-for="record in incomingTasks" :key="record.id" class="task-row">
            <span class="task-kind is-incoming"><el-icon><Download /></el-icon></span>
            <div class="task-main">
              <strong>{{ record.issueTitle }}</strong>
              <span>{{ record.pushedByName || '其他用户' }} · 来自 {{ record.fromListName }} · {{ formatDate(record.pushedAt) }}</span>
              <small>{{ targetLabel(record) }}</small>
            </div>
            <div class="task-actions">
              <el-button size="small" type="success" @click="onAccept(record)">接受</el-button>
              <el-button size="small" plain type="danger" @click="onReject(record)">拒绝</el-button>
            </div>
          </article>
          <footer class="task-list-footer">
            <span v-if="hiddenIncoming">另有 {{ hiddenIncoming }} 项未显示</span>
            <span v-else>已显示全部待处理推送</span>
            <el-button link type="primary" @click="goPushHistory">查看推送历史</el-button>
          </footer>
          </div>
          <el-empty v-else :image-size="54" description="目前没有需要你处理的推送" />
    </div>

    <div v-else-if="activeTab === 'outgoing'" id="dashboard-panel-outgoing" role="tabpanel" class="task-pane" v-loading="loading">
          <header class="task-pane-head">
            <span>本人发起、仍在等待接收方处理的推送</span>
            <el-button link type="primary" :loading="loading" @click="scheduleLoad()" aria-label="刷新我发起的">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
          </header>
          <div v-if="outgoingTasks.length" class="task-list">
          <article v-for="record in outgoingTasks" :key="record.id" class="task-row">
            <span class="task-kind is-outgoing"><el-icon><Upload /></el-icon></span>
            <div class="task-main">
              <button type="button" class="task-title-link" @click="goIssue(record)">{{ record.issueTitle }}</button>
              <span>{{ record.fromListName }} → {{ targetLabel(record) }} · {{ formatDate(record.pushedAt) }}</span>
              <small>等待接收方处理</small>
            </div>
            <div class="task-actions">
              <el-button size="small" plain @click="onWithdraw(record)">撤回</el-button>
            </div>
          </article>
          <footer class="task-list-footer">
            <span v-if="hiddenOutgoing">另有 {{ hiddenOutgoing }} 项未显示</span>
            <span v-else>已显示全部待处理推送</span>
            <el-button link type="primary" @click="goPushHistory">查看推送历史</el-button>
          </footer>
          </div>
          <el-empty v-else :image-size="54" description="没有等待处理的已发起推送" />
    </div>

    <div v-else-if="activeTab === 'admin' && isAdmin" id="dashboard-panel-admin" role="tabpanel" class="task-pane" v-loading="loading">
          <header class="task-pane-head">
            <span>待批准账号与待关联第三方登录申请</span>
            <el-button link type="primary" :loading="loading" @click="scheduleLoad()" aria-label="刷新管理审批">
              <el-icon><Refresh /></el-icon>刷新
            </el-button>
          </header>
          <div v-if="pendingUsers.length || externalBindRequests.length" class="admin-task-groups">
          <section v-if="pendingUsers.length" class="admin-task-group">
            <h4>账号待批准 <span>{{ tasks.pendingUsers.length }}</span></h4>
            <article v-for="user in pendingUsers" :key="user.id" class="task-row">
              <span class="task-kind is-admin"><el-icon><User /></el-icon></span>
              <div class="task-main">
                <strong>{{ user.displayName || user.username }}</strong>
                <span>账号 {{ user.username }} · {{ formatDate(user.createdAt) }}</span>
                <small>{{ user.email || '未填写邮箱' }}</small>
              </div>
              <div class="task-actions">
                <el-button size="small" type="primary" @click="onApproveUser(user)">批准</el-button>
                <el-button size="small" plain @click="goOrg">详情</el-button>
              </div>
            </article>
          </section>

          <section v-if="externalBindRequests.length" class="admin-task-group">
            <h4>第三方登录待关联 <span>{{ tasks.externalBindRequests.length }}</span></h4>
            <article v-for="request in externalBindRequests" :key="request.id" class="task-row">
              <span class="task-kind is-admin"><el-icon><Connection /></el-icon></span>
              <div class="task-main">
                <strong>{{ bindRequestName(request) }}</strong>
                <span>飞书登录 · 最近尝试 {{ formatDate(request.lastSeenAt) }}</span>
                <small>{{ request.email || request.proposedUsername || '等待管理员确认本地账号' }}</small>
              </div>
              <div class="task-actions">
                <el-button size="small" type="primary" plain @click="goOrg">去处理</el-button>
              </div>
            </article>
          </section>

          <footer class="task-list-footer">
            <span>复杂的人员与第三方账号操作在组织架构中完成</span>
            <el-button link type="primary" @click="goOrg">打开组织架构</el-button>
          </footer>
          </div>
          <el-empty v-else :image-size="54" description="目前没有管理审批事项" />
    </div>

    <el-dialog v-model="acceptDialog.visible" title="接受到目标列表" width="460px">
      <div v-loading="acceptDialog.loading">
        <el-alert
          title="请选择您负责管理的列表。接受后，Issue 将关联到该列表。"
          type="info"
          :closable="false"
          class="accept-note"
        />
        <el-select v-model="acceptDialog.toListId" placeholder="选择目标列表" style="width:100%">
          <el-option
            v-for="list in acceptDialog.lists"
            :key="list.id"
            :label="list.name"
            :value="list.id"
          />
        </el-select>
        <el-empty
          v-if="!acceptDialog.loading && !acceptDialog.lists.length"
          description="暂无可接收的列表；您需要是列表所有者或管理员"
          :image-size="56"
        />
      </div>
      <template #footer>
        <el-button @click="acceptDialog.visible = false">取消</el-button>
        <el-button type="primary" :disabled="!acceptDialog.toListId" :loading="acceptDialog.submitting" @click="confirmAccept">确认接受</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<style scoped>
.dashboard-content {
  min-width: 0;
  padding-top: 16px;
}
.task-pane {
  min-height: 132px;
}
.task-pane-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 32px;
  margin-bottom: 8px;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary));
  font-size: 0.76rem;
}
.task-list,
.admin-task-groups,
.admin-task-group {
  display: grid;
  gap: 6px;
}
.admin-task-groups {
  gap: 12px;
}
.admin-task-group h4 {
  margin: 2px 0 0;
  font-size: 0.78rem;
  color: var(--el-text-color-regular);
}
.admin-task-group h4 span {
  margin-left: 4px;
  color: var(--el-text-color-secondary);
  font-variant-numeric: tabular-nums;
}
.task-row {
  min-width: 0;
  display: grid;
  grid-template-columns: 30px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}
.task-kind {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border-radius: 8px;
}
.task-kind.is-incoming { color: var(--el-color-success); background: var(--el-color-success-light-9); }
.task-kind.is-outgoing { color: var(--el-color-primary); background: var(--el-color-primary-light-9); }
.task-kind.is-admin { color: var(--el-color-warning); background: var(--el-color-warning-light-9); }
.task-main {
  min-width: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1px;
}
.task-main strong,
.task-title-link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-primary);
  font-size: 0.84rem;
  font-weight: 600;
}
.task-title-link {
  width: fit-content;
  max-width: 100%;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
  cursor: pointer;
}
.task-title-link:hover { color: var(--el-color-primary); }
.task-main span,
.task-main small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--el-text-color-secondary);
  font-size: 0.72rem;
}
.task-main small { color: var(--el-text-color-placeholder); }
.task-actions {
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.task-list-footer {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  color: var(--el-text-color-secondary);
  font-size: 0.72rem;
}
.accept-note { margin-bottom: 16px; }
@media (max-width: 680px) {
  .task-row { grid-template-columns: 28px minmax(0, 1fr); }
  .task-actions { grid-column: 2; }
  .task-pane-head span { display: none; }
}
</style>
