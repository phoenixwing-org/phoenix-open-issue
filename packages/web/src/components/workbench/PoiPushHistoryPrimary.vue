<script setup lang="ts">
type PoiPushStatus = 'all' | 'pending' | 'accepted' | 'rejected'

defineProps<{
  status: PoiPushStatus
  counts: Readonly<Record<PoiPushStatus, number>>
  loading: boolean
  onSelectStatus: (status: PoiPushStatus) => void
  onRefresh: () => void
}>()

const STATUS_OPTIONS: readonly { value: PoiPushStatus; label: string }[] = [
  { value: 'all', label: '全部记录' },
  { value: 'pending', label: '待审批' },
  { value: 'accepted', label: '已接受' },
  { value: 'rejected', label: '已拒绝' },
]
</script>

<template>
  <aside class="poi-push-primary" aria-label="推送历史筛选">
    <strong>推送状态</strong>
    <button
      v-for="option in STATUS_OPTIONS"
      :key="option.value"
      type="button"
      :class="{ 'is-active': status === option.value }"
      @click="onSelectStatus(option.value)"
    >
      <span>{{ option.label }}</span>
      <em>{{ counts[option.value] }}</em>
    </button>
    <el-button size="small" plain :loading="loading" @click="onRefresh">刷新记录</el-button>
  </aside>
</template>

<style scoped>
.poi-push-primary {
  display: grid;
  align-content: start;
  gap: 6px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-push-primary strong {
  margin-bottom: 3px;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  font-size: 12px;
}
.poi-push-primary > button {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-push-primary > button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff)); }
.poi-push-primary > button.is-active {
  background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9, #dbeafe));
  color: var(--pnw-control-active-text, var(--el-color-primary, #2563eb));
  font-weight: 600;
}
.poi-push-primary em { font-style: normal; font-variant-numeric: tabular-nums; }
.poi-push-primary :deep(.el-button) { margin-top: 8px; }
</style>
