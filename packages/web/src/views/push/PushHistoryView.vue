<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getMyPushHistory, handlePush } from '@/api/push'
import { ElMessage } from 'element-plus';
import { pnwPromptInput } from 'phoenix-wing'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"

const router = useRouter()
const records = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res = await getMyPushHistory()
    records.value = res.data
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function onAccept(recordId: string) {
  await handlePush(recordId, 'accepted')
  ElMessage.success('已接受推送')
  load()
}

async function onReject(recordId: string) {
  try {
    await pnwPromptInput('拒绝推送', '拒绝理由（可选）')
      .then(async ({ value }) => {
        await handlePush(recordId, 'rejected', value || undefined)
        ElMessage.success('已拒绝推送')
        load()
      })
  } catch { /* canceled */ }
}

function goList(listId: string) {
  router.push(`/list/${listId}`)
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="推送历史">
      <template #help><PageHelpButton page-id="pushHistory" /></template>
    </PnwPageHeader>

    <el-table :data="records" v-loading="loading" stripe size="small">
      <el-table-column label="时间" width="140">
        <template #default="{ row }">{{ new Date(row.pushedAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'pending'" type="warning" size="small">待审批</el-tag>
          <el-tag v-else-if="row.status === 'accepted'" type="success" size="small">已接受</el-tag>
          <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">已拒绝</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issueTitle" label="Issue" min-width="160" show-overflow-tooltip />
      <el-table-column prop="fromListName" label="源列表" width="130" show-overflow-tooltip />
      <el-table-column label="" width="30">
        <template #default>→</template>
      </el-table-column>
      <el-table-column label="目标列表" width="160" show-overflow-tooltip>
        <template #default="{ row }">
          <el-link type="primary" @click="goList(row.toListId)">{{ row.toListName }}</el-link>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column label="操作" width="140" fixed="right" v-if="records.some(r => r.status === 'pending')">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <el-button size="small" type="success" @click="onAccept(row.id)">接受</el-button>
            <el-button size="small" type="danger" @click="onReject(row.id)">拒绝</el-button>
          </template>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无推送记录" /></template>
    </el-table>
  </div>
</template>

<style scoped>
.page-head { margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
.cell-na { color: #c0c4cc; }
</style>
