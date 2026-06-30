<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { previewPush, pushIssues } from '@/api/push'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  listId: string
  preselectedIssueIds?: string[]
}>()
const emit = defineEmits<{ close: [] }>()

const listStore = useIssueListStore()
const targetListId = ref('')
const note = ref('')
const loading = ref(false)
const previewResult = ref<any>(null)

const targetLists = computed(() =>
  listStore.lists.filter(l => l.id !== props.listId),
)

onMounted(() => listStore.fetchLists())

async function onPreview() {
  if (!targetListId.value) return
  loading.value = true
  try {
    const res = await previewPush(props.listId, targetListId.value)
    previewResult.value = res.data
  } finally {
    loading.value = false
  }
}

async function onPush() {
  if (!targetListId.value || !previewResult.value?.canPush) return
  loading.value = true
  try {
    const res = await pushIssues({
      fromListId: props.listId,
      toListId: targetListId.value,
      issueIds: props.preselectedIssueIds || [],
      note: note.value,
    })
    const count = res.data?.records?.length || 0
    ElMessage.success(`已推送 ${count} 条 Issue，待目标列表负责人审批`)
    emit('close')
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '推送失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog model-value :title="'推送到其他列表'" width="500px" @close="emit('close')">
    <el-form label-position="top">
      <el-alert v-if="!props.preselectedIssueIds?.length" title="未选择 Issue，将推送列表中的全部条目" type="info" :closable="false" style="margin-bottom:12px" />
      <el-alert v-else :title="`将推送 ${props.preselectedIssueIds.length} 个 Issue`" type="info" :closable="false" style="margin-bottom:12px" />

      <el-form-item label="目标列表">
        <el-select v-model="targetListId" placeholder="选择目标列表" style="width:100%" @change="onPreview">
          <el-option v-for="l in targetLists" :key="l.id" :label="l.name" :value="l.id" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="previewResult" label="推送验证">
        <el-alert
          :title="previewResult.message"
          :type="previewResult.canPush ? 'success' : 'error'"
          :closable="false"
          show-icon
        />
        <div v-if="previewResult.canPush" style="margin-top:8px">
          <p>共同成员: {{ previewResult.overlapPercent }}% ({{ previewResult.overlapUserIds.length }} 人)</p>
        </div>
      </el-form-item>

      <el-form-item label="备注">
        <el-input v-model="note" placeholder="推送备注（可选）" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!previewResult?.canPush" :loading="loading" @click="onPush">
        确认推送
      </el-button>
    </template>
  </el-dialog>
</template>
