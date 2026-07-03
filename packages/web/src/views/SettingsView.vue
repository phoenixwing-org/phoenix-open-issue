<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAllDict, createDictItem, updateDictItem, deleteDictItem, applyDictPreset } from '@/api/dict'
import { ElMessage } from 'element-plus';
import { pnwPromptChoice, pnwAlert } from 'phoenix-wing'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import type { DictItem } from '@open-issue/core'

const items = ref<DictItem[]>([])
const loading = ref(false)
const showAdd = ref(false)
const newGroup = ref('issueCategory')
const newValue = ref('')
const newLabel = ref('')

const groups = [
  { value: 'issueCategory', label: '问题分类' },
  { value: 'detectionPhase', label: '发现阶段' },
  { value: 'orgUnitType', label: '组织类型' },
  { value: 'severity', label: '严重度' },
  { value: 'closeReason', label: '关闭理由' },
]

const presetLabels: Record<string, string> = {
  automotive: '汽车默认值',
  software: '软件默认值',
}

async function load() {
  loading.value = true
  try {
    const res = await getAllDict()
    items.value = res.data
  } finally { loading.value = false }
}

onMounted(load)

async function onApplyPreset(preset: string) {
  const label = presetLabels[preset] || preset
  const r = await pnwPromptChoice({
    title: '确认追加',
    message: `追加「${label}」预设项到各分组（已存在的值会跳过，不会覆盖）`,
    choices: [
      { id: 'append', label: '追加', variant: 'primary' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'append') return
  try {
    const res = await applyDictPreset(preset)
    const data = res.data as { added: number; skipped: number }
    if (data.added > 0) {
      ElMessage.success(`已追加 ${data.added} 项${data.skipped > 0 ? `，跳过 ${data.skipped} 项（已存在）` : ''}`)
    } else {
      ElMessage.info(`所有项已存在，跳过 ${data.skipped} 项`)
    }
    load()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '应用预设失败')
  }
}

async function onAdd() {
  if (!newValue.value.trim() || !newLabel.value.trim()) return
  await createDictItem({ groupName: newGroup.value, value: newValue.value.trim(), label: newLabel.value.trim() })
  ElMessage.success('已添加')
  newValue.value = ''
  newLabel.value = ''
  showAdd.value = false
  load()
}

async function onToggle(item: DictItem) {
  await updateDictItem(item.id, { enabled: item.enabled ? 0 : 1 })
  ElMessage.success(item.enabled ? '已禁用' : '已启用')
  load()
}

async function onDelete(id: string) {
  (await pnwPromptChoice({ title: '确认', message: '确定删除？', choices: [{ id: 'delete', label: '删除', variant: 'danger' }, { id: 'cancel', label: '取消' }] })).choiceId === 'delete'
  try {
    await deleteDictItem(id)
    ElMessage.success('已删除')
    load()
  } catch (e: any) {
    if (e?.response?.status === 409) {
      const msg = e.response.data?.message || e.response.data?.error || '该字典项正在使用中，无法删除'
      await pnwAlert('无法删除', msg)
    } else {
      ElMessage.error('删除失败')
    }
  }
}

function tagColor(tag: string): string {
  const map: Record<string, string> = {
    automotive: '#409EFF',
    software: '#67C23A',
  }
  return map[tag] || '#909399'
}

function groupedItems(): Record<string, DictItem[]> {
  const map: Record<string, DictItem[]> = {}
  for (const g of groups) {
    map[g.value] = items.value.filter(i => i.groupName === g.value)
  }
  return map
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="数据字典">
      <template #actions>
        <el-button type="default" size="small" @click="onApplyPreset('automotive')">🚗 汽车默认值</el-button>
        <el-button type="default" size="small" @click="onApplyPreset('software')">💻 软件默认值</el-button>
        <el-button type="primary" size="small" @click="showAdd = true">+ 添加</el-button>
      </template>
      <template #help><PageHelpButton page-id="settings" /></template>
    </PnwPageHeader>

    <div v-loading="loading">
      <div v-for="g in groups" :key="g.value" style="margin-bottom:20px">
        <h3 style="margin-bottom:8px">{{ g.label }} ({{ groupedItems()[g.value]?.length || 0 }})</h3>
        <el-table :data="groupedItems()[g.value]" size="small" stripe>
          <el-table-column prop="value" label="值" width="140" />
          <el-table-column prop="label" label="显示名" width="140" />
          <el-table-column label="标签" width="160">
            <template #default="{ row }">
              <template v-if="row.tags">
                <el-tag
                  v-for="t in row.tags.split(',').map((s:string) => s.trim()).filter(Boolean)"
                  :key="t"
                  size="small"
                  :color="tagColor(t)"
                  effect="dark"
                  style="margin-right:4px;margin-bottom:2px"
                >{{ t === 'automotive' ? '汽车' : t === 'software' ? '软件' : t }}</el-tag>
              </template>
              <span v-else style="color:#909399;font-size:12px">—</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="70" align="center">
            <template #default="{ row }">
              <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作">
            <template #default="{ row }">
              <el-button link size="small" @click="onToggle(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
              <el-button link size="small" type="danger" @click="onDelete(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-empty v-if="!items.length && !loading" description="暂无字典数据，点击添加" />
    </div>

    <el-dialog v-model="showAdd" title="添加字典项" width="400px">
      <el-form label-position="top">
        <el-form-item label="分组">
          <el-select v-model="newGroup">
            <el-option v-for="g in groups" :key="g.value" :label="g.label" :value="g.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="值">
          <el-input v-model="newValue" placeholder="如：safety" />
        </el-form-item>
        <el-form-item label="显示名">
          <el-input v-model="newLabel" placeholder="如：安全" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="onAdd">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
</style>
