<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatUserLabel } from '@open-issue/core'
import type { Checkpoint, CheckpointStatus } from '@open-issue/core'

const props = defineProps<{
  users: any[]
  initial?: Partial<Checkpoint>
  issueTitle?: string
  issueNo?: string
}>()
const emit = defineEmits<{
  confirm: [data: { checkpointDate: string; deadline: string | null; description: string; responsibleUserId?: string; status?: CheckpointStatus }]
  close: []
}>()

const isEdit = computed(() => !!props.initial?.id)

function localToday(): string {
  const now = new Date()
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 10)
}

const date = ref(props.initial?.checkpointDate || localToday())
const deadline = ref(props.initial?.deadline || '')
const desc = ref(props.initial?.description || '')
const responsible = ref(props.initial?.responsibleUserId || '')
const status = ref<CheckpointStatus>(props.initial?.status || 'pending')

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'skipped', label: '已跳过' },
  { value: 'voided', label: '已作废' },
]

function submit() {
  if (!desc.value.trim()) return
  emit('confirm', {
    checkpointDate: date.value,
    deadline: deadline.value || null,
    description: desc.value,
    responsibleUserId: responsible.value || undefined,
    ...(isEdit.value ? { status: status.value } : {}),
  })
}
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="isEdit ? '编辑点检项' : '添加点检'"
    width="450px"
    @close="emit('close')"
  >
    <template #header>
      <div class="dialog-title">
        <span>{{ isEdit ? '编辑点检项' : '添加点检' }}</span>
        <div v-if="props.issueTitle" class="issue-context">
          <el-tag type="primary" effect="dark">{{ props.issueNo || '当前 Issue' }}</el-tag>
          <strong :title="props.issueTitle">{{ props.issueTitle }}</strong>
        </div>
      </div>
    </template>
    <el-form label-position="top" @submit.prevent="submit">
      <el-row :gutter="12">
        <el-col :span="12">
          <el-form-item label="点检日" required>
            <el-date-picker
              v-model="date"
              type="date"
              placeholder="选择点检日"
              style="width:100%"
              value-format="YYYY-MM-DD"
              :teleported="false"
            />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="截止（可选）">
            <el-date-picker
              v-model="deadline"
              type="date"
              placeholder="无截止日"
              clearable
              style="width:100%"
              value-format="YYYY-MM-DD"
              :teleported="false"
            />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="描述" required>
        <el-input v-model="desc" placeholder="如：已流程到采购" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-select v-model="responsible" :teleported="false" placeholder="选择负责人" clearable style="width:100%">
          <el-option v-for="u in props.users" :key="u.id" :label="formatUserLabel(u)" :value="u.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="isEdit" label="状态">
        <el-select v-model="status" :teleported="false" placeholder="选择状态" style="width:100%">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">{{ isEdit ? '保存' : '添加' }}</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.dialog-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 0; padding-right: 24px; }
.issue-context {
  display: flex;
  flex-basis: 100%;
  align-items: center;
  gap: 8px;
  min-width: 0;
  margin-top: 2px;
  padding: 7px 9px;
  color: #1d4f91;
  background: #ecf5ff;
  border-left: 3px solid #409eff;
  border-radius: 4px;
  font-size: 0.86rem;
}
.issue-context strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
