<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useDictStore } from '/$/phoenix-open-issue/stores/dict'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import { useFunctionStore } from '/$/phoenix-open-issue/stores/functions'
import { DEFAULT_ATTENTION_LEVEL, ISSUE_URGENCY_DICT, formatUserLabel } from '/$/phoenix-open-issue/core'
import PnwDictSelect from 'phoenix-wing/components/PnwDictSelect.vue'
import type { PnwViewDialogRendererContext } from 'phoenix-wing'
import AttentionStars from '/$/phoenix-open-issue/components/AttentionStars.vue'
import type {
  IssueFormDialogProps,
  IssueFormDialogResult,
} from '/$/phoenix-open-issue/components/issueFormDialog'

const dict = useDictStore()
const auth = useAuthStore()
const funcStore = useFunctionStore()

const props = defineProps<{
  dialog: PnwViewDialogRendererContext<IssueFormDialogProps, IssueFormDialogResult>
}>()

onMounted(() => { funcStore.load() })

const initial = props.dialog.props.initial
const allUsers = props.dialog.props.allUsers
const isEdit = computed(() => !!initial)

const title = ref(initial?.title || '')
const issueNo = ref(initial?.issueNo || '')
const description = ref(initial?.description || '')
const priority = ref(initial?.priority || 'medium')
const severity = ref(initial?.severity || 'minor')
const category = ref(initial?.category || '')
const detectionPhase = ref(initial?.detectionPhase || '')
const reporterId = ref(initial?.reporterId || auth.user?.id || '')
const assigneeId = ref(initial?.assigneeId || auth.user?.id || '')
const dueDate = ref(initial?.dueDate || '')
const functionId = ref(initial?.functionId || '')
const attentionLevel = ref<number>(
  initial?._attentionLevel ?? DEFAULT_ATTENTION_LEVEL,
)
const urgencyOptions = computed(() => {
  const configured = dict.getOptions('priority')
  return configured.length ? configured : ISSUE_URGENCY_DICT
})

function submit() {
  if (!title.value.trim()) return
  const result: IssueFormDialogResult = {
    title: title.value,
    priority: priority.value,
    severity: severity.value,
    ...(isEdit.value ? { attentionLevel: attentionLevel.value } : {}),
  }
  if (issueNo.value) result.issueNo = issueNo.value
  if (description.value) result.description = description.value
  if (category.value) result.category = category.value
  if (detectionPhase.value) result.detectionPhase = detectionPhase.value
  if (reporterId.value) result.reporterId = reporterId.value
  if (assigneeId.value) result.assigneeId = assigneeId.value
  if (dueDate.value) result.dueDate = dueDate.value
  if (functionId.value) result.functionId = functionId.value
  props.dialog.submit(result)
}
</script>

<template>
  <div class="issue-form-dialog">
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
        <!-- 重要度（历史字段 severity）& 分类 -->
        <el-col :span="12">
          <el-form-item label="重要度">
            <PnwDictSelect v-model="severity" :items="dict.getTaggedOptions('severity') as any" placeholder="选择重要度" storage-key="issue-severity" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="问题分类">
            <PnwDictSelect v-model="category" :items="dict.getTaggedOptions('issueCategory') as any" placeholder="选择分类" storage-key="issue-category" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 发现阶段 & 紧急度（历史字段 priority） -->
        <el-col :span="12">
          <el-form-item label="发现阶段">
            <PnwDictSelect v-model="detectionPhase" :items="dict.getTaggedOptions('detectionPhase') as any" placeholder="选择阶段" storage-key="issue-detection" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="紧急度">
            <el-radio-group v-model="priority">
              <el-radio v-for="option in urgencyOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <!-- 人员与日期 -->
        <el-col :span="12">
          <el-form-item label="提出人">
            <el-select v-model="reporterId" :teleported="false" filterable placeholder="谁发现的" clearable style="width:100%">
              <el-option v-for="u in allUsers" :key="u.id" :label="formatUserLabel(u)" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="责任人">
            <el-select v-model="assigneeId" :teleported="false" filterable placeholder="谁负责" clearable style="width:100%">
              <el-option v-for="u in allUsers" :key="u.id" :label="formatUserLabel(u)" :value="u.id" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="截止日">
        <el-date-picker
          v-model="dueDate"
          type="date"
          placeholder="选择日期"
          style="width:100%"
          value-format="YYYY-MM-DD"
          :teleported="false"
        />
      </el-form-item>

      <el-form-item v-if="isEdit" label="关注度（本列表）">
        <AttentionStars v-model="attentionLevel" show-label />
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
      <div class="issue-form-dialog__footer">
        <el-button @click="props.dialog.cancel()">取消</el-button>
        <el-button type="primary" @click="submit">{{ initial ? '保存' : '创建' }}</el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.issue-form-dialog {
  box-sizing: border-box;
  min-width: 0;
  padding: 16px;
}
.issue-form-dialog__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
