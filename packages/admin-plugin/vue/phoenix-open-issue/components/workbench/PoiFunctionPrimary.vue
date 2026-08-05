<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

const props = defineProps<{
  viewKey: string
  search: string
  numericSort: boolean
  statusFilter: 'enabled' | 'disabled' | 'all'
  itemCount: number
  onUpdateSearch: (value: string) => void
  onUpdateNumericSort: (value: string | number | boolean) => void
  onUpdateStatusFilter: (value: string) => void
}>()

const filtersExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'filters')
</script>

<template>
  <PnwPrimaryPanel title="功能表" aria-label="功能表筛选与操作" data-tour="functions-filters">
    <template #summary>{{ itemCount }} 条结果</template>
    <PnwPrimarySection v-model:expanded="filtersExpanded" title="功能筛选">
      <div class="poi-function-primary-content">
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
        <el-select
          :model-value="statusFilter"
          aria-label="功能状态"
          size="small"
          @update:model-value="onUpdateStatusFilter"
        >
          <el-option label="启用" value="enabled" />
          <el-option label="停用" value="disabled" />
          <el-option label="全部" value="all" />
        </el-select>
      </div>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-function-primary-content {
  display: grid;
  gap: 8px;
  margin: 8px;
}
</style>
