<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getMyPushHistory } from '@/api/push'

const records = ref<any[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    const res = await getMyPushHistory()
    records.value = res.data
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2>推送历史</h2>
    </div>

    <el-table :data="records" v-loading="loading" stripe>
      <el-table-column label="推送时间" width="170">
        <template #default="{ row }">{{ new Date(row.pushed_at).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column prop="from_list_id" label="源列表" width="240" show-overflow-tooltip />
      <el-table-column prop="to_list_id" label="目标列表" width="240" show-overflow-tooltip />
      <el-table-column prop="issue_id" label="Issue ID" width="240" show-overflow-tooltip />
      <el-table-column prop="note" label="备注" min-width="150" show-overflow-tooltip />
      <template #empty><el-empty description="暂无推送记录" /></template>
    </el-table>
  </div>
</template>

<style scoped>
.page-head { margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
</style>
