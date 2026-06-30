<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAllDict, createDictItem, updateDictItem, deleteDictItem } from '@/api/dict'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { DictItem } from '@phoenix-wing/open-issue-core'

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

async function load() {
  loading.value = true
  try {
    const res = await getAllDict()
    items.value = res.data
  } finally { loading.value = false }
}

onMounted(load)

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
  await ElMessageBox.confirm('确定删除？', '确认', { type: 'warning' })
  await deleteDictItem(id)
  ElMessage.success('已删除')
  load()
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
    <div class="page-head">
      <h2>数据字典</h2>
      <el-button type="primary" size="small" @click="showAdd = true">+ 添加</el-button>
    </div>

    <div v-loading="loading">
      <div v-for="g in groups" :key="g.value" style="margin-bottom:20px">
        <h3 style="margin-bottom:8px">{{ g.label }} ({{ groupedItems()[g.value]?.length || 0 }})</h3>
        <el-table :data="groupedItems()[g.value]" size="small" stripe>
          <el-table-column prop="value" label="值" width="160" />
          <el-table-column prop="label" label="显示名" width="160" />
          <el-table-column label="状态" width="80" align="center">
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
