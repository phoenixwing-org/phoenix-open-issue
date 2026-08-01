<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { Checkpoint, CheckpointStatus } from '/$/phoenix-open-issue/core'
import { isOverdue } from '/$/phoenix-open-issue/core'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import { createCheckpoint, getCheckpoints, updateCheckpoint } from '/$/phoenix-open-issue/api/checkpoints'
import { useSettingsStore } from '/$/phoenix-open-issue/stores/settings'
import CheckpointFormDialog from '/$/phoenix-open-issue/components/CheckpointFormDialog.vue'
import CheckpointStatusTag from '/$/phoenix-open-issue/components/CheckpointStatusTag.vue'

const props = defineProps<{
  issueId: string
  issueTitle?: string
  issueNo?: string
  canModify: boolean
}>()

const emit = defineEmits<{
  checkpointCreated: []
}>()

const settings = useSettingsStore()
const checkpoints = ref<Checkpoint[]>([])
const allUsers = ref<any[]>([])
const showCreate = ref(false)
const editCheckpoint = ref<Checkpoint | null>(null)

const statusLabel: Record<string, string> = {
  pending: '待处理',
  done: '已完成',
  skipped: '已跳过',
  voided: '已作废',
}
const statusColor: Record<string, string> = {
  pending: '#909399',
  done: '#67c23a',
  skipped: '#e6a23c',
  voided: '#f56c6c',
}

const activeUsers = computed(() => allUsers.value.filter((user: any) => !user.disabled))
const sortedCheckpoints = computed(() => {
  const direction = settings.checkpointTimelineOrder === 'desc' ? -1 : 1
  return [...checkpoints.value].sort((a, b) => {
    const date = a.checkpointDate.localeCompare(b.checkpointDate)
    if (date !== 0) return date * direction
    return (a.sortOrder - b.sortOrder) * direction
  })
})

watch(
  () => props.issueId,
  async () => {
    const [checkpointResponse, usersResponse] = await Promise.all([
      getCheckpoints(props.issueId),
      getAllUsers({ includeDisabled: true }),
    ])
    checkpoints.value = checkpointResponse.data
    allUsers.value = usersResponse.data
  },
  { immediate: true },
)

function getUserName(id: string | null): string {
  if (!id) return '—'
  const user = allUsers.value.find((item: any) => item.id === id)
  return user?.displayName || user?.username || id.slice(0, 8)
}

function checkpointOverdue(checkpoint: Checkpoint): boolean {
  return isOverdue(checkpoint.deadline, checkpoint.status).overdue
}

function openEdit(checkpoint: Checkpoint): void {
  if (props.canModify) editCheckpoint.value = checkpoint
}

async function reload(): Promise<void> {
  const response = await getCheckpoints(props.issueId)
  checkpoints.value = response.data
}

async function onCreate(data: {
  checkpointDate: string
  deadline: string | null
  description: string
  responsibleUserId?: string
}): Promise<void> {
  await createCheckpoint(props.issueId, data)
  showCreate.value = false
  ElMessage.success('点检项已添加')
  await reload()
  emit('checkpointCreated')
}

async function onEdit(data: {
  checkpointDate: string
  deadline: string | null
  description: string
  responsibleUserId?: string
  status?: CheckpointStatus
}): Promise<void> {
  if (!editCheckpoint.value) return
  await updateCheckpoint(editCheckpoint.value.id, data)
  editCheckpoint.value = null
  ElMessage.success('点检已更新')
  await reload()
  emit('checkpointCreated')
}

async function onChangeStatus(checkpoint: Checkpoint, status: CheckpointStatus): Promise<void> {
  if (!props.canModify || checkpoint.status === status) return
  await updateCheckpoint(checkpoint.id, { status })
  ElMessage.success(`点检已更新为${statusLabel[status]}`)
  await reload()
  emit('checkpointCreated')
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')
}

async function copyTimelineTable(): Promise<void> {
  const rows = sortedCheckpoints.value.map(checkpoint =>
    `| ${checkpoint.deadline || '—'} | ${statusLabel[checkpoint.status]} | ${escapeCell(checkpoint.description)} | ${escapeCell(getUserName(checkpoint.responsibleUserId))} | ${checkpoint.checkpointDate} |`,
  )
  const text = [
    `## ${props.issueNo ?? ''} ${props.issueTitle ?? ''}`.trim(),
    '',
    '| 截止 | 状态 | 内容 | 负责人 | 点检日 |',
    '| --- | --- | --- | --- | --- |',
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
</script>

<template>
  <section class="issue-checkpoint-timeline" data-tour="issue-checkpoints">
    <div class="poi-checkpoints-head">
      <strong>点检 · 时间线</strong>
      <div class="poi-checkpoints-actions">
        <el-tooltip
          :content="settings.checkpointTimelineOrder === 'desc' ? '当前：最新优先' : '当前：最早优先'"
          placement="top"
        >
          <el-button
            size="small"
            circle
            aria-label="切换时间线排序"
            @click="settings.checkpointTimelineOrder = settings.checkpointTimelineOrder === 'desc' ? 'asc' : 'desc'"
          >
            <el-icon><Sort /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="复制时间线表格" placement="top">
          <el-button size="small" circle aria-label="复制时间线表格" @click="copyTimelineTable">
            <el-icon><DocumentCopy /></el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip v-if="canModify" content="添加点检" placement="top">
          <el-button size="small" type="success" circle aria-label="添加点检" @click="showCreate = true">
            <el-icon><Plus /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <el-radio-group
      v-model="settings.checkpointTimelineDisplay"
      size="small"
      aria-label="时间线显示形式"
    >
      <el-radio-button value="cards">卡片</el-radio-button>
      <el-radio-button value="table">表格</el-radio-button>
    </el-radio-group>

    <el-empty v-if="!checkpoints.length" description="暂无点检项" :image-size="54" />

    <el-timeline v-else-if="settings.checkpointTimelineDisplay === 'cards'" class="poi-checkpoint-timeline">
      <el-timeline-item
        v-for="checkpoint in sortedCheckpoints"
        :key="checkpoint.id"
        :color="statusColor[checkpoint.status]"
        :hide-timestamp="true"
      >
        <div class="checkpoint-date-row">
          <strong>截止 {{ checkpoint.deadline || '—' }}</strong>
          <span>点检 {{ checkpoint.checkpointDate }}</span>
        </div>
        <div
          class="poi-checkpoint-card"
          :class="{ 'is-overdue': checkpointOverdue(checkpoint), 'is-editable': canModify }"
          @click="openEdit(checkpoint)"
        >
          <div class="checkpoint-card-meta">
            <CheckpointStatusTag
              :status="checkpoint.status"
              :overdue="checkpointOverdue(checkpoint)"
              :disabled="!canModify"
              @change="onChangeStatus(checkpoint, $event)"
            />
            <span class="checkpoint-owner" :title="`负责人：${getUserName(checkpoint.responsibleUserId)}`">
              <span class="checkpoint-owner-label">负责人：</span>
              <span class="checkpoint-owner-name">{{ getUserName(checkpoint.responsibleUserId) }}</span>
            </span>
          </div>
          <p>{{ checkpoint.description }}</p>
        </div>
      </el-timeline-item>
    </el-timeline>

    <el-table v-else :data="sortedCheckpoints" size="small" class="poi-checkpoint-table">
      <el-table-column label="截止" width="98">
        <template #default="{ row }">{{ row.deadline || '—' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="76">
        <template #default="{ row }">
          <CheckpointStatusTag
            :status="row.status"
            :overdue="checkpointOverdue(row)"
            :disabled="!canModify"
            @change="onChangeStatus(row, $event)"
          />
        </template>
      </el-table-column>
      <el-table-column prop="description" label="内容" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">
          <span :class="{ 'is-editable-text': canModify }" @click="openEdit(row)">
            {{ row.description }}
          </span>
        </template>
      </el-table-column>
      <el-table-column label="负责人" min-width="84" show-overflow-tooltip>
        <template #default="{ row }">
          <span :title="getUserName(row.responsibleUserId)">
            {{ getUserName(row.responsibleUserId) }}
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="checkpointDate" label="点检日" width="98">
        <template #default="{ row }">
          <span class="checkpoint-date-secondary" :title="row.checkpointDate">
            {{ row.checkpointDate }}
          </span>
        </template>
      </el-table-column>
    </el-table>

    <CheckpointFormDialog
      v-if="showCreate"
      :users="activeUsers"
      :issue-title="issueTitle"
      :issue-no="issueNo"
      @confirm="onCreate"
      @close="showCreate = false"
    />
    <CheckpointFormDialog
      v-if="editCheckpoint"
      :users="activeUsers"
      :initial="editCheckpoint"
      :issue-title="issueTitle"
      :issue-no="issueNo"
      @confirm="onEdit"
      @close="editCheckpoint = null"
    />
  </section>
</template>

<style scoped>
.issue-checkpoint-timeline {
  min-width: 0;
  height: 100%;
  overflow: auto;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 12px;
}
.poi-checkpoints-head,
.poi-checkpoints-actions,
.poi-checkpoint-card > div {
  display: flex;
  align-items: center;
  gap: 6px;
}
.poi-checkpoints-head {
  justify-content: space-between;
}
.poi-checkpoint-timeline {
  padding: 4px 4px 0;
}
.poi-checkpoint-timeline :deep(.el-timeline-item) {
  padding-bottom: 8px;
}
.poi-checkpoint-card {
  padding: 7px 9px;
  border: 1px solid var(--el-border-color);
  border-radius: 7px;
  background: var(--el-bg-color);
}
.poi-checkpoint-card.is-editable {
  cursor: pointer;
}
.poi-checkpoint-card.is-editable:hover {
  border-color: var(--el-color-primary-light-5);
}
.poi-checkpoint-card > div span {
  color: var(--pnw-workbench-muted, #64748b);
  font-size: 12px;
}
.checkpoint-card-meta {
  min-width: 0;
}
.checkpoint-owner {
  min-width: 0;
  margin-left: auto;
  display: inline-grid;
  grid-template-columns: auto 4em;
  align-items: center;
  text-align: left;
}
.checkpoint-owner-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-checkpoint-card p {
  margin: 4px 0 0;
  line-height: 1.35;
  white-space: pre-wrap;
}
.checkpoint-date-secondary {
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #909399));
  font-size: 11px;
}
.checkpoint-date-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #909399));
  font-size: 12px;
}
.checkpoint-date-row strong {
  color: var(--el-text-color-primary, #303133);
  font-weight: 600;
}
.is-editable-text {
  cursor: pointer;
}
.is-editable-text:hover {
  color: var(--el-color-primary);
}
</style>
