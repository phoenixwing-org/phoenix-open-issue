<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueStore } from '/$/phoenix-open-issue/stores/issues'
import { useSettingsStore } from '/$/phoenix-open-issue/stores/settings'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Edit, Promotion } from '@element-plus/icons-vue'
import {
  PnwViewPresentationPortal,
  pnwCreateViewPresentationRecord,
} from 'phoenix-wing'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import { usePhoenixViewDialog } from '/@/pah/PahViewDialogs'
import PageHelpButton from "/$/phoenix-open-issue/components/PageHelpButton.vue"
import {
  ISSUE_FORM_DIALOG_RENDERER_ID,
  ISSUE_FORM_DIALOG_SIZE,
  issueFormDialogInitial,
  issueFormDialogUsers,
  type IssueFormDialogProps,
  type IssueFormDialogResult,
} from '/$/phoenix-open-issue/components/issueFormDialog'
import PushDialog from '/$/phoenix-open-issue/views/push/PushDialog.vue'
import { useDictStore } from '/$/phoenix-open-issue/stores/dict'
import PoiIssueDetailPrimary from '/$/phoenix-open-issue/components/workbench/PoiIssueDetailPrimary.vue'
import IssueCheckpointTimeline from '/$/phoenix-open-issue/components/IssueCheckpointTimeline.vue'
import EightDReportDialog from '/$/phoenix-open-issue/components/EightDReportDialog.vue'
import { createEightDReport, deleteEightDReport, getIssueEightDReports, updateEightDReport } from '/$/phoenix-open-issue/api/eightDReports'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'
import { ISSUE_IMPORTANCE_DICT, ISSUE_URGENCY_DICT, resolveUserLabel } from '/$/phoenix-open-issue/core'
import type { EightDReport, EightDReportInput, EightDReportIssueOption } from '/$/phoenix-open-issue/core'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'

const dict = useDictStore()

const route = useRoute()
const router = useRouter()
const issueStore = useIssueStore()
const settings = useSettingsStore()
const capabilities = useIssueCapabilities()
const viewDialog = usePhoenixViewDialog()
const issueId = route.params.id as string
const currentIssue = computed(() => issueStore.getIssueById(issueId))
const updateTabTitle = inject<(pageId: string, title: string) => void>('updateTabTitle', () => {})
const presentationRecord = ref(pnwCreateViewPresentationRecord({
  rendererId: 'phoenix-open-issue.view.issue-detail',
  viewInstanceId: `phoenix-open-issue.issue-detail:${issueId}`,
  ownerTabId: `issueDetail:${issueId}`,
  instanceKey: `issue:${issueId}`,
}))

const showPush = ref(false)
const showReportDialog = ref(false)
const editingReport = ref<ReportView | null>(null)
interface ReportView extends EightDReport {
  creatorName?: string | null
  _canModify: boolean
}
const reports = ref<ReportView[]>([])
const allUsers = ref<any[]>([])
const hasIssueWriteAccess = computed(() => Boolean((currentIssue.value as any)?._canModify))
const canModify = computed(() =>
  hasIssueWriteAccess.value && capabilities.can('phoenix-open-issue:issue:update'),
)
const canPush = computed(() =>
  Boolean((currentIssue.value as any)?._canPush) &&
  capabilities.can('phoenix-open-issue:push:create'),
)
const canWriteReports = computed(() =>
  hasIssueWriteAccess.value && capabilities.can('phoenix-open-issue:report:write'),
)
const canReadCheckpoints = computed(() => capabilities.can('phoenix-open-issue:checkpoint:read'))
const canCreateCheckpoint = computed(() =>
  canReadCheckpoints.value && hasIssueWriteAccess.value &&
  capabilities.can('phoenix-open-issue:checkpoint:create'),
)
const canUpdateCheckpoint = computed(() =>
  canReadCheckpoints.value && hasIssueWriteAccess.value &&
  capabilities.can('phoenix-open-issue:checkpoint:update'),
)

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '处理中', resolved: '待验收', closed: '已完成', cancelled: '已取消' }
const statusTag: Record<string, TagType | undefined> = { open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger' }
const priorityTag: Record<string, TagType | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }
const severityTag: Record<string, TagType | undefined> = { fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined }
const dimensionLabels = computed(() => ({
  importance: Object.fromEntries(ISSUE_IMPORTANCE_DICT.map(item => [
    item.value,
    dict.labelIndex[`severity:${item.value}`] || item.label,
  ])) as Record<string, string>,
  urgency: Object.fromEntries(ISSUE_URGENCY_DICT.map(item => [
    item.value,
    dict.labelIndex[`priority:${item.value}`] || item.label,
  ])) as Record<string, string>,
}))
const has8d = computed(() => reports.value.length > 0)
const hasDescription = computed(() => Boolean(currentIssue.value?.description))

function scrollToIssueSection(sectionId: string): void {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goBack() {
  router.back()
}

const issuePrimaryContributionProps = computed(() => {
  const issue = currentIssue.value
  return {
    viewKey: `phoenix-open-issue-issue-detail:${issueId}`,
    issueNo: issue?.issueNo ?? '',
    status: issue ? statusLabel[issue.status] ?? issue.status : '',
    priority: issue ? dimensionLabels.value.urgency[issue.priority] ?? issue.priority : '',
    severity: issue ? dimensionLabels.value.importance[issue.severity] ?? issue.severity : '',
    listCount: issue?.listCount ?? 0,
    has8d: has8d.value,
    hasDescription: hasDescription.value,
    onNavigateSection: scrollToIssueSection,
  }
})
usePoiViewContribution(
  () => route.fullPath,
  {
    primary: {
      component: PoiIssueDetailPrimary,
      props: issuePrimaryContributionProps,
    },
  },
)

const issueWorkspace = ref<HTMLElement | null>(null)
let stopTimelineResize: (() => void) | null = null

function startTimelineResize(event: PointerEvent): void {
  if (window.matchMedia('(max-width: 1100px)').matches || !issueWorkspace.value) return
  event.preventDefault()
  const startX = event.clientX
  const startWidth = settings.issueTimelineWidth
  const workspaceWidth = issueWorkspace.value.getBoundingClientRect().width
  const maxWidth = Math.max(360, workspaceWidth - 420)
  const previousUserSelect = document.body.style.userSelect

  const onMove = (moveEvent: PointerEvent) => {
    const nextWidth = startWidth + startX - moveEvent.clientX
    settings.issueTimelineWidth = Math.min(maxWidth, Math.max(360, nextWidth))
  }
  const stop = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', stop)
    window.removeEventListener('pointercancel', stop)
    document.body.style.userSelect = previousUserSelect
    stopTimelineResize = null
  }

  stopTimelineResize?.()
  stopTimelineResize = stop
  document.body.style.userSelect = 'none'
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', stop)
  window.addEventListener('pointercancel', stop)
}

function resizeTimelineByKeyboard(event: KeyboardEvent): void {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
  event.preventDefault()
  const delta = event.key === 'ArrowLeft' ? 24 : -24
  settings.issueTimelineWidth = Math.min(720, Math.max(360, settings.issueTimelineWidth + delta))
}

onBeforeUnmount(() => stopTimelineResize?.())

onMounted(async () => {
  const [, usersResponse, reportsResponse] = await Promise.all([
    issueStore.fetchIssue(issueId),
    capabilities.has('base:sys:user:list')
      ? getAllUsers({ includeDisabled: true })
      : Promise.resolve({ data: [] }),
    capabilities.can('phoenix-open-issue:report:read')
      ? getIssueEightDReports(issueId).catch(() => null)
      : Promise.resolve(null),
  ])
  allUsers.value = usersResponse.data
  if (reportsResponse) reports.value = reportsResponse.data
  // 更新标签标题
  if (currentIssue.value) {
    const label = currentIssue.value.title.length > 16
      ? currentIssue.value.title.slice(0, 16) + '…'
      : currentIssue.value.title
    updateTabTitle(`issueDetail:${issueId}`, `📋 ${label}`)
  }
})

const activeUsers = computed(() => allUsers.value.filter((user: any) => !user.disabled))

function getUserName(id: string | null, resolvedName?: string | null): string {
  return resolvedName || resolveUserLabel(allUsers.value, id)
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

async function onEditIssue(data: IssueFormDialogResult) {
  if (!canModify.value) return
  await issueStore.updateIssue(issueId, data)
  ElMessage.success('Issue 已更新')
}

async function openEditIssue() {
  if (!canModify.value || !currentIssue.value) return
  const outcome = await viewDialog.open<IssueFormDialogProps, IssueFormDialogResult>({
    rendererId: ISSUE_FORM_DIALOG_RENDERER_ID,
    instanceKey: `edit:${issueId}`,
    title: '编辑 Issue',
    props: {
      allUsers: issueFormDialogUsers(activeUsers.value),
      initial: issueFormDialogInitial(currentIssue.value as unknown as Record<string, unknown>),
    },
    size: ISSUE_FORM_DIALOG_SIZE,
  })
  if (outcome.status === 'failed') {
    ElMessage.error(`打开 Issue 编辑器失败：${outcome.message}`)
    return
  }
  if (outcome.status === 'submitted') await onEditIssue(outcome.value)
}

const reportIssueOptions = computed<EightDReportIssueOption[]>(() => currentIssue.value ? [{
  id: currentIssue.value.id,
  issueNo: currentIssue.value.issueNo,
  title: currentIssue.value.title,
  listName: currentIssue.value.originListName ?? '',
}] : [])

async function reloadReports() {
  reports.value = (await getIssueEightDReports(issueId)).data
}

function openCreateReport() {
  if (!canWriteReports.value) return
  editingReport.value = null
  showReportDialog.value = true
}

function openEditReport(report: ReportView) {
  if (!canWriteReports.value || !report._canModify) return
  editingReport.value = report
  showReportDialog.value = true
}

async function saveReport(data: EightDReportInput) {
  if (!canWriteReports.value) return
  if (editingReport.value) await updateEightDReport(editingReport.value.id, data)
  else await createEightDReport({ ...data, relatedIssueId: issueId })
  showReportDialog.value = false
  ElMessage.success(editingReport.value ? '8D 报告已更新' : '8D 报告已创建')
  await reloadReports()
}

async function removeReport(report: ReportView) {
  if (!canWriteReports.value || !report._canModify) return
  try {
    await ElMessageBox.confirm(`确定删除“${report.title}”吗？`, '删除 8D 报告', { type: 'warning' })
    await deleteEightDReport(report.id)
    ElMessage.success('8D 报告已删除')
    await reloadReports()
  } catch { /* 用户取消 */ }
}

</script>

<template>
  <div class="page">
    <PnwViewPresentationPortal
      v-model:record="presentationRecord"
      :title="currentIssue?.title || 'Issue 详情'"
      aria-label="Issue 详情"
    >
      <template #header="{ mode, detach }">
    <PnwPageHeader
      :title="currentIssue?.title || 'Issue 详情'"
      :presentation-detachable="mode === 'embedded'"
      :presentation-mode="mode"
      @detach-view="detach"
    >
      <template #actions>
        <div v-if="currentIssue && (canModify || canPush)" class="header-actions" data-tour="issue-actions">
          <el-button v-if="currentIssue && canModify" size="small" type="primary" plain @click="openEditIssue">
            <el-icon><Edit /></el-icon> 编辑
          </el-button>
          <el-tooltip v-if="currentIssue && canPush" content="推送到其他列表" placement="bottom">
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
          <button v-if="mode === 'embedded'" class="hdr-btn-close" @click="goBack" title="关闭">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </template>
    </PnwPageHeader>
      </template>

      <template #main>
    <div class="issue-view-main">

    <div
      v-if="currentIssue"
      ref="issueWorkspace"
      class="issue-workspace"
      :style="{ '--issue-timeline-width': `${settings.issueTimelineWidth}px` }"
    >
      <div class="issue-detail">
      <div class="detail-meta" data-tour="issue-meta">
        <span class="issue-no">{{ currentIssue.issueNo }}</span>
        <el-tag :type="statusTag[currentIssue.status]">
          {{ statusLabel[currentIssue.status] }}
        </el-tag>
        <el-tag v-if="currentIssue.originListName" type="info" effect="plain">
          归属：{{ currentIssue.originListName }}
        </el-tag>
        <el-tooltip
          v-if="currentIssue.listCount >= 2"
          :content="`当前关联 ${currentIssue.listCount} 个点检表`"
          placement="top"
        >
          <el-tag type="primary" effect="plain">关联点检表 {{ currentIssue.listCount }}</el-tag>
        </el-tooltip>
        <span class="meta-time">创建于 {{ new Date(currentIssue.createdAt).toLocaleString('zh-CN') }}</span>
      </div>

      <!-- 基本信息 -->
      <el-descriptions id="issue-basic" title="基本信息" :column="2" border size="small" class="detail-desc-block" data-tour="issue-basic">
        <el-descriptions-item label="重要度">
          <el-tag :type="severityTag[currentIssue.severity]" size="small" effect="dark">
            {{ dimensionLabels.importance[currentIssue.severity] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="紧急度">
          <el-tag :type="priorityTag[currentIssue.priority]" size="small">
            {{ dimensionLabels.urgency[currentIssue.priority] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="问题分类">
          {{ dict.getLabel('issueCategory', currentIssue.category) || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="发现阶段">
          {{ dict.getLabel('detectionPhase', currentIssue.detectionPhase) || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="关联功能">
          <template v-if="(currentIssue as any)._functionName">
            {{ (currentIssue as any)._functionPlatform }}
            <el-tag size="small" type="info" style="margin:0 6px">{{ (currentIssue as any)._functionExternalId }}</el-tag>
            {{ (currentIssue as any)._functionName }}
          </template>
          <template v-else>—</template>
        </el-descriptions-item>
      </el-descriptions>

      <!-- 人员与日期 -->
      <el-descriptions id="issue-people" title="人员与日期" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="提出人">
          <template v-if="currentIssue.reporterId">👤{{ getUserName(currentIssue.reporterId, currentIssue.reporterName) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="责任人">
          <template v-if="currentIssue.assigneeId">👤{{ getUserName(currentIssue.assigneeId, currentIssue.assigneeName) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="录入人">
          <template v-if="currentIssue.createdBy">👤{{ getUserName(currentIssue.createdBy, currentIssue.creatorName) }}</template>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="截止日">{{ formatDate(currentIssue.dueDate) }}</el-descriptions-item>
        <el-descriptions-item label="实际完成日">{{ formatDate(currentIssue.completedAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新于">{{ new Date(currentIssue.updatedAt).toLocaleString('zh-CN') }}</el-descriptions-item>
      </el-descriptions>

      <!-- 结束信息（仅已完成/已取消时显示） -->
      <el-descriptions v-if="currentIssue.status === 'closed' || currentIssue.status === 'cancelled'" title="结束信息" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="结束原因">
          <el-tag v-if="currentIssue.closeReason" size="small" type="info">
            {{ dict.getLabel('closeReason', currentIssue.closeReason) }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="确认人">{{ getUserName(currentIssue.closedBy, currentIssue.closedByName) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 独立附属功能：关联只引用 Issue，不占用 Issue 主表字段。 -->
      <section v-if="reports.length || canWriteReports" id="issue-8d" class="report-section" data-tour="issue-8d">
        <div class="section-heading">
          <div><h3>8D 报告</h3><small>附属记录 · {{ reports.length }} 份</small></div>
          <el-button v-if="canWriteReports" size="small" type="primary" plain @click="openCreateReport">新建报告</el-button>
        </div>
        <el-empty v-if="!reports.length" description="尚未关联 8D 报告" :image-size="52" />
        <el-card v-for="report in reports" :key="report.id" shadow="never" class="report-card">
          <template #header>
            <div class="report-card-head">
              <div><strong>{{ report.title }}</strong><small>更新于 {{ report.updatedAt.slice(0, 10) }} · {{ report.creatorName || '未知用户' }}</small></div>
              <span v-if="report._canModify && canWriteReports">
                <el-button link type="primary" @click="openEditReport(report)">编辑</el-button>
                <el-button link type="danger" @click="removeReport(report)">删除</el-button>
              </span>
            </div>
          </template>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="D3 临时遏制措施">{{ report.containment || '—' }}</el-descriptions-item>
            <el-descriptions-item label="D4 根本原因">{{ report.rootCause || '—' }}</el-descriptions-item>
            <el-descriptions-item label="D5-D6 永久纠正措施">{{ report.correctiveAction || '—' }}</el-descriptions-item>
          </el-descriptions>
        </el-card>
      </section>

      <div id="issue-description" class="detail-desc" v-if="currentIssue.description">
        <h4>描述</h4>
        <p>{{ currentIssue.description }}</p>
      </div>
      </div>

      <div
        class="issue-timeline-splitter"
        role="separator"
        aria-label="调整详情与点检时间线宽度"
        aria-orientation="vertical"
        :aria-valuenow="settings.issueTimelineWidth"
        tabindex="0"
        @pointerdown="startTimelineResize"
        @keydown="resizeTimelineByKeyboard"
      />

      <IssueCheckpointTimeline
        class="issue-timeline-block"
        :issue-id="issueId"
        :issue-title="currentIssue.title"
        :issue-no="currentIssue.issueNo"
        :can-create="canCreateCheckpoint"
        :can-update="canUpdateCheckpoint"
      />
    </div>

    <PushDialog
      v-if="showPush && currentIssue"
      :list-id="currentIssue.listId"
      :preselected-issue-ids="[currentIssue.id]"
      @close="showPush = false"
    />
    <EightDReportDialog
      v-if="showReportDialog"
      :initial="editingReport"
      :issue-options="reportIssueOptions"
      :default-issue-id="issueId"
      lock-relation
      @confirm="saveReport"
      @close="showReportDialog = false"
    />
    </div>
      </template>
    </PnwViewPresentationPortal>
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
  color: var(--el-text-color-secondary, #909399);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0;
  transition: background 0.15s, color 0.15s;
}
.hdr-btn-close:hover {
  background: var(--el-fill-color-light, #f5f7fa);
  color: var(--el-text-color-regular, #606266);
}
.header-right { display: flex; align-items: center; gap: 6px; }
.issue-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 8px minmax(360px, var(--issue-timeline-width, 440px));
  gap: 10px;
  align-items: start;
  min-width: 0;
}
.issue-timeline-splitter {
  position: relative;
  align-self: stretch;
  min-height: 160px;
  border: 0;
  border-radius: 4px;
  background: transparent;
  cursor: col-resize;
  outline: none;
  touch-action: none;
}
.issue-timeline-splitter::before {
  position: absolute;
  inset: 0 3px;
  border-radius: 2px;
  background: var(--el-border-color-lighter, #ebeef5);
  content: '';
  transition: background-color 0.15s;
}
.issue-timeline-splitter:hover::before,
.issue-timeline-splitter:focus-visible::before {
  background: var(--el-color-primary-light-5, #79bbff);
}
.issue-timeline-block {
  min-width: 0;
}
.detail-meta { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.issue-no { font-family: monospace; font-size: 1rem; color: var(--el-color-primary, #409eff); font-weight: 600; }
.meta-time { font-size: 0.8rem; color: var(--el-text-color-placeholder, #c0c4cc); }
.detail-desc-block { margin-top: 16px; }
.detail-desc { margin-top: 16px; padding: 12px 16px; background: var(--el-bg-color, #fff); border-radius: 8px; border: 1px solid var(--el-border-color-lighter, #ebeef5); }
.detail-desc h4 { font-size: 0.85rem; color: var(--el-text-color-secondary, #909399); margin-bottom: 6px; }
.detail-desc p { font-size: 0.9rem; color: var(--el-text-color-regular, #606266); line-height: 1.6; }
.report-section { margin-top:16px; }
.section-heading, .report-card-head { display:flex; align-items:center; justify-content:space-between; gap:12px; }
.section-heading { margin-bottom:10px; }
.section-heading h3 { margin:0; font-size:16px; }
.section-heading small, .report-card-head small { display:block; margin-top:3px; color:var(--el-text-color-secondary); }
.report-card + .report-card { margin-top:10px; }
@media (max-width: 640px) {
  .detail-meta { flex-wrap: wrap; gap: 8px; }
}
@media (max-width: 1100px) {
  .issue-workspace {
    grid-template-columns: minmax(0, 1fr);
    gap: 20px;
  }
  .issue-timeline-splitter { display: none; }
  .issue-timeline-block {
    padding-top: 18px;
    border-top: 1px solid var(--el-border-color-lighter, #ebeef5);
  }
}
.page {
  box-sizing: border-box;
  min-height: 0;
  color: var(--el-text-color-primary, #253047);
  background: var(--el-bg-color-page, #f5f7fa);
}
.issue-view-main {
  box-sizing: border-box;
  min-height: 0;
  padding: 16px;
  color: var(--el-text-color-primary, #253047);
  background: var(--el-bg-color-page, #f5f7fa);
}
</style>
