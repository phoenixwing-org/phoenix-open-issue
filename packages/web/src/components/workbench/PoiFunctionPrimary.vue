<script setup lang="ts">
defineProps<{
  search: string
  numericSort: boolean
  itemCount: number
  isAdmin: boolean
  onUpdateSearch: (value: string) => void
  onUpdateNumericSort: (value: boolean) => void
  onRefresh: () => void
  onCreate: () => void
}>()
</script>

<template>
  <aside class="poi-function-primary" aria-label="功能表筛选与操作" data-tour="functions-filters">
    <header>
      <strong>功能筛选</strong>
      <span>{{ itemCount }} 条结果</span>
    </header>
    <el-input
      :model-value="search"
      placeholder="功能名、平台或外部 ID"
      clearable
      size="small"
      @update:model-value="onUpdateSearch"
    />
    <el-checkbox :model-value="numericSort" @update:model-value="onUpdateNumericSort">
      外部 ID 按数字排序
    </el-checkbox>
    <el-button size="small" plain @click="onRefresh">刷新功能表</el-button>
    <el-button v-if="isAdmin" size="small" type="primary" plain @click="onCreate">新建功能</el-button>
  </aside>
</template>

<style scoped>
.poi-function-primary {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-function-primary header { display: flex; justify-content: space-between; gap: 8px; }
.poi-function-primary header strong,
.poi-function-primary header span { font-size: 12px; }
.poi-function-primary header span { color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b)); }
.poi-function-primary :deep(.el-button + .el-button) { margin-left: 0; }
</style>
