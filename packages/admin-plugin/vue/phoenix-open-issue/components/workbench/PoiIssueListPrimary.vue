<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

interface PoiSelectOption {
  value: string
  label: string
}

type PoiListView = 'all' | 'active' | 'archived' | 'deleted'

const props = defineProps<{
  viewKey: string
  listView: PoiListView
  canAdministerLists: boolean
  searchText: string
  listType: string
  listTypeOptions: readonly PoiSelectOption[]
  hasActiveFilters: boolean
  onSelectView: (value: PoiListView) => void
  onUpdateSearch: (value: string) => void
  onUpdateListType: (value: string) => void
  onClear: () => void
}>()

const rangeExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'range')
const filtersExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'filters')
</script>

<template>
  <PnwPrimaryPanel title="列表管理" aria-label="列表导航与筛选" data-tour="lists-filters">
    <PnwPrimarySection v-model:expanded="rangeExpanded" title="列表范围">
      <div class="poi-issue-list-section">
        <el-select
          :model-value="listView"
          aria-label="列表范围"
          size="small"
          @update:model-value="onSelectView"
        >
          <el-option label="全部" value="all" />
          <el-option label="正常" value="active" />
          <el-option label="已归档" value="archived" />
          <el-option v-if="canAdministerLists" label="已删除" value="deleted" />
        </el-select>
      </div>
    </PnwPrimarySection>
    <PnwPrimarySection v-model:expanded="filtersExpanded" title="筛选列表">
      <div class="poi-issue-list-section">
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
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-issue-list-section {
  display: grid;
  gap: 8px;
  margin: 8px;
}
</style>
