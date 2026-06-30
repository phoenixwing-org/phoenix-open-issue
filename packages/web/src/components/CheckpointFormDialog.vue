<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ users: any[]; initial?: any }>()
const emit = defineEmits<{ confirm: [data: { checkpoint_date: string; description: string; responsible_user_id?: string }]; close: [] }>()

const date = ref(props.initial?.checkpoint_date || new Date().toISOString().slice(0, 10))
const desc = ref(props.initial?.description || '')
const responsible = ref(props.initial?.responsible_user_id || '')

function submit() {
  if (!desc.value.trim()) return
  emit('confirm', {
    checkpoint_date: date.value,
    description: desc.value,
    responsible_user_id: responsible.value || undefined,
  })
}
</script>

<template>
  <el-dialog :model-value="true" title="添加点检项" width="450px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="日期" required>
        <el-date-picker v-model="date" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="描述" required>
        <el-input v-model="desc" placeholder="如：已流程到采购" />
      </el-form-item>
      <el-form-item label="负责人">
        <el-select v-model="responsible" placeholder="选择负责人" clearable style="width:100%">
          <el-option v-for="u in props.users" :key="u.id" :label="u.display_name || u.username" :value="u.id" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">添加</el-button>
    </template>
  </el-dialog>
</template>
