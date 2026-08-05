<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

const props = defineProps<{
  viewKey: string
  issueNo: string
  status: string
  priority: string
  severity: string
  listCount: number
  has8d: boolean
  hasDescription: boolean
  onNavigateSection: (sectionId: string) => void
}>()

const summaryExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'summary')
const navigationExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'navigation')
</script>

<template>
  <PnwPrimaryPanel :title="issueNo || 'Issue'" aria-label="Issue 导航与操作">
    <template #summary><span>详情导航</span></template>
    <PnwPrimarySection v-model:expanded="summaryExpanded" title="Issue 摘要">
      <dl class="poi-issue-summary">
        <div><dt>状态</dt><dd>{{ status || '—' }}</dd></div>
        <div><dt>紧急度</dt><dd>{{ priority || '—' }}</dd></div>
        <div><dt>重要度</dt><dd>{{ severity || '—' }}</dd></div>
        <div v-if="listCount >= 2"><dt>关联点检表</dt><dd>{{ listCount }}</dd></div>
      </dl>
    </PnwPrimarySection>
    <PnwPrimarySection v-model:expanded="navigationExpanded" title="章节">
      <nav class="poi-issue-navigation" aria-label="Issue 章节">
        <button type="button" @click="onNavigateSection('issue-basic')">基本信息</button>
        <button type="button" @click="onNavigateSection('issue-people')">人员与日期</button>
        <button v-if="has8d" type="button" @click="onNavigateSection('issue-8d')">8D 报告</button>
        <button v-if="hasDescription" type="button" @click="onNavigateSection('issue-description')">问题描述</button>
      </nav>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-issue-summary,
.poi-issue-navigation {
  display: grid;
  gap: 8px;
  margin: 8px;
}
.poi-issue-summary div { display: flex; justify-content: space-between; gap: 8px; }
.poi-issue-summary dt { color: var(--pnw-workbench-muted, #64748b); font-size: 12px; }
.poi-issue-summary dd { margin: 0; font-size: 12px; font-weight: 600; }
.poi-issue-navigation button {
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-issue-navigation button:hover {
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff));
}
</style>
