<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

type MaintenanceSection = 'repair' | 'dictionary' | 'tests' | 'audit'

const props = defineProps<{
  viewKey: string
  activeSection: MaintenanceSection
  canReadMaintenance: boolean
  canReadTests: boolean
  repairTaskCount: number
  dictionaryTypeCount: number
  testFileCount: number
  totalTestCases: number
  testsRunning: boolean
  onSelectSection: (section: MaintenanceSection) => void
}>()

const navigationExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'navigation')
</script>

<template>
  <PnwPrimaryPanel title="Open Issue 维护" aria-label="Open Issue 维护导航">
    <template #summary>按权限显示</template>
    <PnwPrimarySection v-model:expanded="navigationExpanded" title="维护区段">
      <div class="maintenance-primary-content">
        <nav aria-label="维护区段">
          <button
            v-if="canReadMaintenance"
            type="button"
            :class="{ 'is-active': activeSection === 'repair' }"
            @click="onSelectSection('repair')"
          >
            <span>数据修正</span><em>{{ repairTaskCount }}</em>
          </button>
          <button
            v-if="canReadMaintenance"
            type="button"
            :class="{ 'is-active': activeSection === 'dictionary' }"
            @click="onSelectSection('dictionary')"
          >
            <span>数据字典</span><em>{{ dictionaryTypeCount }} 类</em>
          </button>
          <button
            v-if="canReadTests"
            type="button"
            :class="{ 'is-active': activeSection === 'tests' }"
            @click="onSelectSection('tests')"
          >
            <span>单元测试</span><em>{{ testsRunning ? '运行中' : `${testFileCount}/${totalTestCases}` }}</em>
          </button>
          <button
            v-if="canReadMaintenance"
            type="button"
            :class="{ 'is-active': activeSection === 'audit' }"
            @click="onSelectSection('audit')"
          >
            <span>修正审计</span>
          </button>
        </nav>
        <el-alert
          v-if="!canReadMaintenance && !canReadTests"
          title="当前角色没有维护读取权限"
          type="warning"
          :closable="false"
          show-icon
        />
      </div>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.maintenance-primary-content { display: grid; gap: 8px; margin: 8px; }
.maintenance-primary-content nav { display: grid; gap: 4px; }
.maintenance-primary-content nav button { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 32px; padding: 6px 9px; border: 0; border-radius: 6px; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
.maintenance-primary-content nav button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light)); }
.maintenance-primary-content nav button.is-active { background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9)); color: var(--pnw-control-active-text, var(--el-color-primary)); font-weight: 600; }
.maintenance-primary-content nav em { color: var(--pnw-workbench-muted, var(--el-text-color-secondary)); font-size: 11px; font-style: normal; font-variant-numeric: tabular-nums; }
</style>
