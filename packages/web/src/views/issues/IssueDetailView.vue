<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueStore } from '@/stores/issues'
import { getCheckpoints, createCheckpoint, updateCheckpoint, deleteCheckpoint } from '@/api/checkpoints'
import { getAllUsers } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import CheckpointFormDialog from '@/components/CheckpointFormDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'
import type { Checkpoint } from '@phoenix-wing/open-issue-core'
import { isOverdue } from '@phoenix-wing/open-issue-core'

const route = useRoute()
const router = useRouter()
const issueStore = useIssueStore()
const issueId = route.params.id as string

const checkpoints = ref<Checkpoint[]>([])
const allUsers = ref<any[]>([])
const showCpForm = ref(false)
const showPush = ref(false)

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭', cancelled: '已取消' }
const statusTag: Record<string, string | undefined> = { open: 'info', in_progress: 'warning', resolved: 'success', closed: undefined, cancelled: 'danger' }
const priorityTag: Record<string, string | undefined> = { low: 'info', medium: 'warning', high: 'danger', critical: undefined }
const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }
const severityLabel: Record<string, string> = { fatal: '致命', major: '严重', minor: '一般', trivial: '轻微' }
const severityTag: Record<string, string | undefined> = { fatal: 'danger', major: 'warning', minor: 'info', trivial: undefined }
const categoryLabel: Record<string, string> = { appearance: '外观', dimension: '尺寸', function: '功能', process: '过程', safety: '安全', other: '其他' }
const detectionPhaseLabel: Record<string, string> = { incoming: '来料检验', in_process: '过程检验', final: '终检', customer: '客户反馈', audit: '审核发现', supplier: '供应商端' }
const closeReasonLabel: Record<string, string> = { completed: '已完成', cancelled: '已取消', duplicate: '重复', transferred: '已转交', unreproducible: '不可复现' }
const cpStatusLabel: Record<string, string> = { pending: '待处理', done: '已完成', skipped: '已跳过' }
const cpStatusColor: Record<string, string> = { pending: '#909399', done: '#67c23a', skipped: '#e6a23c' }

onMounted(async () => {
  await issueStore.fetchIssue(issueId)
  await loadCheckpoints()
  const res = await getAllUsers()
  allUsers.value = res.data
})

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
  loadCheckpoints()
}

async function onToggleStatus(cp: Checkpoint) {
  const newStatus = cp.status === 'done' ? 'pending' : 'done'
  await updateCheckpoint(cp.id, { status: newStatus })
  ElMessage.success(newStatus === 'done' ? '已标记完成' : '已标记待处理')
  loadCheckpoints()
}

async function onDeleteCp(id: string) {
  await ElMessageBox.confirm('确定删除此点检项？', '确认', { type: 'warning' })
  await deleteCheckpoint(id)
  ElMessage.success('已删除')
  loadCheckpoints()
}

function formatDate(d: string | null): string {
  if (!d) return '—'
  return d.slice(0, 10)
}

function goBack() {
  router.back()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <el-button link @click="goBack"><el-icon><ArrowLeft /></el-icon> 返回</el-button>
        <h2 v-if="issueStore.currentIssue">{{ issueStore.currentIssue.title }}</h2>
      </div>
      <el-button v-if="issueStore.currentIssue" type="warning" size="small" @click="showPush = true">
        <el-icon><Promotion /></el-icon> 推送
      </el-button>
    </div>

    <div v-if="issueStore.currentIssue" class="issue-detail">
      <div class="detail-meta">
        <span class="issue-no">{{ issueStore.currentIssue.issueNo }}</span>
        <el-tag :type="statusTag[issueStore.currentIssue.status]">
          {{ statusLabel[issueStore.currentIssue.status] }}
        </el-tag>
        <span class="meta-time">创建于 {{ new Date(issueStore.currentIssue.createdAt).toLocaleString('zh-CN') }}</span>
      </div>

      <!-- 基本信息 -->
      <el-descriptions title="基本信息" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="严重度">
          <el-tag :type="severityTag[issueStore.currentIssue.severity]" size="small" effect="dark">
            {{ severityLabel[issueStore.currentIssue.severity] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="优先级">
          <el-tag :type="priorityTag[issueStore.currentIssue.priority]" size="small">
            {{ priorityLabel[issueStore.currentIssue.priority] }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="问题分类">
          {{ categoryLabel[issueStore.currentIssue.category] || '—' }}
        </el-descriptions-item>
        <el-descriptions-item label="发现阶段">
          {{ detectionPhaseLabel[issueStore.currentIssue.detectionPhase] || '—' }}
        </el-descriptions-item>
      </el-descriptions>

      <!-- 人员与日期 -->
      <el-descriptions title="人员与日期" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="提出人">{{ getUserName(issueStore.currentIssue.reporterId) }}</el-descriptions-item>
        <el-descriptions-item label="责任人">
          <el-tag v-if="issueStore.currentIssue.assigneeId" size="small" type="warning" effect="plain">
            {{ getUserName(issueStore.currentIssue.assigneeId) }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="录入人">{{ getUserName(issueStore.currentIssue.createdBy) }}</el-descriptions-item>
        <el-descriptions-item label="计划完成日">{{ formatDate(issueStore.currentIssue.dueDate) }}</el-descriptions-item>
        <el-descriptions-item label="实际完成日">{{ formatDate(issueStore.currentIssue.completedAt) }}</el-descriptions-item>
        <el-descriptions-item label="更新于">{{ new Date(issueStore.currentIssue.updatedAt).toLocaleString('zh-CN') }}</el-descriptions-item>
      </el-descriptions>

      <!-- 关闭信息（仅已关闭/已取消时显示） -->
      <el-descriptions v-if="issueStore.currentIssue.status === 'closed' || issueStore.currentIssue.status === 'cancelled'" title="关闭信息" :column="2" border size="small" class="detail-desc-block">
        <el-descriptions-item label="关闭理由">
          <el-tag v-if="issueStore.currentIssue.closeReason" size="small" type="info">
            {{ closeReasonLabel[issueStore.currentIssue.closeReason] || issueStore.currentIssue.closeReason }}
          </el-tag>
          <span v-else>—</span>
        </el-descriptions-item>
        <el-descriptions-item label="关闭确认人">{{ getUserName(issueStore.currentIssue.closedBy) }}</el-descriptions-item>
      </el-descriptions>

      <!-- 8D 报告（仅填写后显示） -->
      <el-descriptions v-if="issueStore.currentIssue.containment || issueStore.currentIssue.rootCause || issueStore.currentIssue.correctiveAction" title="8D 报告" :column="1" border size="small" class="detail-desc-block">
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
    <div class="checkpoints-section">
      <div class="section-head">
        <h3>点检时间线</h3>
        <el-button type="primary" size="small" @click="showCpForm = true"><el-icon><Plus /></el-icon> 添加点检</el-button>
      </div>

      <el-empty v-if="!checkpoints.length" description="暂无点检项" />

      <el-timeline v-else>
        <el-timeline-item
          v-for="cp in checkpoints" :key="cp.id"
          :timestamp="cp.checkpointDate"
          :color="cpStatusColor[cp.status]"
          placement="top"
        >
          <div class="cp-card" :class="getCheckpointClass(cp)">
            <div class="cp-header">
              <el-tag :type="cp.status === 'done' ? 'success' : cp.status === 'skipped' ? 'warning' : 'info'" size="small">
                {{ cpStatusLabel[cp.status] }}
              </el-tag>
              <span class="cp-responsible">负责人: {{ getUserName(cp.responsibleUserId) }}</span>
            </div>
            <p class="cp-desc">{{ cp.description }}</p>
            <div class="cp-actions">
              <el-button link size="small" @click="onToggleStatus(cp)">
                {{ cp.status === 'done' ? '取消完成' : '标记完成' }}
              </el-button>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
    </div>

    <CheckpointFormDialog
      v-if="showCpForm"
      :users="allUsers"
      @confirm="onCreateCp"
      @close="showCpForm = false"
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
.page-head { display: flex; justify-content: space-between; align-items: flex-start; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; margin-top: 4px; }
.detail-meta { display: flex; gap: 12px; align-items: center; margin-top: 8px; }
.issue-no { font-family: monospace; font-size: 1rem; color: #409eff; font-weight: 600; }
.meta-time { font-size: 0.8rem; color: #c0c4cc; }
.detail-desc-block { margin-top: 16px; }
.detail-desc { margin-top: 16px; padding: 12px 16px; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; }
.detail-desc h4 { font-size: 0.85rem; color: #909399; margin-bottom: 6px; }
.detail-desc p { font-size: 0.9rem; color: #606266; line-height: 1.6; }
.checkpoints-section { margin-top: 24px; }
.section-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.section-head h3 { font-size: 1.1rem; font-weight: 650; }
.cp-card { background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #ebeef5; }
.cp-header { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.cp-responsible { font-size: 0.78rem; color: #909399; }
.cp-desc { font-size: 0.9rem; color: #303133; margin-bottom: 8px; }
.cp-actions { display: flex; gap: 8px; }
</style>
