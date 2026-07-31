<script setup lang="ts">
import { onMounted, ref, computed, inject } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueStore } from '@/stores/issues'
import { getAllUsers } from '@/api/auth'
import { ElMessage } from 'element-plus'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import IssueFormDialog from '@/components/IssueFormDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'
import { useDictStore } from '@/stores/dict'
import PoiIssueDetailPrimary from '@/components/workbench/PoiIssueDetailPrimary.vue'
import PoiIssueCheckpointsSecondary from '@/components/workbench/PoiIssueCheckpointsSecondary.vue'
import { usePoiViewContribution } from '@/layout/workbench/poiViewContributions'

const dict = useDictStore()

const props = defineProps<{ issueId?: string }>()
const emit = defineEmits<{ close: []; 'checkpoint-created': [] }>()
const route = useRoute()
const router = useRouter()
const issueStore = useIssueStore()
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

const showPush = ref(false)
const showEdit = ref(false)
const allUsers = ref<any[]>([])
const canModify = computed(() => Boolean((issueStore.currentIssue as any)?._canModify))
const canPush = computed(() => Boolean((issueStore.currentIssue as any)?._canPush))

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭', cancelled: '已取消' }
const statusTag: Record<string, string | undefined> = { open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger' }
const priorityTag: Record<string, string | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }
const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }
const severityTag: Record<string, string | undefined> = { fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined }
const has8d = computed(() => Boolean(
  issueStore.currentIssue?.containment
  || issueStore.currentIssue?.rootCause
  || issueStore.currentIssue?.correctiveAction,
))
const hasDescription = computed(() => Boolean(issueStore.currentIssue?.description))

function scrollToIssueSection(sectionId: string): void {
  document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function goBack() {
  if (props.issueId) { emit('close'); return }
  router.back()
}

const issuePrimaryContributionProps = computed(() => {
  const issue = issueStore.currentIssue
  return {
    issueNo: issue?.issueNo ?? '',
    title: issue?.title ?? '',
    status: issue ? statusLabel[issue.status] ?? issue.status : '',
    priority: issue ? priorityLabel[issue.priority] ?? issue.priority : '',
    severity: issue ? dict.getLabel('severity', issue.severity) : '',
    canModify: canModify.value,
    canPush: canPush.value,
    has8d: has8d.value,
    hasDescription: hasDescription.value,
    onBack: goBack,
    onEdit: () => { showEdit.value = true },
    onPush: () => { showPush.value = true },
    onNavigateSection: scrollToIssueSection,
  }
})
const checkpointContributionProps = computed(() => ({
  issueId,
  issueTitle: issueStore.currentIssue?.title,
  issueNo: issueStore.currentIssue?.issueNo,
  canModify: canModify.value,
  onCheckpointCreated: () => emit('checkpoint-created'),
}))

usePoiViewContribution(
  () => isModal.value ? null : route.fullPath,
  {
    primary: {
      component: PoiIssueDetailPrimary,
      props: issuePrimaryContributionProps,
    },
    secondary: {
      component: PoiIssueCheckpointsSecondary,
      props: checkpointContributionProps,
    },
  },
)

onMounted(async () => {
  const [, usersResponse] = await Promise.all([
    issueStore.fetchIssue(issueId),
    getAllUsers({ includeDisabled: true }),
  ])
  allUsers.value = usersResponse.data
  // 更新标签标题
  if (!isModal.value && issueStore.currentIssue) {
    const label = issueStore.currentIssue.title.length > 16
      ? issueStore.currentIssue.title.slice(0, 16) + '…'
      : issueStore.currentIssue.title
    updateTabTitle(`issueDetail:${issueId}`, `📋 ${label}`)
  }
})

const activeUsers = computed(() => allUsers.value.filter((user: any) => !user.disabled))

function getUserName(id: string | null): string {
  if (!id) return '-'
  const user = allUsers.value.find((item: any) => item.id === id)
  return user?.displayName || user?.username || id.slice(0, 8)
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

    <div
      v-if="issueStore.currentIssue"
      class="issue-workspace"
      :class="{ 'issue-workspace--modal': isModal }"
    >
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
      <el-descriptions id="issue-basic" title="基本信息" :column="2" border size="small" class="detail-desc-block" data-tour="issue-basic">
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
      <el-descriptions id="issue-people" title="人员与日期" :column="2" border size="small" class="detail-desc-block">
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
      <el-descriptions id="issue-8d" v-if="issueStore.currentIssue.containment || issueStore.currentIssue.rootCause || issueStore.currentIssue.correctiveAction" title="8D 报告" :column="1" border size="small" class="detail-desc-block" data-tour="issue-8d">
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

      <div id="issue-description" class="detail-desc" v-if="issueStore.currentIssue.description">
        <h4>描述</h4>
        <p>{{ issueStore.currentIssue.description }}</p>
      </div>
      </div>

      <PoiIssueCheckpointsSecondary
        v-if="isModal"
        :issue-id="issueId"
        :issue-title="issueStore.currentIssue.title"
        :issue-no="issueStore.currentIssue.issueNo"
        :can-modify="canModify"
        @checkpoint-created="emit('checkpoint-created')"
      />
    </div>

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
  min-width: 0;
}
.issue-workspace--modal {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
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
@media (max-width: 640px) {
  .detail-meta { flex-wrap: wrap; gap: 8px; }
}
.page { padding: 16px; }
</style>
