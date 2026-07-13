<script setup lang="ts">
import type { CheckpointStatus } from '@open-issue/core'

const props = withDefaults(defineProps<{
  status: CheckpointStatus
  compact?: boolean
  overdue?: boolean
}>(), {
  compact: false,
  overdue: false,
})

const emit = defineEmits<{ change: [status: CheckpointStatus] }>()

const labels: Record<CheckpointStatus, string> = {
  pending: '待处理',
  done: '已完成',
  skipped: '已跳过',
}

const tagTypes: Record<CheckpointStatus, string | undefined> = {
  pending: 'info',
  done: 'success',
  skipped: 'warning',
}

function compactLabel() {
  if (props.overdue && props.status === 'pending') return '⚠'
  return { pending: '⏳', done: '✓', skipped: '—' }[props.status]
}
</script>

<template>
  <el-dropdown trigger="click" @command="(status: CheckpointStatus) => emit('change', status)">
    <el-tooltip :content="`${labels[props.status]}，点击修改`" placement="top">
      <el-tag
        :type="props.overdue && props.status === 'pending' ? 'danger' : tagTypes[props.status]"
        :class="['checkpoint-status-tag', { 'is-compact': props.compact }]"
        size="small"
        @click.stop
      >{{ props.compact ? compactLabel() : labels[props.status] }}</el-tag>
    </el-tooltip>
    <template #dropdown>
      <el-dropdown-menu>
        <el-dropdown-item v-for="(_, status) in labels" :key="status" :command="status">
          {{ labels[status as CheckpointStatus] }}
        </el-dropdown-item>
      </el-dropdown-menu>
    </template>
  </el-dropdown>
</template>

<style scoped>
.checkpoint-status-tag { cursor: pointer; user-select: none; }
.checkpoint-status-tag:hover { opacity: 0.8; outline: 1px dashed currentColor; }
.checkpoint-status-tag.is-compact { min-width: 18px; padding: 0 4px; text-align: center; }
</style>
