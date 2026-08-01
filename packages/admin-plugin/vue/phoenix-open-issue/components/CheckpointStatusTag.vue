<script setup lang="ts">
import type { CheckpointStatus } from '/$/phoenix-open-issue/core'

const props = withDefaults(defineProps<{
  status: CheckpointStatus
  compact?: boolean
  overdue?: boolean
  disabled?: boolean
}>(), {
  compact: false,
  overdue: false,
  disabled: false,
})

const emit = defineEmits<{ change: [status: CheckpointStatus] }>()

const labels: Record<CheckpointStatus, string> = {
  pending: '待处理',
  done: '已完成',
  skipped: '已跳过',
  voided: '已作废',
}

type TagType = 'primary' | 'success' | 'warning' | 'danger' | 'info'

const tagTypes: Record<CheckpointStatus, TagType> = {
  pending: 'info',
  done: 'success',
  skipped: 'warning',
  voided: 'danger',
}

function compactLabel() {
  if (props.overdue && props.status === 'pending') return '⚠'
  return { pending: '⏳', done: '✓', skipped: '—', voided: '×' }[props.status]
}
</script>

<template>
  <el-dropdown
    :disabled="props.disabled"
    trigger="click"
    :popper-style="{ zIndex: 9101 }"
    @command="(status: CheckpointStatus) => emit('change', status)"
  >
    <span class="checkpoint-status-trigger" :title="props.disabled ? labels[props.status] : `${labels[props.status]}，点击修改`" @click.stop>
      <el-tag
        :type="props.overdue && props.status === 'pending' ? 'danger' : tagTypes[props.status]"
        :class="['checkpoint-status-tag', { 'is-compact': props.compact, 'is-disabled': props.disabled }]"
        size="small"
      >{{ props.compact ? compactLabel() : labels[props.status] }}</el-tag>
    </span>
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
.checkpoint-status-tag.is-disabled { cursor: default; }
.checkpoint-status-tag.is-disabled:hover { opacity: 1; outline: 0; }
.checkpoint-status-tag.is-compact {
  box-sizing: border-box;
  display: inline-flex;
  width: 32px;
  height: 32px;
  padding: 0;
  align-items: center;
  justify-content: center;
  line-height: 1;
  text-align: center;
}
.checkpoint-status-trigger { display: inline-flex; }
</style>
