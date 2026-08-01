<script setup lang="ts">
interface PoiSelectOption {
  value: string
  label: string
}

defineProps<{
  searchText: string
  listType: string
  listTypeOptions: readonly PoiSelectOption[]
  hasActiveFilters: boolean
  onUpdateSearch: (value: string) => void
  onUpdateListType: (value: string) => void
  onClear: () => void
}>()
</script>

<template>
  <div class="poi-issue-list-primary" data-tour="lists-filters">
    <strong>筛选列表</strong>
    <el-input
      :model-value="searchText"
      placeholder="名称、描述或负责人"
      clearable
      size="small"
      @update:model-value="onUpdateSearch"
    />
    <el-select
      :model-value="listType"
      placeholder="列表类型"
      clearable
      size="small"
      @update:model-value="onUpdateListType"
    >
      <el-option
        v-for="option in listTypeOptions"
        :key="option.value"
        :label="option.label"
        :value="option.value"
      />
    </el-select>
    <el-button
      v-if="hasActiveFilters"
      size="small"
      plain
      type="primary"
      @click="onClear"
    >
      清除筛选
    </el-button>
  </div>
</template>

<style scoped>
.poi-issue-list-primary {
  display: grid;
  gap: 10px;
  padding: 14px;
}
.poi-issue-list-primary strong {
  color: var(--pnw-workbench-muted, #64748b);
  font-size: 12px;
}
</style>
