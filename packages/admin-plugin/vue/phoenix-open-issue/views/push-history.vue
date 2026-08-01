<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMyPushHistory, getPushTargetLists, handlePush, withdrawPush } from '/$/phoenix-open-issue/api/push'
import { ElMessage, ElMessageBox } from 'element-plus'
import { pnwPromptInput } from 'phoenix-wing'
import PnwPageHeader from 'phoenix-wing/layout/PnwPageHeader.vue'
import PageHelpButton from '/$/phoenix-open-issue/components/PageHelpButton.vue'
import PoiPushHistoryPrimary from '/$/phoenix-open-issue/components/workbench/PoiPushHistoryPrimary.vue'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'
import type { PushRecord, PushTargetListOption } from '/$/phoenix-open-issue/core'

type PushStatusFilter = 'all' | 'pending' | 'accepted' | 'rejected' | 'withdrawn'
interface PushHistoryRow extends PushRecord {
  issueTitle: string
  fromListName: string
  toListName: string | null
  toUserName: string | null
  _canHandle: boolean
  _canWithdraw: boolean
}

const route = useRoute()
const router = useRouter()
const records = ref<PushHistoryRow[]>([])
const loading = ref(false)
const statusFilter = ref<PushStatusFilter>('all')
const acceptDialog = reactive({
  visible: false,
  loading: false,
  submitting: false,
  recordId: '',
  toListId: '',
  lists: [] as PushTargetListOption[],
})
const filteredRecords = computed(() => statusFilter.value === 'all'
  ? records.value
  : records.value.filter(record => record.status === statusFilter.value))
const statusCounts = computed(() => ({
  all: records.value.length,
  pending: records.value.filter(record => record.status === 'pending').length,
  accepted: records.value.filter(record => record.status === 'accepted').length,
  rejected: records.value.filter(record => record.status === 'rejected').length,
  withdrawn: records.value.filter(record => record.status === 'withdrawn').length,
}))
const hasActions = computed(() => filteredRecords.value.some(record =>
  record.status === 'pending' && (record._canHandle || record._canWithdraw),
))

async function load() {
  loading.value = true
  try {
    const response = await getMyPushHistory()
    records.value = response.data
  } finally {
    loading.value = false
  }
}

onMounted(load)

async function onAccept(record: PushHistoryRow) {
  if (record.targetType === 'list') {
    await handlePush(record.id, 'accepted')
    ElMessage.success('已接受推送')
    await load()
    return
  }

  acceptDialog.visible = true
  acceptDialog.loading = true
  acceptDialog.recordId = record.id
  acceptDialog.toListId = ''
  acceptDialog.lists = []
  try {
    const response = await getPushTargetLists(record.id)
    acceptDialog.lists = response.data
    if (acceptDialog.lists.length === 1) acceptDialog.toListId = acceptDialog.lists[0].id
  } catch (error) {
    acceptDialog.visible = false
    throw error
  } finally {
    acceptDialog.loading = false
  }
}

async function confirmAccept() {
  if (!acceptDialog.toListId) return
  acceptDialog.submitting = true
  try {
    await handlePush(acceptDialog.recordId, 'accepted', undefined, acceptDialog.toListId)
    ElMessage.success('已接受推送，Issue 已关联到所选列表')
    acceptDialog.visible = false
    await load()
  } finally {
    acceptDialog.submitting = false
  }
}

async function onReject(recordId: string) {
  try {
    const value = await pnwPromptInput('拒绝推送', '拒绝理由（可选）')
    await handlePush(recordId, 'rejected', value || undefined)
    ElMessage.success('已拒绝推送')
    await load()
  } catch { /* 用户取消 */ }
}

async function onWithdraw(recordId: string) {
  try {
    await ElMessageBox.confirm('撤回后接收人将不能再接受此推送，确定撤回吗？', '撤回推送', {
      type: 'warning',
      confirmButtonText: '确认撤回',
      cancelButtonText: '取消',
    })
    await withdrawPush(recordId)
    ElMessage.success('推送已撤回')
    await load()
  } catch { /* 用户取消 */ }
}

function goList(listId: string | null) {
  if (listId) void router.push(`/open-issue/list/${listId}`)
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiPushHistoryPrimary,
    props: computed(() => ({
      status: statusFilter.value,
      counts: statusCounts.value,
      loading: loading.value,
      onSelectStatus: (status: PushStatusFilter) => { statusFilter.value = status },
      onRefresh: load,
    })),
  },
})
</script>

<template>
  <div class="page">
    <PnwPageHeader title="推送历史">
      <template #help><PageHelpButton page-id="pushHistory" /></template>
    </PnwPageHeader>

    <el-table :data="filteredRecords" v-loading="loading" stripe size="small" data-tour="push-table">
      <el-table-column label="时间" width="140">
        <template #default="{ row }">{{ new Date(row.pushedAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.status === 'pending'" type="warning" size="small">待处理</el-tag>
          <el-tag v-else-if="row.status === 'accepted'" type="success" size="small">已接受</el-tag>
          <el-tag v-else-if="row.status === 'rejected'" type="danger" size="small">已拒绝</el-tag>
          <el-tag v-else type="info" size="small">已撤回</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="issueTitle" label="Issue" min-width="160" show-overflow-tooltip />
      <el-table-column prop="fromListName" label="源列表" width="130" show-overflow-tooltip />
      <el-table-column label="" width="30"><template #default>→</template></el-table-column>
      <el-table-column label="接收目标" min-width="170" show-overflow-tooltip>
        <template #default="{ row }">
          <el-link v-if="row.toListId" type="primary" @click="goList(row.toListId)">{{ row.toListName }}</el-link>
          <span v-else-if="row.targetType === 'user'" class="user-target">👤 {{ row.toUserName }}</span>
          <span v-else class="cell-na">—</span>
          <small v-if="row.targetType === 'user' && row.toListId" class="via-user">由 {{ row.toUserName }} 接收</small>
        </template>
      </el-table-column>
      <el-table-column prop="note" label="备注" min-width="100" show-overflow-tooltip />
      <el-table-column v-if="hasActions" label="操作" width="210" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'pending'">
            <template v-if="row._canHandle">
              <el-button size="small" type="success" @click="onAccept(row)">接受</el-button>
              <el-button size="small" type="danger" @click="onReject(row.id)">拒绝</el-button>
            </template>
            <el-button v-if="row._canWithdraw" size="small" plain @click="onWithdraw(row.id)">撤回</el-button>
          </template>
          <span v-else class="cell-na">—</span>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无推送记录" /></template>
    </el-table>

    <el-dialog v-model="acceptDialog.visible" title="接受到目标列表" width="460px">
      <div v-loading="acceptDialog.loading">
        <el-alert
          title="请选择您负责管理的列表。接受后，Issue 将关联到该列表。"
          type="info"
          :closable="false"
          class="accept-note"
        />
        <el-select v-model="acceptDialog.toListId" placeholder="选择目标列表" style="width:100%">
          <el-option
            v-for="list in acceptDialog.lists"
            :key="list.id"
            :label="list.name"
            :value="list.id"
          />
        </el-select>
        <el-empty v-if="!acceptDialog.loading && !acceptDialog.lists.length" description="暂无可接收的列表；您需要是列表所有者或管理员" :image-size="56" />
      </div>
      <template #footer>
        <el-button @click="acceptDialog.visible = false">取消</el-button>
        <el-button type="primary" :disabled="!acceptDialog.toListId" :loading="acceptDialog.submitting" @click="confirmAccept">确认接受</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.cell-na { color: var(--el-text-color-placeholder); }
.user-target { color: var(--el-text-color-regular); }
.via-user { display: block; margin-top: 2px; color: var(--el-text-color-secondary); }
.accept-note { margin-bottom: 16px; }
</style>
