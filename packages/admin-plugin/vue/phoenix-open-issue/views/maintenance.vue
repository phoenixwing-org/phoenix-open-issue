<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import PnwPageHeader from 'phoenix-wing/layout/PnwPageHeader.vue'
import {
  getRepairTasks,
  runDbRepair,
  type RepairTaskDefinition,
  type RepairTaskId,
  type RepairTaskResult,
} from '/$/phoenix-open-issue/api/maintenance'
import PoiSettingsRepairBottom from '/$/phoenix-open-issue/components/workbench/PoiSettingsRepairBottom.vue'

const tasks = ref<RepairTaskDefinition[]>([])
const loading = ref(false)
const repairingTask = ref<RepairTaskId | null>(null)
const results = ref<RepairTaskResult[]>([])

const taskRows = computed(() => [
  ...tasks.value,
  {
    id: 'all' as const,
    title: '全部执行',
    description: '按顺序执行以上全部修正；所有任务均为幂等，可重复执行。',
  },
])

async function load() {
  loading.value = true
  try {
    tasks.value = (await getRepairTasks()).data
  } finally {
    loading.value = false
  }
}

async function onRepairTask(taskId: RepairTaskId) {
  repairingTask.value = taskId
  try {
    results.value = (await runDbRepair(taskId)).data
    const fixed = results.value.reduce((total, item) => total + item.fixed, 0)
    ElMessage.success(fixed ? `修正完成，共处理 ${fixed} 项` : '检查完成，数据已是最新')
  } finally {
    repairingTask.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="page">
    <PnwPageHeader title="Open Issue 维护" />

    <el-alert
      title="这里只保留 Open Issue 插件自有数据修正；账号、登录、字典和整库备份由 Phoenix Admin Host 管理。"
      type="info"
      :closable="false"
      show-icon
      class="maintenance-note"
    />

    <p class="repair-intro">
      升级版本后若出现点检异常或列表 Issue 数量不对，可在此逐项修正。所有操作幂等，可重复执行。
    </p>

    <div class="repair-list" data-tour="settings-repair" v-loading="loading">
      <div v-for="task in taskRows" :key="task.id" class="repair-item">
        <div class="repair-item-head">
          <strong>{{ task.title }}</strong>
          <el-button
            :type="task.id === 'all' ? 'warning' : 'success'"
            size="small"
            :loading="repairingTask === task.id"
            :disabled="!!repairingTask && repairingTask !== task.id"
            @click="onRepairTask(task.id)"
          >
            {{ task.id === 'all' ? '▶ 全部执行' : '执行修正' }}
          </el-button>
        </div>
        <p class="repair-desc">{{ task.description }}</p>
      </div>
    </div>

    <section class="repair-output" aria-label="数据库修正结果">
      <h3>数据库修正结果</h3>
      <PoiSettingsRepairBottom :results="results" />
    </section>
  </div>
</template>

<style scoped>
.page { padding: 0; }
.maintenance-note { max-width: 760px; margin-bottom: 14px; }
.repair-intro { max-width: 760px; margin: 0 0 16px; color: var(--el-text-color-secondary); font-size: .82rem; }
.repair-list { display: flex; flex-direction: column; gap: 16px; max-width: 720px; min-height: 120px; }
.repair-item { padding: 14px 16px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; background: var(--el-fill-color-light); }
.repair-item-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 6px; }
.repair-desc { margin: 0; font-size: .82rem; color: var(--el-text-color-secondary); line-height: 1.5; }
.repair-output { max-width: 720px; min-height: 96px; margin-top: 20px; border: 1px solid var(--el-border-color-lighter); border-radius: 8px; }
.repair-output h3 { margin: 0; padding: 10px 16px; border-bottom: 1px solid var(--el-border-color-lighter); font-size: .86rem; }
</style>
