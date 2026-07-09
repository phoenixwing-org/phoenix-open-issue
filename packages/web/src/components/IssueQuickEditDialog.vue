<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDictStore } from '@/stores/dict'
import { useFunctionStore } from '@/stores/functions'
import AttentionStars from '@/components/AttentionStars.vue'

export type IssueQuickEditField = 'severity' | 'priority' | 'status' | 'attention' | 'assignee' | 'function' | 'category' | 'detectionPhase'

const props = defineProps<{
  field: IssueQuickEditField
  issueTitle: string
  value: string | number | null | undefined
  users?: Array<{ id: string; username: string; displayName: string | null }>
}>()

const emit = defineEmits<{
  confirm: [value: string | number | null]
  close: []
}>()

const dict = useDictStore()
const funcStore = useFunctionStore()

const selected = ref<string | number | null>(props.value ?? null)

watch(() => props.value, (v) => { selected.value = v ?? null })

const attentionLevel = computed({
  get: () => Number(selected.value) || 0,
  set: (v: number) => { selected.value = v },
})

onMounted(() => { if (props.field === 'function') funcStore.load() })

const fieldTitle = computed(() => ({
  severity: '严重度',
  priority: '优先级',
  status: '状态',
  attention: '关注度',
  assignee: '责任人',
  function: '关联功能',
  category: '分类',
  detectionPhase: '发现阶段',
}[props.field]))

const statusOptions = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'resolved', label: '已解决' },
  { value: 'closed', label: '已关闭' },
  { value: 'cancelled', label: '已取消' },
]

const priorityOptions = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
]

function submit() {
  if (props.field === 'attention') {
    emit('confirm', attentionLevel.value)
    return
  }
  if (props.field === 'assignee' || props.field === 'function' || props.field === 'category' || props.field === 'detectionPhase') {
    emit('confirm', selected.value || null)
    return
  }
  if (selected.value === null || selected.value === '') return
  emit('confirm', selected.value)
}
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="`${fieldTitle} · ${issueTitle}`"
    width="420px"
    @close="emit('close')"
  >
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item v-if="field === 'severity'" label="严重度">
        <el-select v-model="selected" :teleported="false" placeholder="选择严重度" style="width:100%">
          <el-option v-for="o in dict.getOptions('severity')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'priority'" label="优先级">
        <el-select v-model="selected" :teleported="false" placeholder="选择优先级" style="width:100%">
          <el-option v-for="o in priorityOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'status'" label="状态">
        <el-select v-model="selected" :teleported="false" placeholder="选择状态" style="width:100%">
          <el-option v-for="o in statusOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'attention'" label="关注度（本列表）">
        <AttentionStars v-model="attentionLevel" show-label />
        <p class="attention-hint">点击星星设置 1~5 星；再次点击当前星级或「不关注」可取消。</p>
      </el-form-item>

      <el-form-item v-else-if="field === 'assignee'" label="责任人">
        <el-select v-model="selected" :teleported="false" filterable clearable placeholder="选择责任人" style="width:100%">
          <el-option
            v-for="u in users"
            :key="u.id"
            :label="u.displayName || u.username"
            :value="u.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'function'" label="关联功能">
        <el-select v-model="selected" :teleported="false" filterable clearable placeholder="选择功能" style="width:100%">
          <el-option
            v-for="f in funcStore.items"
            :key="f.id"
            :label="`[${f.platform}] ${f.externalId} ${f.functionName}`"
            :value="f.id"
          />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'category'" label="分类">
        <el-select v-model="selected" :teleported="false" filterable clearable placeholder="选择分类" style="width:100%">
          <el-option v-for="o in dict.getOptions('issueCategory')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>

      <el-form-item v-else-if="field === 'detectionPhase'" label="发现阶段">
        <el-select v-model="selected" :teleported="false" filterable clearable placeholder="选择发现阶段" style="width:100%">
          <el-option v-for="o in dict.getOptions('detectionPhase')" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.attention-hint {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: #909399;
  line-height: 1.4;
}
</style>
