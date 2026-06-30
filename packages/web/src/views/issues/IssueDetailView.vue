<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueStore } from '@/stores/issues'
import { getCheckpoints, createCheckpoint, updateCheckpoint, deleteCheckpoint } from '@/api/checkpoints'
import { getAllUsers } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import CheckpointFormDialog from '@/components/CheckpointFormDialog.vue'
import type { Checkpoint } from '@phoenix-wing/open-issue-core'
import { isOverdue } from '@phoenix-wing/open-issue-core'

const route = useRoute()
const router = useRouter()
const issueStore = useIssueStore()
const issueId = route.params.id as string

const checkpoints = ref<Checkpoint[]>([])
const allUsers = ref<any[]>([])
const showCpForm = ref(false)

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭' }
const statusTag: Record<string, string> = { open: '', in_progress: 'warning', resolved: 'success', closed: 'info' }
const priorityTag: Record<string, string> = { low: 'info', medium: '', high: 'warning', critical: 'danger' }
const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }
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
  return u?.display_name || u?.username || id.slice(0, 8)
}

function getCheckpointClass(cp: Checkpoint) {
  const { overdue } = isOverdue(cp.checkpoint_date, cp.status)
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
    </div>

    <div v-if="issueStore.currentIssue" class="issue-detail">
      <div class="detail-meta">
        <el-tag :type="statusTag[issueStore.currentIssue.status]">
          {{ statusLabel[issueStore.currentIssue.status] }}
        </el-tag>
        <el-tag :type="priorityTag[issueStore.currentIssue.priority]">
          优先级: {{ priorityLabel[issueStore.currentIssue.priority] }}
        </el-tag>
        <span class="meta-time">创建于 {{ new Date(issueStore.currentIssue.created_at).toLocaleString('zh-CN') }}</span>
      </div>

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
          :timestamp="cp.checkpoint_date"
          :color="cpStatusColor[cp.status]"
          placement="top"
        >
          <div class="cp-card" :class="getCheckpointClass(cp)">
            <div class="cp-header">
              <el-tag :type="cp.status === 'done' ? 'success' : cp.status === 'skipped' ? 'warning' : 'info'" size="small">
                {{ cpStatusLabel[cp.status] }}
              </el-tag>
              <span class="cp-responsible">负责人: {{ getUserName(cp.responsible_user_id) }}</span>
            </div>
            <p class="cp-desc">{{ cp.description }}</p>
            <div class="cp-actions">
              <el-button link size="small" @click="onToggleStatus(cp)">
                {{ cp.status === 'done' ? '取消完成' : '标记完成' }}
              </el-button>
              <el-button link size="small" type="danger" @click="onDeleteCp(cp.id)">删除</el-button>
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
  </div>
</template>

<style scoped>
.page-head h2 { font-size: 1.3rem; font-weight: 650; margin-top: 4px; }
.detail-meta { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
.meta-time { font-size: 0.8rem; color: #c0c4cc; }
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
