<script setup lang="ts">
import { onMounted, ref, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueStore } from '@/stores/issues'
import { useSettingsStore } from '@/stores/settings'
import { getCheckpoints, createCheckpoint, updateCheckpoint } from '@/api/checkpoints'
import { getAllUsers } from '@/api/auth'
import { ElMessage } from 'element-plus'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import CheckpointFormDialog from '@/components/CheckpointFormDialog.vue'
import CheckpointStatusTag from '@/components/CheckpointStatusTag.vue'
import IssueFormDialog from '@/components/IssueFormDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
import type { Checkpoint, CheckpointStatus } from '@open-issue/core'
import { isOverdue } from '@open-issue/core'

const props = defineProps<{ issueId?: string }>()
const emit = defineEmits<{ close: []; 'checkpoint-created': [] }>()
const route = useRoute()
const router = useRouter()
const issueStore = useIssueStore()
const settings = useSettingsStore()
const issueId = props.issueId || (route.params.id as string)
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab', () => {})
const updateTabTitle = inject<(pageId: string, title: string) => void>('updateTabTitle', () => {})

// 判断是否为模态模式（有 props.issueId 说明是弹窗）
const isModal = computed(() => !!props.issueId)

function openAsPage() {
  emit('close')
  const title = issueStore.currentIssue?.title || `Issue #${issueId.slice(0, 8)}`
  openTab(`issueDetail:${issueId}`, title, issueId)
}

const checkpoints = ref<Checkpoint[]>([])
const allUsers = ref<any[]>([])
const showCpForm = ref(false)
const editCheckpoint = ref<Checkpoint | null>(null)
const showPush = ref(false)
const showEdit = ref(false)
const canModify = computed(() => Boolean((issueStore.currentIssue as any)?._canModify))
const canPush = computed(() => Boolean((issueStore.currentIssue as any)?._canPush))

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭', cancelled: '已取消' }
const statusTag: Record<string, string | undefined> = { open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger' }
const priorityTag: Record<string, string | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }
const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }
const severityTag: Record<string, string | undefined> = { fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined }
const cpStatusLabel: Record<string, string> = { pending: '待处理', done: '已完成', skipped: '已跳过', voided: '已作废' }
const cpStatusColor: Record<string, string> = { pending: '#909399', done: '#67c23a', skipped: '#e6a23c', voided: '#f56c6c' }

const sortedCheckpoints = computed(() => {
  const direction = settings.checkpointTimelineOrder === 'desc' ? -1 : 1
  return [...checkpoints.value].sort((a, b) => {
    const date = a.checkpointDate.localeCompare(b.checkpointDate)
    if (date !== 0) return date * direction
    return (a.sortOrder - b.sortOrder) * direction
  })
})

onMounted(async () => {
  await issueStore.fetchIssue(issueId)
  // 更新标签标题
  if (!isModal.value && issueStore.currentIssue) {
    const label = issueStore.currentIssue.title.length > 16
      ? issueStore.currentIssue.title.slice(0, 16) + '…'
      : issueStore.currentIssue.title
    updateTabTitle(`issueDetail:${issueId}`, `📋 ${label}`)
  }
  await loadCheckpoints()
  const res = await getAllUsers({ includeDisabled: true })
  allUsers.value = res.data
})

// 表单下拉选择时排除已禁用用户
const activeUsers = computed(() => allUsers.value.filter((u: any) => !u.disabled))

async function loadCheckpoints() {
  const res = await getCheckpoints(issueId)
  checkpoints.value = res.data
}

function getUserName(id: string | null): string {
  if (!id) return '-'
  const u = allUsers.value.find((u: any) => u.id === id)
  return u?.displayName || u?.username || id.slice(0, 8)
}

function getCheckpointClass(cp: Checkpoint) {
  const { overdue } = isOverdue(cp.checkpointDate, cp.status)
  return overdue ? 'checkpoint-overdue' : ''
}

async function onCreateCp(data: any) {
  await createCheckpoint(issueId, data)
  showCpForm.value = false
  ElMessage.success('点检项已添加')
  await loadCheckpoints()
  emit('checkpoint-created')
}

function openEditCheckpoint(cp: Checkpoint) {
  if (!canModify.value) return
  editCheckpoint.value = cp
}

async function onEditCheckpoint(data: {
  checkpointDate: string
  description: string
  responsibleUserId?: string
  status?: CheckpointStatus
}) {
  if (!editCheckpoint.value) return
  await updateCheckpoint(editCheckpoint.value.id, data)
  editCheckpoint.value = null
  ElMessage.success('点检已更新')
  await loadCheckpoints()
  emit('checkpoint-created')
}

async function onChangeCheckpointStatus(cp: Checkpoint, status: CheckpointStatus) {
  if (!canModify.value) return
  if (cp.status === status) return
  await updateCheckpoint(cp.id, { status })
  ElMessage.success(`点检已更新为${cpStatusLabel[status]}`)
  await loadCheckpoints()
  emit('checkpoint-created')
}

function checkpointOverdue(cp: Checkpoint) {
  return isOverdue(cp.checkpointDate, cp.status).overdue
}

function escapeCell(value: string) {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

async function copyTimelineTable() {
  const issue = issueStore.currentIssue
  if (!issue) return
  const rows = sortedCheckpoints.value.map(cp =>
    `| ${cp.checkpointDate} | ${cpStatusLabel[cp.status]} | ${escapeCell(cp.description)} | ${escapeCell(getUserName(cp.responsibleUserId))} |`,
  )
  const text = [
    `## ${issue.issueNo} ${issue.title}`,
    '',
    '| 日期 | 状态 | 内容 | 负责人 |',
    '| --- | --- | --- | --- |',
    ...rows,
  ].join('\n')
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  ElMessage.success(`已复制 ${rows.length} 条时间线`)
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

async function onEditIssue(data: any) {
  await issueStore.updateIssue(issueId, data)
  showEdit.value = false
  ElMessage.success('Issue 已更新')
}

function goBack() {
  if (props.issueId) { emit('close'); return }
  router.back()
}
</script>

<template>
  <div class="page">
    <PnwPageHeader :title="issueStore.currentIssue?.title || 'Issue 详情'">
      <template #actions>
        <div v-if="isModal || (issueStore.currentIssue && (canModify || canPush))" class="header-actions" data-tour="issue-actions">
          <el-button v-if="isModal" size="small" plain @click="openAsPage" title="在页面中打开，可使用帮助和巡游">
            <el-icon><FullScreen /></el-icon> 页面模式
          </el-button>
          <el-button v-if="issueStore.currentIssue && canModify" size="small" type="primary" plain @click="showEdit = true">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-tooltip v-if="issueStore.currentIssue && canModify" content="添加点检" placement="bottom">
            <el-button
              size="small"
              type="success"
              plain
              circle
              aria-label="添加点检"
              @click="showCpForm = true"
            >
              <el-icon><Plus /></el-icon>
            </el-button>
          </el-tooltip>
          <el-tooltip v-if="issueStore.currentIssue && canPush" content="推送到其他列表" placement="bottom">
            <el-button
              size="small"
              type="warning"
              plain
              circle
              aria-label="推送到其他列表"
              @click="showPush = true"
            >
              <el-icon><Promotion /></el-icon>
            </el-button>
          </el-tooltip>
        </div>
      </template>
      <template #help>
        <div class="header-right">
          <PageHelpButton page-id="issueDetail" />
          <button class="hdr-btn-close" @click="goBack" title="关闭">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </template>
    </PnwPageHeader>

    <div v-if="issueStore.currentIssue" class="issue-workspace">
      <div class="issue-detail">
      <div class="detail-meta" data-tour="issue-meta">
        <span class="issue-no">{{ issueStore.currentIssue.issueNo }}</span>
        <el-tag :type="statusTag[issueStore.currentIssue.status]">
          {{ statusLabel[issueStore.currentIssue.status] }}
        </el-tag>
        <el-tag v-if="issueStore.currentIssue.originListName" type="info" effect="plain">
          归属：{{ issueStore.currentIssue.originListName }}
        </el-tag>
        <span class="meta-time">创建于 {{ new Date(issueStore.currentIssue.createdAt).toLocaleString('zh-CN') }}</span>
      </div>

      <!-- 基本信息 -->
      <el-descriptions title="基本信息" :column="2" border size="small" class="detail-desc-block" data-tour="issue-basic">
        <el-descriptions-item label="严重度">
          <el-tag :type="severityTag[issueStore.currentIssue.severity]" size="small" effect="dark">
            {{ dict.getLabel('severity', issueStore.currentIssue.severity) }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="优先级">
          <el-tag :type="priorityTag[issueStore.currentIssue.priority]" size="small">
            {{ priorityLabel[issueStore.currentIssue.priority] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="问题分类">
          {{ dict.getLabel('issueCategory', issueStore.currentIssue.category) || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="发现阶段">
          {{ dict.getLabel('detectionPhase', issueStore.currentIssue.detectionPhase) || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="关联功能">
          <template v-if="(issueStore.currentIssue as any)._functionName">
            {{ (issueStore.currentIssue as any)._functionPlatform }}
            <el-tag size="small" type="info" style="margin:0 6px">{{ (issueStore.currentIssue as any)._functionExternalId }}</el-tag>
            {{ (issueStore.currentIssue as any)._functionName }}
          </template>
          <template v-else>—</template>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 人员与日期 -->
      <el-descriptions title="人员与日期" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="提出人">
          <template v-if="issueStore.currentIssue.reporterId">👤{{ getUserName(issueStore.currentIssue.reporterId) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="责任人">
          <template v-if="issueStore.currentIssue.assigneeId">👤{{ getUserName(issueStore.currentIssue.assigneeId) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="录入人">
          <template v-if="issueStore.currentIssue.createdBy">👤{{ getUserName(issueStore.currentIssue.createdBy) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="计划完成日">{{ formatDate(issueStore.currentIssue.dueDate) }}</el-descriptions-item>
        <el-descriptions-item label="实际完成日">{{ formatDate(issueStore.currentIssue.completedAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新于">{{ new Date(issueStore.currentIssue.updatedAt).toLocaleString('zh-CN') }}</el-descriptions-item>
      </el-descriptions>

      <!-- 关闭信息（仅已关闭/已取消时显示） -->
      <el-descriptions v-if="issueStore.currentIssue.status === 'closed' || issueStore.currentIssue.status === 'cancelled'" title="关闭信息" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="关闭理由">
          <el-tag v-if="issueStore.currentIssue.closeReason" size="small" type="info">
            {{ dict.getLabel('closeReason', issueStore.currentIssue.closeReason) }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="关闭确认人">{{ getUserName(issueStore.currentIssue.closedBy) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 8D 报告（仅填写后显示） -->
      <el-descriptions v-if="issueStore.currentIssue.containment || issueStore.currentIssue.rootCause || issueStore.currentIssue.correctiveAction" title="8D 报告" :column="1" border size="small" class="detail-desc-block" data-tour="issue-8d">
        <el-descriptions-item label="D3 临时遏制措施">
          {{ issueStore.currentIssue.containment || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="D4 根本原因">
          {{ issueStore.currentIssue.rootCause || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="D5-D6 永久纠正措施">
          {{ issueStore.currentIssue.correctiveAction || '—' }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="detail-desc" v-if="issueStore.currentIssue.description">
        <h4>描述</h4>
        <p>{{ issueStore.currentIssue.description }}</p>
      </div>
      </div>

      <!-- 点检时间线 -->
      <aside class="checkpoints-section" data-tour="issue-checkpoints">
      <div class="section-head">
        <h3>点检时间线</h3>
        <div class="timeline-tools">
          <el-radio-group v-model="settings.checkpointTimelineDisplay" size="small" aria-label="时间线显示形式">
            <el-radio-button value="cards">卡片</el-radio-button>
            <el-radio-button value="table">表格</el-radio-button>
          </el-radio-group>
          <el-tooltip :content="settings.checkpointTimelineOrder === 'desc' ? '当前：最新优先' : '当前：最早优先'" placement="top">
            <el-button
              size="small"
              circle
              aria-label="切换时间线排序"
              @click="settings.checkpointTimelineOrder = settings.checkpointTimelineOrder === 'desc' ? 'asc' : 'desc'"
            ><el-icon><Sort /></el-icon></el-button>
          </el-tooltip>
          <el-tooltip content="复制时间线表格" placement="top">
            <el-button size="small" circle aria-label="复制时间线表格" @click="copyTimelineTable"><el-icon><DocumentCopy /></el-icon></el-button>
          </el-tooltip>
        </div>
      </div>

      <el-empty v-if="!checkpoints.length" description="暂无点检项" />

      <el-timeline v-else-if="settings.checkpointTimelineDisplay === 'cards'">
        <el-timeline-item
          v-for="cp in sortedCheckpoints" :key="cp.id"
          :timestamp="cp.checkpointDate"
          :color="cpStatusColor[cp.status]"
          placement="top"
        >
          <div :class="['cp-card', getCheckpointClass(cp), { 'cp-editable': canModify }]" :title="canModify ? '点击编辑点检' : ''" @click="openEditCheckpoint(cp)">
            <div class="cp-header">
              <CheckpointStatusTag :status="cp.status" :overdue="checkpointOverdue(cp)" :disabled="!canModify" @change="onChangeCheckpointStatus(cp, $event)" />
              <span class="cp-responsible">负责人: {{ getUserName(cp.responsibleUserId) }}</span>
            </div>
            <p class="cp-desc">{{ cp.description }}</p>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-table v-else :data="sortedCheckpoints" size="small" class="checkpoint-table" :fit="true">
        <el-table-column prop="checkpointDate" label="日期" width="100" />
        <el-table-column label="状态" width="76">
          <template #default="{ row }">
            <CheckpointStatusTag :status="row.status" :overdue="checkpointOverdue(row)" :disabled="!canModify" @change="onChangeCheckpointStatus(row, $event)" />
          </template>
        </el-table-column>
        <el-table-column prop="description" label="内容" min-width="120" show-overflow-tooltip>
          <template #default="{ row }"><span :class="{ 'cp-table-desc': canModify }" :title="canModify ? '点击编辑点检' : ''" @click="openEditCheckpoint(row)">{{ row.description }}</span></template>
        </el-table-column>
        <el-table-column label="负责人" min-width="76" show-overflow-tooltip>
          <template #default="{ row }"><span :title="getUserName(row.responsibleUserId)">{{ getUserName(row.responsibleUserId) }}</span></template>
        </el-table-column>
      </el-table>
      </aside>
    </div>

    <CheckpointFormDialog
      v-if="showCpForm"
      :users="activeUsers"
      :issue-title="issueStore.currentIssue?.title"
      :issue-no="issueStore.currentIssue?.issueNo"
      @confirm="onCreateCp"
      @close="showCpForm = false"
    />
    <CheckpointFormDialog
      v-if="editCheckpoint"
      :users="activeUsers"
      :initial="editCheckpoint"
      :issue-title="issueStore.currentIssue?.title"
      :issue-no="issueStore.currentIssue?.issueNo"
      @confirm="onEditCheckpoint"
      @close="editCheckpoint = null"
    />
    <IssueFormDialog
      v-if="showEdit"
      :all-users="activeUsers"
      :initial="issueStore.currentIssue"
      @confirm="onEditIssue"
      @close="showEdit = false"
    />
    <PushDialog
      v-if="showPush && issueStore.currentIssue"
      :list-id="issueStore.currentIssue.listId"
      :preselected-issue-ids="[issueStore.currentIssue.id]"
      @close="showPush = false"
    />
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}
.header-actions { display: inline-flex; align-items: center; gap: 8px; }
.header-actions :deep(.el-button + .el-button) { margin-left: 0; }
.page-head h2 {
  font-size: 1.15rem;
  font-weight: 650;
  margin: 0;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.page-head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-shrink: 0;
}
.hdr-btn-close {
  width: 28px; height: 28px;
  padding: 0;
  display: grid; place-items: center;
  background: transparent;
  color: #909399;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0;
  transition: background 0.15s, color 0.15s;
}
.hdr-btn-close:hover {
  background: #f0f0f0;
  color: #606266;
}
.header-right { display: flex; align-items: center; gap: 6px; }
.issue-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(400px, 480px);
  gap: 28px;
  align-items: start;
}
.detail-meta { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.issue-no { font-family: monospace; font-size: 1rem; color: #409eff; font-weight: 600; }
.meta-time { font-size: 0.8rem; color: #c0c4cc; }
.detail-desc-block { margin-top: 16px; }
.detail-desc { margin-top: 16px; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; }
.detail-desc h4 { font-size: 0.85rem; color: #909399; margin-bottom: 6px; }
.detail-desc p { font-size: 0.9rem; color: #606266; line-height: 1.6; }
.checkpoints-section {
  min-width: 0;
  padding-left: 24px;
  border-left: 1px solid #ebeef5;
}
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-head h3 { font-size: 1.1rem; font-weight: 650; }
.timeline-tools { display: inline-flex; align-items: center; gap: 6px; }
.cp-card { background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #ebeef5; }
.cp-card.cp-editable { cursor: pointer; }
.cp-card.cp-editable:hover { border-color: #b3d8ff; background: #f7fbff; }
.cp-header { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.cp-responsible { font-size: 0.78rem; color: #909399; }
.cp-desc { font-size: 0.9rem; color: #303133; margin: 0; line-height: 1.6; white-space: pre-wrap; }
.cp-table-desc { display: block; cursor: pointer; }
.cp-table-desc:hover { color: #409eff; text-decoration: underline; text-underline-offset: 2px; }
.checkpoint-table :deep(.el-table__cell) { padding: 7px 0; }
@media (max-width: 1100px) {
  .issue-workspace { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .checkpoints-section { padding: 20px 0 0; border-top: 1px solid #ebeef5; border-left: 0; }
}
@media (max-width: 640px) {
  .detail-meta { flex-wrap: wrap; gap: 8px; }
  .section-head { align-items: flex-start; gap: 10px; flex-direction: column; }
  .timeline-tools { width: 100%; justify-content: flex-end; }
}
.page { padding: 16px; }
</style>
