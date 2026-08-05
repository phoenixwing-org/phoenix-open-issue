<script setup lang="ts">
interface PoiFilterOption {
  value: string
  label: string
}

defineProps<{
  searchText: string
  showUnwatchedOnly: boolean
  status: string
  priority: string
  severity: string
  category: string
  statusOptions: readonly PoiFilterOption[]
  priorityOptions: readonly PoiFilterOption[]
  severityOptions: readonly PoiFilterOption[]
  categoryOptions: readonly PoiFilterOption[]
  hasActiveFilters: boolean
  onUpdateSearch: (value: string) => void
  onUpdateUnwatched: (value: boolean) => void
  onUpdateStatus: (value: string) => void
  onUpdatePriority: (value: string) => void
  onUpdateSeverity: (value: string) => void
  onUpdateCategory: (value: string) => void
  onClear: () => void
}>()
</script>

<template>
  <div class="poi-issue-table-primary" data-tour="list-filters">
    <strong>筛选 Issue</strong>
    <el-input
      :model-value="searchText"
      placeholder="编号、标题或描述"
      clearable
      size="small"
      @update:model-value="onUpdateSearch"
    />
    <el-checkbox
      :model-value="showUnwatchedOnly"
      size="small"
      @update:model-value="onUpdateUnwatched"
    >
      只显示不关注
    </el-checkbox>
    <el-select :model-value="status" placeholder="状态" clearable size="small" @update:model-value="onUpdateStatus">
      <el-option v-for="option in statusOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <el-select :model-value="priority" placeholder="紧急度" clearable size="small" @update:model-value="onUpdatePriority">
      <el-option v-for="option in priorityOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <el-select :model-value="severity" placeholder="重要度" clearable size="small" @update:model-value="onUpdateSeverity">
      <el-option v-for="option in severityOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <el-select :model-value="category" placeholder="分类" clearable size="small" @update:model-value="onUpdateCategory">
      <el-option v-for="option in categoryOptions" :key="option.value" :label="option.label" :value="option.value" />
    </el-select>
    <el-button v-if="hasActiveFilters" size="small" plain type="primary" @click="onClear">
      清除筛选
    </el-button>
  </div>
</template>

<style scoped>
.poi-issue-table-primary {
  display: grid;
  align-content: start;
  gap: 9px;
  padding: 14px;
}
.poi-issue-table-primary strong {
  color: var(--pnw-workbench-muted, #64748b);
  font-size: 12px;
}
</style>
