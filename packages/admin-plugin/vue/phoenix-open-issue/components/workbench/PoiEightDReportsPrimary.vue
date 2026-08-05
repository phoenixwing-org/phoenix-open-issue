<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

type RelationFilter = 'all' | 'linked' | 'standalone'

const props = defineProps<{
  viewKey: string
  filter: RelationFilter
  counts: Readonly<Record<RelationFilter, number>>
  onSelectFilter: (filter: RelationFilter) => void
}>()

const options: readonly { value: RelationFilter; label: string }[] = [
  { value: 'all', label: '全部报告' },
  { value: 'linked', label: '已关联 Issue' },
  { value: 'standalone', label: '独立报告' },
]

const statusExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'relation-status')
</script>

<template>
  <PnwPrimaryPanel title="8D 报告" aria-label="8D 报告筛选">
    <template #summary>{{ counts.all }} 份报告</template>
    <PnwPrimarySection v-model:expanded="statusExpanded" title="关联状态">
      <nav class="report-primary-content" aria-label="8D 报告关联状态">
        <button v-for="option in options" :key="option.value" type="button" :class="{ 'is-active': filter === option.value }" @click="onSelectFilter(option.value)">
          <span>{{ option.label }}</span><em>{{ counts[option.value] }}</em>
        </button>
      </nav>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.report-primary-content { display: grid; gap: 6px; margin: 8px; }
.report-primary-content > button { display:flex; justify-content:space-between; gap:8px; padding:8px 10px; border:0; border-radius:6px; background:transparent; color:inherit; text-align:left; cursor:pointer; }
.report-primary-content > button:hover { background:var(--pnw-workbench-hover-bg, var(--el-fill-color-light)); }
.report-primary-content > button.is-active { background:var(--pnw-workbench-active-bg, var(--el-color-primary-light-9)); color:var(--pnw-control-active-text, var(--el-color-primary)); font-weight:600; }
.report-primary-content em { font-style:normal; font-variant-numeric:tabular-nums; }
</style>
