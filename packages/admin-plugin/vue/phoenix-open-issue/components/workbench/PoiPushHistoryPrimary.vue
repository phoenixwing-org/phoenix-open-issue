<script setup lang="ts">
import PnwPrimaryPanel from 'phoenix-wing/layout/PnwPrimaryPanel.vue'
import PnwPrimarySection from 'phoenix-wing/layout/PnwPrimarySection.vue'
import { usePoiPrimarySectionExpanded } from './poiPrimarySectionState'

type PoiPushStatus = 'all' | 'pending' | 'accepted' | 'rejected' | 'withdrawn'

const props = defineProps<{
  viewKey: string
  status: PoiPushStatus
  counts: Readonly<Record<PoiPushStatus, number>>
  onSelectStatus: (status: PoiPushStatus) => void
}>()

const STATUS_OPTIONS: readonly { value: PoiPushStatus; label: string }[] = [
  { value: 'all', label: '全部记录' },
  { value: 'pending', label: '待审批' },
  { value: 'accepted', label: '已接受' },
  { value: 'rejected', label: '已拒绝' },
  { value: 'withdrawn', label: '已撤回' },
]

const statusExpanded = usePoiPrimarySectionExpanded(() => props.viewKey, 'status')
</script>

<template>
  <PnwPrimaryPanel title="推送历史" aria-label="推送历史筛选">
    <template #summary>{{ counts.all }} 条记录</template>
    <PnwPrimarySection v-model:expanded="statusExpanded" title="推送状态">
      <nav class="poi-push-primary-content" aria-label="推送状态">
        <button
          v-for="option in STATUS_OPTIONS"
          :key="option.value"
          type="button"
          :class="{ 'is-active': status === option.value }"
          @click="onSelectStatus(option.value)"
        >
          <span>{{ option.label }}</span>
          <em>{{ counts[option.value] }}</em>
        </button>
      </nav>
    </PnwPrimarySection>
  </PnwPrimaryPanel>
</template>

<style scoped>
.poi-push-primary-content {
  display: grid;
  gap: 6px;
  margin: 8px;
}
.poi-push-primary-content > button {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-push-primary-content > button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff)); }
.poi-push-primary-content > button.is-active {
  background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9, #dbeafe));
  color: var(--pnw-control-active-text, var(--el-color-primary, #2563eb));
  font-weight: 600;
}
.poi-push-primary-content em { font-style: normal; font-variant-numeric: tabular-nums; }
</style>
