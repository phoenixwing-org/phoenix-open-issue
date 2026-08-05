<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useIssueListStore } from '/$/phoenix-open-issue/stores/issueLists'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import { previewPush, pushIssues } from '/$/phoenix-open-issue/api/push'
import { ElMessage } from 'element-plus'
import type { UserPublic } from '/$/phoenix-open-issue/core'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'

const props = defineProps<{
  listId: string
  preselectedIssueIds?: string[]
}>()
const emit = defineEmits<{ close: [] }>()

const listStore = useIssueListStore()
const authStore = useAuthStore()
const capabilities = useIssueCapabilities()
const canListHostUsers = computed(() => capabilities.has('base:sys:user:list'))
const targetType = ref<'list' | 'user'>('list')
const targetListId = ref('')
const targetUserId = ref('')
const users = ref<UserPublic[]>([])
const note = ref('')
const loading = ref(false)
const previewResult = ref<any>(null)

const targetLists = computed(() => listStore.lists.filter(list => list.id !== props.listId))
const targetUsers = computed(() => users.value.filter(user =>
  user.id !== authStore.user?.id && !user.disabled,
))
const canSubmit = computed(() => !!props.preselectedIssueIds?.length && (
  targetType.value === 'user' ? !!targetUserId.value : !!previewResult.value?.canPush
))

watch(targetType, () => {
  targetListId.value = ''
  targetUserId.value = ''
  previewResult.value = null
})

onMounted(async () => {
  const [, userResponse] = await Promise.all([
    listStore.fetchLists(),
    canListHostUsers.value ? getAllUsers() : Promise.resolve({ data: [] }),
  ])
  users.value = userResponse.data as UserPublic[]
})

async function onPreview() {
  previewResult.value = null
  if (!targetListId.value) return
  loading.value = true
  try {
    const response = await previewPush(props.listId, targetListId.value)
    previewResult.value = response.data
  } finally {
    loading.value = false
  }
}

async function onPush() {
  if (!canSubmit.value) return
  loading.value = true
  try {
    const base = {
      fromListId: props.listId,
      issueIds: props.preselectedIssueIds ?? [],
      note: note.value,
    }
    const response = await pushIssues(targetType.value === 'user'
      ? { ...base, targetType: 'user', toUserId: targetUserId.value }
      : { ...base, targetType: 'list', toListId: targetListId.value })
    const count = response.data?.records?.length ?? 0
    ElMessage.success(targetType.value === 'user'
      ? `已将 ${count} 条 Issue 推送给接收人，待其选择列表接受`
      : `已推送 ${count} 条 Issue，待目标列表负责人审批`)
    emit('close')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.message || '推送失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <el-dialog model-value title="推送 Issue" width="520px" @close="emit('close')">
    <el-form label-position="top">
      <el-alert
        v-if="!props.preselectedIssueIds?.length"
        title="请先在列表中选择要推送的 Issue"
        type="warning"
        :closable="false"
        class="push-alert"
      />
      <el-alert
        v-else
        :title="`将推送 ${props.preselectedIssueIds.length} 个 Issue`"
        type="info"
        :closable="false"
        class="push-alert"
      />

      <el-form-item label="推送方式">
        <el-radio-group v-model="targetType">
          <el-radio-button value="list">推送到列表</el-radio-button>
          <el-radio-button v-if="canListHostUsers" value="user">推送给用户</el-radio-button>
        </el-radio-group>
      </el-form-item>

      <template v-if="targetType === 'list'">
        <el-form-item label="目标列表">
          <el-select v-model="targetListId" :teleported="false" placeholder="选择您有权访问的目标列表" style="width:100%" @change="onPreview">
            <el-option v-for="list in targetLists" :key="list.id" :label="list.name" :value="list.id" />
          </el-select>
        </el-form-item>
        <el-form-item v-if="previewResult" label="推送验证">
          <el-alert :title="previewResult.message" :type="previewResult.canPush ? 'success' : 'error'" :closable="false" show-icon />
          <p v-if="previewResult.canPush" class="overlap-note">
            共同成员：{{ previewResult.overlapPercent }}%（{{ previewResult.overlapUserIds.length }} 人）
          </p>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="接收人">
          <el-select v-model="targetUserId" filterable :teleported="false" placeholder="选择接收人" style="width:100%">
            <el-option
              v-for="user in targetUsers"
              :key="user.id"
              :label="user.displayName || user.username"
              :value="user.id"
            >
              <span>{{ user.displayName || user.username }}</span>
              <small v-if="user.displayName" class="username">{{ user.username }}</small>
            </el-option>
          </el-select>
        </el-form-item>
        <el-alert
          title="接收人接受时，再选择其有管理权限的目标列表；您不会看到对方的列表。"
          type="info"
          :closable="false"
          show-icon
          class="mode-note"
        />
      </template>

      <el-form-item label="备注">
        <el-input v-model="note" placeholder="推送备注（可选）" type="textarea" :rows="2" maxlength="500" show-word-limit />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!canSubmit" :loading="loading" @click="onPush">确认推送</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.push-alert { margin-bottom: 12px; }
.overlap-note { margin: 8px 0 0; color: var(--el-text-color-secondary); }
.mode-note { margin: -2px 0 18px; }
.username { float: right; margin-left: 18px; color: var(--el-text-color-secondary); }
</style>
