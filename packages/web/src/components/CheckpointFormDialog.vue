<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Checkpoint, CheckpointStatus } from '@open-issue/core'

const props = defineProps<{ users: any[]; initial?: Partial<Checkpoint> }>()
const emit = defineEmits<{
  confirm: [data: { checkpointDate: string; description: string; responsibleUserId?: string; status?: CheckpointStatus }]
  close: []
}>()

const isEdit = computed(() => !!props.initial?.id)

const date = ref(props.initial?.checkpointDate || new Date().toISOString().slice(0, 10))
const desc = ref(props.initial?.description || '')
const responsible = ref(props.initial?.responsibleUserId || '')
const status = ref<CheckpointStatus>(props.initial?.status || 'pending')

const statusOptions = [
  { value: 'pending', label: '待处理' },
  { value: 'done', label: '已完成' },
  { value: 'skipped', label: '已跳过' },
]

function submit() {
  if (!desc.value.trim()) return
  emit('confirm', {
    checkpointDate: date.value,
    description: desc.value,
    responsibleUserId: responsible.value || undefined,
    ...(isEdit.value ? { status: status.value } : {}),
  })
}
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="isEdit ? '编辑点检项' : '添加点检项'"
    width="450px"
    @close="emit('close')"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="日期" required>
        <el-date-picker v-model="date" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="描述" required>
        <el-input v-model="desc" placeholder="如：已流程到采购" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-select v-model="responsible" :teleported="false" placeholder="选择负责人" clearable style="width:100%">
          <el-option v-for="u in props.users" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
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
