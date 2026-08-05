<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

interface PoiFilterOption {
  value: string
  label: string
}

type PoiIssueViewMode = 'simple' | 'complex' | 'timeline'

const props = defineProps<{
  viewKey: string
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
  viewMode: PoiIssueViewMode
  maxTimelineRows: number
  checkpointYearThresholdMonths: number
  onUpdateSearch: (value: string) => void
  onUpdateUnwatched: (value: string | number | boolean) => void
  onUpdateStatus: (value: string) => void
  onUpdatePriority: (value: string) => void
  onUpdateSeverity: (value: string) => void
  onUpdateCategory: (value: string) => void
  onUpdateViewMode: (value: PoiIssueViewMode) => void
  onUpdateMaxTimelineRows: (value: number) => void
  onUpdateCheckpointYearThreshold: (value: number) => void
  onOpenColumnSettings: () => void
  onClear: () => void
}>()

const filtersExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'filters')
const presentationExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'presentation')
</script>

<template>
  <PnwPrimaryPanel title="列表详情" aria-label="Issue 筛选与显示" data-tour="list-filters">
    <PnwPrimarySection v-model:expanded="filtersExpanded" title="筛选 Issue">
      <div class="poi-issue-table-section">
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
    </PnwPrimarySection>
    <PnwPrimarySection v-model:expanded="presentationExpanded" title="显示方式">
      <div class="poi-issue-table-section">
        <el-select
          :model-value="viewMode"
          aria-label="Issue 显示方式"
          size="small"
          @update:model-value="onUpdateViewMode"
        >
          <el-option label="简单" value="simple" />
          <el-option label="复杂" value="complex" />
          <el-option label="跟踪" value="timeline" />
        </el-select>
        <template v-if="viewMode === 'timeline'">
          <el-select
            :model-value="maxTimelineRows"
            aria-label="最近点检条数"
            size="small"
            @update:model-value="onUpdateMaxTimelineRows"
          >
            <el-option v-for="count in [1,2,3,4,5,6,7,8,9,10]" :key="count" :label="`最近 ${count} 条点检`" :value="count" />
          </el-select>
          <el-select
            :model-value="checkpointYearThresholdMonths"
            aria-label="点检日期简化范围"
            size="small"
            @update:model-value="onUpdateCheckpointYearThreshold"
          >
            <el-option label="日期：当月简化" :value="0" />
            <el-option label="日期：2 个月简化" :value="2" />
            <el-option label="日期：3 个月简化" :value="3" />
            <el-option label="日期：半年简化" :value="6" />
            <el-option label="日期：全年简化" :value="12" />
            <el-option label="日期：不简化" :value="-1" />
          </el-select>
        </template>
        <el-button size="small" plain @click="onOpenColumnSettings">列设置</el-button>
      </div>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-issue-table-section {
  display: grid;
  gap: 8px;
  margin: 8px;
}
</style>
