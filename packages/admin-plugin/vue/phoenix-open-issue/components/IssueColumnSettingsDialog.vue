<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  type ListViewMode,
  type IssueListColumnSettings,
  type IssueColumnItemConfig,
  columnLabel,
  defaultIssueListColumns,
  columnsForMode,
} from '/$/phoenix-open-issue/config/issueListColumns'

const props = defineProps<{
  mode: ListViewMode
  settings: IssueListColumnSettings
}>()

const emit = defineEmits<{
  confirm: [settings: IssueListColumnSettings]
  close: []
}>()

const activeTab = ref<ListViewMode>(props.mode)
const draft = ref<IssueListColumnSettings>(defaultIssueListColumns())

function cloneSettings(src: IssueListColumnSettings): IssueListColumnSettings {
  return {
    simple: columnsForMode('simple', src).map(c => ({ ...c })),
    complex: columnsForMode('complex', src).map(c => ({ ...c })),
    timeline: columnsForMode('timeline', src).map(c => ({ ...c })),
  }
}

watch(
  () => props.settings,
  (s) => { draft.value = cloneSettings(s) },
  { immediate: true, deep: true },
)

function itemsForTab(tab: ListViewMode): IssueColumnItemConfig[] {
  return draft.value[tab]
}

function move(tab: ListViewMode, idx: number, dir: -1 | 1) {
  const list = [...draft.value[tab]]
  const j = idx + dir
  if (j < 0 || j >= list.length) return
  ;[list[idx], list[j]] = [list[j], list[idx]]
  draft.value = { ...draft.value, [tab]: list }
}

function resetTab(tab: ListViewMode) {
  draft.value = {
    ...draft.value,
    [tab]: defaultIssueListColumns()[tab].map(c => ({ ...c })),
  }
}

function submit() {
  emit('confirm', cloneSettings(draft.value))
}
</script>

<template>
  <el-dialog
    :model-value="true"
    title="Issue 列表列设置"
    width="520px"
    @close="emit('close')"
  >
    <p class="hint">简单 / 复杂 / 跟踪 三种视图分别配置显示列与顺序。标题、序号、操作列固定不可隐藏。「最近点检」列仅跟踪视图可选。</p>
    <el-tabs v-model="activeTab">
      <el-tab-pane label="简单" name="simple" />
      <el-tab-pane label="复杂" name="complex" />
      <el-tab-pane label="跟踪" name="timeline" />
    </el-tabs>

    <div class="col-list">
      <div v-for="(item, idx) in itemsForTab(activeTab)" :key="item.key" class="col-row">
        <el-checkbox v-model="item.visible">{{ columnLabel(item.key) }}</el-checkbox>
        <span class="col-actions">
          <el-button size="small" :disabled="idx === 0" @click="move(activeTab, idx, -1)">↑</el-button>
          <el-button size="small" :disabled="idx === itemsForTab(activeTab).length - 1" @click="move(activeTab, idx, 1)">↓</el-button>
        </span>
      </div>
    </div>

    <template #footer>
      <el-button @click="resetTab(activeTab)">恢复本视图默认</el-button>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint { margin: 0 0 12px; font-size: 0.82rem; color: #909399; line-height: 1.5; }
.col-list { max-height: 360px; overflow-y: auto; border: 1px solid #ebeef5; border-radius: 6px; padding: 8px 0; }
.col-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 12px;
}
.col-row:hover { background: #f5f7fa; }
.col-actions { display: flex; gap: 4px; flex-shrink: 0; }
</style>
