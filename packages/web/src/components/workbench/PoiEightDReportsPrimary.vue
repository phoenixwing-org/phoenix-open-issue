<script setup lang="ts">
type RelationFilter = 'all' | 'linked' | 'standalone'

defineProps<{
  filter: RelationFilter
  counts: Readonly<Record<RelationFilter, number>>
  canCreate: boolean
  onSelectFilter: (filter: RelationFilter) => void
  onCreate: () => void
}>()

const options: readonly { value: RelationFilter; label: string }[] = [
  { value: 'all', label: '全部报告' },
  { value: 'linked', label: '已关联 Issue' },
  { value: 'standalone', label: '独立报告' },
]
</script>

<template>
  <aside class="report-primary" aria-label="8D 报告筛选">
    <strong>关联状态</strong>
    <button v-for="option in options" :key="option.value" type="button" :class="{ 'is-active': filter === option.value }" @click="onSelectFilter(option.value)">
      <span>{{ option.label }}</span><em>{{ counts[option.value] }}</em>
    </button>
    <el-button v-if="canCreate" type="primary" size="small" @click="onCreate">新建 8D 报告</el-button>
  </aside>
</template>

<style scoped>
.report-primary { display:grid; align-content:start; gap:6px; padding:14px; color:var(--pnw-workbench-text, var(--el-text-color-primary)); }
.report-primary strong { margin-bottom:3px; color:var(--pnw-workbench-muted, var(--el-text-color-secondary)); font-size:12px; }
.report-primary > button { display:flex; justify-content:space-between; gap:8px; padding:8px 10px; border:0; border-radius:6px; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.report-primary > button:hover { background:var(--pnw-workbench-hover-bg, var(--el-fill-color-light)); }
.report-primary > button.is-active { background:var(--pnw-workbench-active-bg, var(--el-color-primary-light-9)); color:var(--pnw-control-active-text, var(--el-color-primary)); font-weight:600; }
.report-primary em { font-style:normal; font-variant-numeric:tabular-nums; }
.report-primary :deep(.el-button) { margin-top:8px; }
</style>
