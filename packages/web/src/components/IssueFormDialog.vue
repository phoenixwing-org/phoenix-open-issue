<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  allUsers: Array<{ id: string; username: string; displayName: string | null }>
}>()
const emit = defineEmits<{
  confirm: [data: {
    title: string; description?: string; priority?: string
    severity?: string; category?: string; detectionPhase?: string
    reporterId?: string; assigneeId?: string; dueDate?: string
  }]
  close: []
}>()

const title = ref('')
const description = ref('')
const priority = ref('medium')
const severity = ref('minor')
const category = ref('')
const detectionPhase = ref('')
const reporterId = ref('')
const assigneeId = ref('')
const dueDate = ref('')

const severityOptions = [
  { value: 'fatal', label: '致命 🔴' },
  { value: 'major', label: '严重 🟠' },
  { value: 'minor', label: '一般 🟡' },
  { value: 'trivial', label: '轻微 🟢' },
]
const categoryOptions = [
  { value: 'appearance', label: '外观' },
  { value: 'dimension', label: '尺寸' },
  { value: 'function', label: '功能' },
  { value: 'process', label: '过程' },
  { value: 'safety', label: '安全' },
  { value: 'other', label: '其他' },
]
const detectionPhaseOptions = [
  { value: 'incoming', label: '来料检验' },
  { value: 'in_process', label: '过程检验' },
  { value: 'final', label: '终检' },
  { value: 'customer', label: '客户反馈' },
  { value: 'audit', label: '审核发现' },
  { value: 'supplier', label: '供应商端' },
]

function submit() {
  if (!title.value.trim()) return
  emit('confirm', {
    title: title.value,
    description: description.value || undefined,
    priority: priority.value,
    severity: severity.value,
    category: category.value || undefined,
    detectionPhase: detectionPhase.value || undefined,
    reporterId: reporterId.value || undefined,
    assigneeId: assigneeId.value || undefined,
    dueDate: dueDate.value || undefined,
  })
}
</script>

<template>
  <el-dialog :model-value="true" title="新建 Issue" width="560px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <!-- 基本信息 -->
      <el-form-item label="标题" required>
        <el-input v-model="title" placeholder="Issue 标题" />
      </el-form-item>

      <el-row :gutter="16">
        <!-- 严重度 & 分类 -->
        <el-col :span="12">
          <el-form-item label="严重度">
            <el-select v-model="severity" style="width:100%">
              <el-option v-for="o in severityOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="问题分类">
            <el-select v-model="category" placeholder="选择分类" clearable style="width:100%">
              <el-option v-for="o in categoryOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 发现阶段 & 优先级 -->
        <el-col :span="12">
          <el-form-item label="发现阶段">
            <el-select v-model="detectionPhase" placeholder="选择阶段" clearable style="width:100%">
              <el-option v-for="o in detectionPhaseOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="优先级">
            <el-radio-group v-model="priority">
              <el-radio value="low">低</el-radio>
              <el-radio value="medium">中</el-radio>
              <el-radio value="high">高</el-radio>
              <el-radio value="critical">紧急</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 人员与日期 -->
        <el-col :span="12">
          <el-form-item label="提出人">
            <el-select v-model="reporterId" filterable placeholder="谁发现的" clearable style="width:100%">
              <el-option v-for="u in props.allUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="责任人">
            <el-select v-model="assigneeId" filterable placeholder="谁负责" clearable style="width:100%">
              <el-option v-for="u in props.allUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="计划完成日">
        <el-date-picker v-model="dueDate" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" />
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
