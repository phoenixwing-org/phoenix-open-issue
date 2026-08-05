<script setup lang="ts">
import { ref } from 'vue'
import type { EightDReport, EightDReportInput, EightDReportIssueOption } from '/$/phoenix-open-issue/core'

const props = defineProps<{
  initial?: EightDReport | null
  issueOptions?: EightDReportIssueOption[]
  defaultIssueId?: string | null
  lockRelation?: boolean
}>()
const emit = defineEmits<{
  confirm: [data: EightDReportInput]
  close: []
}>()

const title = ref(props.initial?.title ?? '')
const relatedIssueId = ref<string | undefined>(props.initial?.relatedIssueId ?? props.defaultIssueId ?? undefined)
const containment = ref(props.initial?.containment ?? '')
const rootCause = ref(props.initial?.rootCause ?? '')
const correctiveAction = ref(props.initial?.correctiveAction ?? '')

function submit() {
  if (!title.value.trim()) return
  emit('confirm', {
    title: title.value.trim(),
    relatedIssueId: relatedIssueId.value || null,
    containment: containment.value,
    rootCause: rootCause.value,
    correctiveAction: correctiveAction.value,
  })
}
</script>

<template>
  <el-dialog :model-value="true" :title="initial ? '编辑 8D 报告' : '新建 8D 报告'" width="680px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="报告标题" required>
        <el-input v-model="title" maxlength="200" show-word-limit placeholder="例如：供应商来料尺寸异常 8D" />
      </el-form-item>
      <el-form-item label="关联 Issue（可选）">
        <el-select
          v-model="relatedIssueId"
          filterable
          clearable
          :disabled="lockRelation"
          placeholder="不选择则保存为独立报告"
          style="width:100%"
          :teleported="false"
        >
          <el-option
            v-for="issue in issueOptions"
            :key="issue.id"
            :label="`${issue.issueNo} · ${issue.title}`"
            :value="issue.id"
          >
            <span>{{ issue.issueNo }} · {{ issue.title }}</span>
            <small class="list-name">{{ issue.listName }}</small>
          </el-option>
        </el-select>
        <small class="field-help">关联只建立引用，不改变 Issue 权限，也不会把 8D 字段写回 Issue 主表。</small>
      </el-form-item>
      <el-form-item label="D3 临时遏制措施">
        <el-input v-model="containment" type="textarea" :rows="3" placeholder="临时围堵、隔离与风险控制措施" />
      </el-form-item>
      <el-form-item label="D4 根本原因">
        <el-input v-model="rootCause" type="textarea" :rows="3" placeholder="根因分析结论" />
      </el-form-item>
      <el-form-item label="D5-D6 永久纠正措施">
        <el-input v-model="correctiveAction" type="textarea" :rows="3" placeholder="永久纠正、验证与预防措施" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" :disabled="!title.trim()" @click="submit">保存报告</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.list-name { float: right; margin-left: 16px; color: var(--el-text-color-secondary); }
.field-help { display: block; margin-top: 5px; color: var(--el-text-color-secondary); line-height: 1.5; }
</style>
