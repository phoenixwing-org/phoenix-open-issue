<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{ confirm: [data: { title: string; description?: string; priority?: string }]; close: [] }>()

const title = ref('')
const description = ref('')
const priority = ref('medium')

function submit() {
  if (!title.value.trim()) return
  emit('confirm', { title: title.value, description: description.value, priority: priority.value })
}
</script>

<template>
  <el-dialog :model-value="true" title="新建 Issue" width="500px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="标题" required>
        <el-input v-model="title" placeholder="Issue 标题" />
      </el-form-item>
      <el-form-item label="优先级">
        <el-radio-group v-model="priority">
          <el-radio value="low">低</el-radio>
          <el-radio value="medium">中</el-radio>
          <el-radio value="high">高</el-radio>
          <el-radio value="critical">紧急</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="3" placeholder="可选描述" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">创建</el-button>
    </template>
  </el-dialog>
</template>
