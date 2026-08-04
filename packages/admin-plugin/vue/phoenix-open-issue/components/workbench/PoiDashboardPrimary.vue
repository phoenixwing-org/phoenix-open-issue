<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import type { DashboardTaskCounts, DashboardTaskTab } from '/$/phoenix-open-issue/core'
import type { ListLifecycleFilter } from '/$/phoenix-open-issue/utils/listLifecycle'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

type DashboardScope = 'mine' | 'all'
type DashboardSection = 'overview' | DashboardTaskTab

const props = defineProps<{
  viewKey: string
  activeSection: DashboardSection
  counts: DashboardTaskCounts
  listScope: DashboardScope
  lifecycleFilter: ListLifecycleFilter
  canAdministerLists: boolean
  onSelectSection: (section: DashboardSection) => void
  onSelectScope: (scope: DashboardScope) => void
  onSelectLifecycle: (filter: ListLifecycleFilter) => void
}>()

function selectScope(value: string | number | boolean) {
  if (value === 'mine' || value === 'all') props.onSelectScope(value)
}

function selectLifecycle(value: string | number | boolean) {
  if (value === 'active' || value === 'archived') props.onSelectLifecycle(value)
}

const sections: readonly { value: DashboardSection; label: string }[] = [
  { value: 'overview', label: '列表概览' },
  { value: 'incoming', label: '待我处理' },
  { value: 'outgoing', label: '我发起的' },
]

const navigationExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'navigation')
const scopeExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'scope')
const lifecycleExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'lifecycle')
</script>

<template>
  <PnwPrimaryPanel title="仪表盘" aria-label="仪表盘导航与筛选">
    <template #summary>{{ counts.total }} 项待办</template>

    <PnwPrimarySection v-model:expanded="navigationExpanded" title="工作区段">
      <nav class="dashboard-section-content dashboard-navigation" aria-label="仪表盘区段">
        <button
          v-for="section in sections"
          :key="section.value"
          type="button"
          :class="{ 'is-active': activeSection === section.value }"
          @click="onSelectSection(section.value)"
        >
          <span>{{ section.label }}</span>
          <em v-if="section.value === 'incoming'">{{ counts.incoming }}</em>
          <em v-else-if="section.value === 'outgoing'">{{ counts.outgoing }}</em>
        </button>
      </nav>
    </PnwPrimarySection>

    <PnwPrimarySection v-if="activeSection === 'overview'" v-model:expanded="scopeExpanded" title="列表范围">
      <div class="dashboard-section-content filter-group">
        <el-segmented
          :model-value="listScope"
          :options="canAdministerLists
            ? [{ label: '我的', value: 'mine' }, { label: '所有', value: 'all' }]
            : [{ label: '我的', value: 'mine' }]"
          size="small"
          @update:model-value="selectScope"
        />
      </div>
    </PnwPrimarySection>

    <PnwPrimarySection v-if="activeSection === 'overview'" v-model:expanded="lifecycleExpanded" title="列表状态">
      <div class="dashboard-section-content filter-group">
        <el-segmented
          :model-value="lifecycleFilter"
          :options="[
            { label: '正常', value: 'active' },
            { label: '已归档', value: 'archived' },
          ]"
          size="small"
          @update:model-value="selectLifecycle"
        />
      </div>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.dashboard-section-content { display: grid; gap: 8px; margin: 8px; }
.dashboard-navigation button { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; padding: 6px 9px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.dashboard-navigation button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light)); }
.dashboard-navigation button.is-active { background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9)); color: var(--pnw-control-active-text, var(--el-color-primary)); font-weight: 600; }
.dashboard-navigation em { font-style: normal; font-variant-numeric: tabular-nums; }
.filter-group { min-width: 0; }
.filter-group :deep(.el-segmented) { width: 100%; }
</style>
