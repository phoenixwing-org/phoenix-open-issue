<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useDictStore } from '@/stores/dict'
import { useAuthStore } from '@/stores/auth'
import { useFunctionStore } from '@/stores/functions'
import PnwDictSelect from 'phoenix-wing/components/PnwDictSelect.vue'

const dict = useDictStore()
const auth = useAuthStore()
const funcStore = useFunctionStore()

const props = defineProps<{
  allUsers: Array<{ id: string; username: string; displayName: string | null }>
  initial?: Record<string, any> | null   // 编辑模式：预填数据
}>()
const emit = defineEmits<{
  confirm: [data: {
    title: string; issueNo?: string; description?: string; priority?: string
    severity?: string; category?: string; detectionPhase?: string
    reporterId?: string; assigneeId?: string; dueDate?: string
    functionId?: string
  }]
  close: []
}>()

onMounted(() => { dict.load(); funcStore.load() })

const title = ref(props.initial?.title || '')
const issueNo = ref(props.initial?.issueNo || '')
const description = ref(props.initial?.description || '')
const priority = ref(props.initial?.priority || 'medium')
const severity = ref(props.initial?.severity || 'minor')
const category = ref(props.initial?.category || '')
const detectionPhase = ref(props.initial?.detectionPhase || '')
const reporterId = ref(props.initial?.reporterId || auth.user?.id || '')
const assigneeId = ref(props.initial?.assigneeId || auth.user?.id || '')
const dueDate = ref(props.initial?.dueDate || '')
const functionId = ref(props.initial?.functionId || '')

function submit() {
  if (!title.value.trim()) return
  emit('confirm', {
    title: title.value,
    issueNo: issueNo.value || undefined,
    description: description.value || undefined,
    priority: priority.value,
    severity: severity.value,
    category: category.value || undefined,
    detectionPhase: detectionPhase.value || undefined,
    reporterId: reporterId.value || undefined,
    assigneeId: assigneeId.value || undefined,
    dueDate: dueDate.value || undefined,
    functionId: functionId.value || undefined,
  })
}
</script>

<template>
  <el-dialog :model-value="true" :title="props.initial ? '编辑 Issue' : '新建 Issue'" width="560px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <!-- 编号 + 标题 -->
      <el-row :gutter="16">
        <el-col :span="8">
          <el-form-item label="编号">
            <el-input v-model="issueNo" placeholder="ISS-2026-0001" />
          </el-form-item>
        </el-col>
        <el-col :span="16">
          <el-form-item label="标题" required>
            <el-input v-model="title" placeholder="Issue 标题" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 严重度 & 分类 -->
        <el-col :span="12">
          <el-form-item label="严重度">
            <PnwDictSelect v-model="severity" :items="dict.getTaggedOptions('severity') as any" placeholder="选择严重度" storage-key="issue-severity" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="问题分类">
            <PnwDictSelect v-model="category" :items="dict.getTaggedOptions('issueCategory') as any" placeholder="选择分类" storage-key="issue-category" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 发现阶段 & 优先级 -->
        <el-col :span="12">
          <el-form-item label="发现阶段">
            <PnwDictSelect v-model="detectionPhase" :items="dict.getTaggedOptions('detectionPhase') as any" placeholder="选择阶段" storage-key="issue-detection" />
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
            <el-select v-model="reporterId" :teleported="false" filterable placeholder="谁发现的" clearable style="width:100%">
              <el-option v-for="u in props.allUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="责任人">
            <el-select v-model="assigneeId" :teleported="false" filterable placeholder="谁负责" clearable style="width:100%">
              <el-option v-for="u in props.allUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="计划完成日">
        <el-date-picker v-model="dueDate" type="date" placeholder="选择日期" style="width:100%" value-format="YYYY-MM-DD" />
      </el-form-item>

      <el-form-item label="关联功能">
        <el-select v-model="functionId" :teleported="false" filterable placeholder="选择功能（可选）" clearable style="width:100%">
          <el-option v-for="f in funcStore.items" :key="f.id" :label="`[${f.platform}] ${f.externalId} ${f.functionName}`" :value="f.id">
            <span>{{ f.platform }}</span>
            <el-tag size="small" type="info" style="margin:0 4px">{{ f.externalId }}</el-tag>
            <span>{{ f.functionName }}</span>
          </el-option>
        </el-select>
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
