<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionState } from '/$/phoenix-open-issue/composables/usePoiPrimarySectionState'

defineProps<{
  isAdmin: boolean
  available: boolean
  running: boolean
  fileCount: number
  totalCases: number
  hasResult: boolean
  onRunAll: () => void
  onNavigateSection: (sectionId: string) => void
}>()

const overviewExpanded = usePoiPrimarySectionState('test-runner', 'overview')
const navigationExpanded = usePoiPrimarySectionState('test-runner', 'navigation')
</script>

<template>
  <PnwPrimaryPanel title="单元测试 Primary" aria-label="单元测试导航与操作">
    <PnwPrimarySection v-model:expanded="overviewExpanded" title="测试概况">
      <template #suffix>{{ fileCount }} 个文件 · {{ totalCases }} 条用例</template>
      <div class="poi-primary-section-content">
        <el-alert
          v-if="!isAdmin"
          title="仅系统管理员可运行"
          type="warning"
          :closable="false"
          show-icon
        />
        <el-alert
          v-else-if="!available"
          title="当前环境未提供 Vitest"
          type="info"
          :closable="false"
          show-icon
        />
        <el-button
          v-if="isAdmin"
          size="small"
          type="primary"
          :loading="running"
          :disabled="!available || running"
          @click="onRunAll"
        >全部运行</el-button>
      </div>
    </PnwPrimarySection>
    <PnwPrimarySection v-model:expanded="navigationExpanded" title="页面导航">
      <nav class="poi-primary-section-content" aria-label="测试页章节">
        <button type="button" @click="onNavigateSection('test-files')">测试文件</button>
        <button v-if="hasResult" type="button" @click="onNavigateSection('test-result')">最近结果</button>
      </nav>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-primary-section-content {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 8px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-primary-section-content button {
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-primary-section-content button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff)); }
</style>
