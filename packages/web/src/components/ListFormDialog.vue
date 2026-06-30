<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{ initial?: { name: string; description: string; listType: string } }>()
const emit = defineEmits<{ confirm: [data: { name: string; listType: string; description?: string }]; close: [] }>()

const name = ref(props.initial?.name || '')
const listType = ref(props.initial?.listType || 'custom')
const description = ref(props.initial?.description || '')

function submit() {
  if (!name.value.trim()) return
  emit('confirm', { name: name.value, listType: listType.value, description: description.value })
}
</script>

<template>
  <el-dialog :model-value="true" :title="props.initial ? '编辑列表' : '新建列表'" width="450px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="名称" required>
        <el-input v-model="name" placeholder="如：2026年7月点检" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="listType">
          <el-option label="年度" value="yearly" />
          <el-option label="月度" value="monthly" />
          <el-option label="项目" value="project" />
          <el-option label="自定义" value="custom" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">确认</el-button>
    </template>
  </el-dialog>
</template>
