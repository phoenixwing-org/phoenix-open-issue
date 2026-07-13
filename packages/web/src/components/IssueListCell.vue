<script setup lang="ts">
import { inject, computed } from 'vue'
import type { IssueColumnKey } from '@/config/issueListColumns'
import type { Checkpoint } from '@open-issue/core'
import { ATTENTION_LEVEL_LABELS, isOverdue } from '@open-issue/core'
import CheckpointStatusTag from '@/components/CheckpointStatusTag.vue'

const props = defineProps<{
  columnKey: IssueColumnKey
  row: Record<string, any> & { id: string; title: string }
}>()

const ctx = inject<{
  dict: { getLabel: (g: string, v: string) => string }
  userMap: Record<string, string>
  severityTag: Record<string, string | undefined>
  priorityLabel: Record<string, string>
  priorityTag: Record<string, string | undefined>
  statusLabel: Record<string, string>
  statusTag: Record<string, string | undefined>
  linkAttention: (row: any) => number
  formatDate: (d: string | null) => string
  formatCpDate: (d: string) => string
  getRecentCheckpoints: (id: string) => Checkpoint[]
  checkpointMap: Record<string, Checkpoint[]>
  maxTimelineRows: number
  openViewIssue: (row: { id: string }, e?: Event) => void
  openQuickEdit: (row: any, field: string, e?: Event) => void
  openEditCheckpoint: (cp: Checkpoint, issueTitle: string, e?: Event) => void
  openCreateCheckpoint: (row: { id: string; title: string; issueNo?: string }, e?: Event) => void
  onUpdateCheckpointStatus: (cp: Checkpoint, status: Checkpoint['status']) => void
}>('issueListCellCtx')!

const col = computed(() => props.columnKey)
const row = computed(() => props.row)
</script>

<template>
  <!-- issueNo -->
  <span
    v-if="col === 'issueNo'"
    class="cell-link cell-mono"
    title="点击查看"
    @click="ctx.openViewIssue(row, $event)"
  >{{ row.issueNo }}</span>

  <!-- severity -->
  <el-tag
    v-else-if="col === 'severity'"
    class="cell-editable-tag"
    :type="ctx.severityTag[row.severity]"
    size="small"
    effect="dark"
    @click="ctx.openQuickEdit(row, 'severity', $event)"
  >{{ ctx.dict.getLabel('severity', row.severity) || row.severity }}</el-tag>

  <!-- priority -->
  <el-tag
    v-else-if="col === 'priority'"
    class="cell-editable-tag"
    :type="ctx.priorityTag[row.priority]"
    size="small"
    @click="ctx.openQuickEdit(row, 'priority', $event)"
  >{{ ctx.priorityLabel[row.priority] || row.priority }}</el-tag>

  <!-- category -->
  <template v-else-if="col === 'category'">
    <el-tag
      v-if="row.category"
      class="cell-editable-tag"
      type="info"
      size="small"
      @click="ctx.openQuickEdit(row, 'category', $event)"
    >{{ ctx.dict.getLabel('issueCategory', row.category) || row.category }}</el-tag>
    <span
      v-else
      class="cell-editable cell-na"
      title="点击设置"
      @click="ctx.openQuickEdit(row, 'category', $event)"
    >—</span>
  </template>

  <!-- detectionPhase -->
  <template v-else-if="col === 'detectionPhase'">
    <el-tag
      v-if="row.detectionPhase"
      class="cell-editable-tag"
      type="info"
      size="small"
      effect="plain"
      @click="ctx.openQuickEdit(row, 'detectionPhase', $event)"
    >{{ ctx.dict.getLabel('detectionPhase', row.detectionPhase) || row.detectionPhase }}</el-tag>
    <span
      v-else
      class="cell-editable cell-na"
      title="点击设置"
      @click="ctx.openQuickEdit(row, 'detectionPhase', $event)"
    >—</span>
  </template>

  <!-- function -->
  <template v-else-if="col === 'function'">
    <span
      v-if="row._functionName"
      class="cell-editable cell-text"
      title="点击修改"
      @click="ctx.openQuickEdit(row, 'function', $event)"
    >{{ row._functionName }}</span>
    <span
      v-else
      class="cell-editable cell-na"
      title="点击关联功能"
      @click="ctx.openQuickEdit(row, 'function', $event)"
    >—</span>
  </template>

  <!-- reporter -->
  <template v-else-if="col === 'reporter'">
    <span v-if="row.reporterId && ctx.userMap[row.reporterId]">👤{{ ctx.userMap[row.reporterId] }}</span>
    <span v-else class="cell-na">—</span>
  </template>

  <!-- assignee -->
  <template v-else-if="col === 'assignee'">
    <span
      v-if="row.assigneeId && ctx.userMap[row.assigneeId]"
      class="cell-editable"
      title="点击修改"
      @click="ctx.openQuickEdit(row, 'assignee', $event)"
    >👤{{ ctx.userMap[row.assigneeId] }}</span>
    <span
      v-else
      class="cell-editable cell-na"
      title="点击指定"
      @click="ctx.openQuickEdit(row, 'assignee', $event)"
    >—</span>
  </template>

  <!-- dueDate -->
  <template v-else-if="col === 'dueDate'">{{ ctx.formatDate(row.dueDate) }}</template>

  <!-- attention -->
  <template v-else-if="col === 'attention'">
    <el-tag
      v-if="ctx.linkAttention(row) === 0"
      class="cell-editable-tag"
      type="info"
      size="small"
      @click="ctx.openQuickEdit(row, 'attention', $event)"
    >不关注</el-tag>
    <el-tag
      v-else
      class="cell-editable-tag"
      :type="ctx.linkAttention(row) >= 4 ? 'danger' : ctx.linkAttention(row) >= 3 ? 'warning' : 'success'"
      size="small"
      @click="ctx.openQuickEdit(row, 'attention', $event)"
    >{{ ATTENTION_LEVEL_LABELS[ctx.linkAttention(row) as 0|1|2|3|4|5] }}</el-tag>
  </template>

  <!-- status -->
  <el-tag
    v-else-if="col === 'status'"
    class="cell-editable-tag"
    :type="ctx.statusTag[row.status]"
    size="small"
    @click="ctx.openQuickEdit(row, 'status', $event)"
  >{{ ctx.statusLabel[row.status] || row.status }}</el-tag>

  <!-- createdAt -->
  <span v-else-if="col === 'createdAt'" class="cell-date">{{ ctx.formatCpDate(row.createdAt) }}</span>

  <!-- checkpoints -->
  <div v-else-if="col === 'checkpoints'" class="cp-mini-list">
    <div
      v-for="cp in ctx.getRecentCheckpoints(row.id)"
      :key="cp.id"
      class="cp-mini-item cp-editable"
      :class="{ 'cp-overdue': isOverdue(cp.checkpointDate, cp.status).overdue }"
      title="点击编辑点检"
      @click="ctx.openEditCheckpoint(cp, row.title, $event)"
    >
      <CheckpointStatusTag
        class="cp-mini-icon"
        :status="cp.status"
        compact
        :overdue="isOverdue(cp.checkpointDate, cp.status).overdue"
        @change="ctx.onUpdateCheckpointStatus(cp, $event)"
      />
      <span class="cp-mini-date" :title="'点检日: ' + cp.checkpointDate">{{ ctx.formatCpDate(cp.checkpointDate) }}</span>
      <span class="cp-mini-desc">{{ cp.description }}</span>
      <span v-if="cp.responsibleUserId" class="cp-mini-who">{{ ctx.userMap[cp.responsibleUserId] || '' }}</span>
    </div>
    <div v-if="ctx.getRecentCheckpoints(row.id).length === 0" class="cp-mini-empty">暂无点检记录</div>
    <div v-if="(ctx.checkpointMap[row.id]?.length || 0) > ctx.maxTimelineRows" class="cp-mini-more">
      … 共 {{ ctx.checkpointMap[row.id].length }} 条
    </div>
    <button class="cp-mini-add" type="button" title="添加点检" @click.stop="ctx.openCreateCheckpoint(row, $event)">+</button>
  </div>
</template>

<style scoped>
.cell-text { font-size: 0.85rem; }
.cell-link { cursor: pointer; border-radius: 2px; }
.cell-link:hover { color: #409eff; text-decoration: underline; text-underline-offset: 2px; }
.cell-editable { cursor: pointer; border-radius: 2px; }
.cell-editable:hover { color: #409eff; text-decoration: underline; text-underline-offset: 2px; }
.cell-editable-tag { cursor: pointer; }
.cell-editable-tag:hover { opacity: 0.85; outline: 1px dashed #409eff; }
.cell-mono { font-family: monospace; font-size: 0.8rem; }
.cell-na { color: #c0c4cc; }
.cell-editable.cell-na:hover { color: #909399; }
.cell-date { font-family: monospace; font-size: 0.8rem; color: #909399; }
.cp-mini-list { font-size: 0.8rem; line-height: 1.6; position: relative; padding-bottom: 18px; }
.cp-mini-item { display: flex; gap: 6px; align-items: baseline; padding: 1px 0; }
.cp-mini-item.cp-editable { cursor: pointer; border-radius: 2px; }
.cp-mini-item.cp-editable:hover { background: #ecf5ff; }
.cp-mini-item.cp-overdue { margin: 0 -4px; background: #fef0f0; border-radius: 2px; padding: 1px 4px; }
.cp-mini-item.cp-overdue.cp-editable:hover { background: #fde2e2; }
.cp-mini-icon { flex-shrink: 0; font-size: 0.75rem; }
.cp-mini-date { flex-shrink: 0; color: #909399; font-family: monospace; font-size: 0.75rem; }
.cp-mini-desc { flex: 1; color: #303133; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cp-mini-who { flex-shrink: 0; color: #c0c4cc; font-size: 0.7rem; }
.cp-mini-empty { color: #c0c4cc; font-style: italic; }
.cp-mini-more {
  position: absolute; bottom: -3px; right: 26px; color: #909399;
  background: #f0f2f5; font-size: 0.62rem; padding: 1px 6px; border-radius: 10px;
}
.cp-mini-add {
  position: absolute; bottom: -3px; right: 4px;
  display: grid; place-items: center;
  width: 18px; height: 18px; padding: 0;
  color: #409eff; background: #ecf5ff; border: 1px solid #b3d8ff; border-radius: 9px;
  cursor: pointer; font-size: 15px; line-height: 1;
}
.cp-mini-add:hover { color: #fff; background: #409eff; border-color: #409eff; }
</style>
