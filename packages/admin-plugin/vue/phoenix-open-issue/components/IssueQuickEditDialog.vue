<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useDictStore } from '/$/phoenix-open-issue/stores/dict'
import { useFunctionStore } from '/$/phoenix-open-issue/stores/functions'
import AttentionStars from '/$/phoenix-open-issue/components/AttentionStars.vue'
import { ISSUE_IMPORTANCE_DICT, ISSUE_URGENCY_DICT } from '/$/phoenix-open-issue/core'

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

const selected = ref<string | number | undefined>(props.value ?? undefined)

watch(() => props.value, (v) => { selected.value = v ?? undefined })

const attentionLevel = computed({
  get: () => Number(selected.value) || 0,
  set: (v: number) => { selected.value = v },
})

onMounted(() => { if (props.field === 'function') funcStore.load() })

const fieldTitle = computed(() => ({
  severity: '重要度',
  priority: '紧急度',
  status: '状态',
  attention: '关注度',
  assignee: '责任人',
  function: '关联功能',
  category: '分类',
  detectionPhase: '发现阶段',
}[props.field]))

const statusOptions = [
  { value: 'open', label: '待处理' },
  { value: 'in_progress', label: '处理中' },
  { value: 'resolved', label: '待验收' },
  { value: 'closed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
]

const directChoiceOptions = computed(() => {
  if (props.field === 'severity') {
    const configured = dict.getOptions('severity')
    return configured.length ? configured : ISSUE_IMPORTANCE_DICT
  }
  if (props.field === 'priority') {
    const configured = dict.getOptions('priority')
    return configured.length ? configured : ISSUE_URGENCY_DICT
  }
  if (props.field === 'status') return statusOptions
  return []
})

function dimensionLevel(value: string): number | null {
  const values = props.field === 'severity'
    ? ISSUE_IMPORTANCE_DICT.map(item => item.value)
    : props.field === 'priority'
      ? ISSUE_URGENCY_DICT.map(item => item.value)
      : []
  const index = values.indexOf(value as never)
  return index >= 0 ? index + 1 : null
}

function selectDirectChoice(value: string) {
  selected.value = value
}

function submit() {
  if (props.field === 'attention') {
    emit('confirm', attentionLevel.value)
    return
  }
  if (props.field === 'assignee' || props.field === 'function' || props.field === 'category' || props.field === 'detectionPhase') {
    emit('confirm', selected.value || null)
    return
  }
  if (selected.value == null || selected.value === '') return
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
      <el-form-item
        v-if="field === 'severity' || field === 'priority' || field === 'status'"
        :label="fieldTitle"
      >
        <div class="quick-choice-list" role="radiogroup" :aria-label="fieldTitle">
          <template v-for="option in directChoiceOptions" :key="option.value">
            <span
              v-if="field === 'status' && option.value === 'closed'"
              class="quick-choice-divider"
              aria-hidden="true"
            >结束处理</span>
            <button
              class="quick-choice-option"
              :class="{
                'is-selected': selected === option.value,
                'is-terminal': field === 'status' && (option.value === 'closed' || option.value === 'cancelled'),
                [`is-level-${dimensionLevel(option.value)}`]: dimensionLevel(option.value),
              }"
              type="button"
              role="radio"
              :aria-checked="selected === option.value"
              @click="selectDirectChoice(option.value)"
            >
              <span class="quick-choice-indicator" aria-hidden="true" />
              <span>{{ option.label }}</span>
            </button>
          </template>
        </div>
        <div v-if="field === 'severity' || field === 'priority'" class="dimension-scale-hint" aria-hidden="true">
          <span>低</span><span class="dimension-scale-line" /><span>高</span>
        </div>
        <p v-if="field === 'status'" class="status-hint">
          待验收：处理完成，等待确认；已完成：验收通过；已取消：无需继续处理。
        </p>
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
.quick-choice-list {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: stretch;
  gap: 8px;
}

.quick-choice-option {
  min-width: 76px;
  min-height: 34px;
  display: inline-flex;
  flex: 0 1 auto;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 7px 12px;
  border: 1px solid var(--el-border-color, #dcdfe6);
  border-radius: 6px;
  background: var(--el-fill-color-blank, #fff);
  color: var(--el-text-color-regular, #606266);
  cursor: pointer;
  font: inherit;
  line-height: 1;
  transition: border-color 0.16s ease, background-color 0.16s ease, color 0.16s ease;
}

.quick-choice-option:hover {
  border-color: var(--el-color-primary-light-5, #79bbff);
  color: var(--el-color-primary, #409eff);
}

.quick-choice-option:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5, #79bbff);
  outline-offset: 2px;
}

.quick-choice-option.is-selected {
  border-color: var(--el-color-primary, #409eff);
  background: color-mix(in srgb, var(--el-color-primary, #409eff) 11%, transparent);
  color: var(--el-color-primary, #409eff);
  font-weight: 600;
}

.quick-choice-divider {
  flex: 0 0 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 0.76rem;
  line-height: 1;
}

.quick-choice-divider::after {
  height: 1px;
  flex: 1;
  background: var(--el-border-color-lighter, #ebeef5);
  content: '';
}

.quick-choice-option.is-terminal:not(.is-selected) {
  background: var(--el-fill-color-light, #f5f7fa);
}

.quick-choice-indicator {
  width: 12px;
  height: 12px;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  border: 1.5px solid currentColor;
  border-radius: 50%;
}

.quick-choice-option.is-selected .quick-choice-indicator::after {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  content: '';
}

.quick-choice-option.is-level-1 { --dimension-color: var(--el-color-success, #67c23a); }
.quick-choice-option.is-level-2 { --dimension-color: var(--el-color-primary, #409eff); }
.quick-choice-option.is-level-3 { --dimension-color: var(--el-color-warning, #e6a23c); }
.quick-choice-option.is-level-4 { --dimension-color: var(--el-color-danger, #f56c6c); }

.quick-choice-option[class*='is-level-'] .quick-choice-indicator {
  border-color: var(--dimension-color);
  background: color-mix(in srgb, var(--dimension-color) 16%, transparent);
}

.quick-choice-option[class*='is-level-'].is-selected {
  border-color: var(--dimension-color);
  color: var(--dimension-color);
  background: color-mix(in srgb, var(--dimension-color) 11%, transparent);
}

.quick-choice-option[class*='is-level-'].is-selected .quick-choice-indicator::after {
  background: var(--dimension-color);
}

.dimension-scale-hint {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 7px;
  color: var(--el-text-color-secondary, #909399);
  font-size: 0.75rem;
  line-height: 1;
}

.dimension-scale-line {
  height: 3px;
  flex: 1;
  border-radius: 99px;
  background: linear-gradient(90deg, var(--el-color-success, #67c23a), var(--el-color-primary, #409eff), var(--el-color-warning, #e6a23c), var(--el-color-danger, #f56c6c));
}

.attention-hint {
  margin: 6px 0 0;
  font-size: 0.78rem;
  color: var(--el-text-color-secondary, #909399);
  line-height: 1.4;
}

.status-hint {
  margin: 10px 0 0;
  color: var(--el-text-color-secondary, #909399);
  font-size: 0.78rem;
  line-height: 1.55;
}
</style>
