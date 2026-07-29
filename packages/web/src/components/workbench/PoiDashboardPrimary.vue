<script setup lang="ts">
type PoiDashboardScope = 'mine' | 'all'
type PoiDashboardLifecycle = 'active' | 'archived'

defineProps<{
  scope: PoiDashboardScope
  lifecycle: PoiDashboardLifecycle
  isAdmin: boolean
  onSelectScope: (scope: PoiDashboardScope) => void
  onSelectLifecycle: (lifecycle: PoiDashboardLifecycle) => void
}>()
</script>

<template>
  <div class="poi-dashboard-primary" data-tour="dashboard-views">
    <section>
      <strong>列表范围</strong>
      <el-radio-group
        :model-value="scope"
        size="small"
        @update:model-value="onSelectScope"
      >
        <el-radio-button value="mine">我的</el-radio-button>
        <el-radio-button v-if="isAdmin" value="all">所有</el-radio-button>
      </el-radio-group>
    </section>
    <section>
      <strong>生命周期</strong>
      <el-radio-group
        :model-value="lifecycle"
        size="small"
        @update:model-value="onSelectLifecycle"
      >
        <el-radio-button value="active">正常</el-radio-button>
        <el-radio-button value="archived">已归档</el-radio-button>
      </el-radio-group>
    </section>
  </div>
</template>

<style scoped>
.poi-dashboard-primary {
  display: grid;
  gap: 18px;
  padding: 14px;
}
.poi-dashboard-primary section {
  display: grid;
  gap: 8px;
}
.poi-dashboard-primary strong {
  color: var(--pnw-workbench-muted, #64748b);
  font-size: 12px;
}
.poi-dashboard-primary :deep(.el-radio-group) {
  display: grid;
}
.poi-dashboard-primary :deep(.el-radio-button__inner) {
  width: 100%;
  border-left: 1px solid var(--el-border-color);
  border-radius: 0;
}
</style>
