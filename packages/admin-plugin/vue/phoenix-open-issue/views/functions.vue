<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useFunctionStore } from '/$/phoenix-open-issue/stores/functions'
import { useSettingsStore } from '/$/phoenix-open-issue/stores/settings'
import { ElMessage } from 'element-plus'
import { pnwPromptChoice } from 'phoenix-wing'
import PnwPageHeader from 'phoenix-wing/layout/PnwPageHeader.vue'
import PageHelpButton from '/$/phoenix-open-issue/components/PageHelpButton.vue'
import { mapXlsxRow } from '/$/phoenix-open-issue/core'
import * as XLSX from 'xlsx'
import * as api from '/$/phoenix-open-issue/api/functions'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import PoiFunctionPrimary from '/$/phoenix-open-issue/components/workbench/PoiFunctionPrimary.vue'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'

const route = useRoute()
const store = useFunctionStore()
const settings = useSettingsStore()
const auth = useAuthStore()
const isSystemAdmin = computed(() => auth.user?.systemRole === 'admin')

// ── 列表 ──
const sortField = ref('')
const sortDir = ref('')
const statusFilter = ref<'enabled' | 'disabled' | 'all'>('enabled')

onMounted(() => doLoad())

async function doLoad() {
  const params: Record<string, any> = {}
  if (settings.funcSearch) params.search = settings.funcSearch
  params.enabled = statusFilter.value
  if (sortField.value) params.sort = `${sortField.value}:${sortDir.value || 'asc'}`
  if (settings.funcNumericSort && sortField.value === 'externalId') params.numericSort = '1'
  await store.load(params)
}

function onSortChange({ prop, order }: { prop: string; order: string | null }) {
  sortField.value = order ? prop : ''
  sortDir.value = order === 'ascending' ? 'asc' : 'desc'
  doLoad()
}

// ── 新建/编辑 ──
const showForm = ref(false)
const editTarget = ref<any>(null)
const form = ref({ platform: '', externalId: '', functionName: '', targetYear: '', clientGroup: '', developGroup: '' })

function openCreate() {
  editTarget.value = null
  form.value = { platform: '', externalId: '', functionName: '', targetYear: '', clientGroup: '', developGroup: '' }
  showForm.value = true
}

function updateSearch(value: string): void {
  settings.funcSearch = value
  void doLoad()
}

function updateNumericSort(value: string | number | boolean): void {
  settings.funcNumericSort = Boolean(value)
  void doLoad()
}

function updateStatusFilter(value: string): void {
  statusFilter.value = value === 'disabled' || value === 'all' ? value : 'enabled'
  void doLoad()
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiFunctionPrimary,
    props: computed(() => ({
      search: settings.funcSearch,
      numericSort: settings.funcNumericSort,
      statusFilter: statusFilter.value,
      itemCount: store.items.length,
      isAdmin: isSystemAdmin.value,
      onUpdateSearch: updateSearch,
      onUpdateNumericSort: updateNumericSort,
      onUpdateStatusFilter: updateStatusFilter,
      onRefresh: doLoad,
      onCreate: openCreate,
    })),
  },
})

function openEdit(row: any) {
  editTarget.value = row
  form.value = {
    platform: row.platform,
    externalId: row.externalId,
    functionName: row.functionName,
    targetYear: row.targetYear || '',
    clientGroup: row.clientGroup || '',
    developGroup: row.developGroup || '',
  }
  showForm.value = true
}

async function onSubmit() {
  const data = { ...form.value, targetYear: form.value.targetYear || undefined, clientGroup: form.value.clientGroup || undefined, developGroup: form.value.developGroup || undefined }
  if (editTarget.value) {
    await api.updateFunction(editTarget.value.id, data)
    ElMessage.success('已更新')
  } else {
    await api.createFunction(data)
    ElMessage.success('已创建')
  }
  showForm.value = false
  await doLoad()
}

async function onDelete(row: any) {
  const r = await pnwPromptChoice({
    title: '确认停用',
    message: `确定停用功能「${row.functionName}」？历史 Issue 关联将保留。`,
    choices: [{ id: 'delete', label: '停用', variant: 'danger' }, { id: 'cancel', label: '取消' }],
  })
  if (r.choiceId !== 'delete') return
  await api.deleteFunction(row.id)
  ElMessage.success('已停用')
  await doLoad()
}

async function onEnable(row: any) {
  const r = await pnwPromptChoice({
    title: '确认启用',
    message: `确定重新启用功能「${row.functionName}」？`,
    choices: [{ id: 'enable', label: '启用', variant: 'primary' }, { id: 'cancel', label: '取消' }],
  })
  if (r.choiceId !== 'enable') return
  await api.setFunctionEnabled(row.id, true)
  ElMessage.success('已启用')
  await doLoad()
}

// ── 导入 ──
const showImport = ref(false)
const importPreview = ref<any[]>([])
const importing = ref(false)

function onImportFile(file: any) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      importPreview.value = json.map((row: any) => mapXlsxRow(row))
      showImport.value = true
    } catch {
      ElMessage.error('XLSX 解析失败，请检查文件格式')
    }
  }
  reader.readAsArrayBuffer(file.raw)
}

async function onConfirmImport() {
  if (!importPreview.value.length) return
  importing.value = true
  try {
    const res = await api.importFunctions(importPreview.value)
    const data = res.data as { imported: number; updated: number }
    ElMessage.success(`导入完成：新增 ${data.imported} 条，更新 ${data.updated} 条`)
    showImport.value = false
    importPreview.value = []
    await doLoad()
  } finally {
    importing.value = false
  }
}

// ── 导出 ──
const exporting = ref(false)
async function onExport() {
  exporting.value = true
  try {
    const res = await api.exportFunctions()
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `functions-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
  } finally { exporting.value = false }
}

</script>

<template>
  <div class="page">
    <PnwPageHeader title="功能表">
      <template #actions>
        <div class="function-actions" data-tour="functions-actions">
          <el-button v-if="isSystemAdmin" type="primary" @click="openCreate">+ 新建</el-button>
          <el-upload v-if="isSystemAdmin" :auto-upload="false" :show-file-list="false" accept=".xlsx" @change="onImportFile">
            <el-button>📥 导入 XLSX</el-button>
          </el-upload>
          <el-button :loading="exporting" @click="onExport">📤 导出 JSON</el-button>
        </div>
      </template>
      <template #help><PageHelpButton page-id="functions" /></template>
    </PnwPageHeader>

    <el-table :data="store.items" v-loading="store.loading" stripe @sort-change="onSortChange" data-tour="functions-table">
      <el-table-column prop="platform" label="平台" width="140" sortable="custom" />
      <el-table-column prop="externalId" label="外部 ID" width="100" sortable="custom" />
      <el-table-column prop="functionName" label="功能名称" min-width="180" show-overflow-tooltip sortable="custom" />
      <el-table-column prop="targetYear" label="目标年份" width="100" align="center" />
      <el-table-column prop="clientGroup" label="客户群体" width="120" />
      <el-table-column prop="developGroup" label="开发组" width="120" />
      <el-table-column prop="createdAt" label="创建时间" width="160" />
      <el-table-column prop="enabled" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column v-if="isSystemAdmin" label="操作" width="140" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link size="small" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.enabled" link size="small" type="warning" @click="onDelete(row)">停用</el-button>
          <el-button v-else link size="small" type="success" @click="onEnable(row)">启用</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-empty v-if="!store.loading && !store.items.length" description="暂无功能数据，点击「新建」或「导入 XLSX」" />

    <!-- 新建/编辑对话框 -->
    <el-dialog v-model="showForm" :title="editTarget ? '编辑功能' : '新建功能'" width="480px">
      <el-form label-position="top">
        <el-form-item label="平台" required>
          <el-input v-model="form.platform" placeholder="如：游戏软件" />
        </el-form-item>
        <el-form-item label="外部 ID" required>
          <el-input v-model="form.externalId" placeholder="来源平台的 ID" />
        </el-form-item>
        <el-form-item label="功能名称" required>
          <el-input v-model="form.functionName" placeholder="如：打地鼠" />
        </el-form-item>
        <el-form-item label="目标年份">
          <el-input v-model="form.targetYear" placeholder="如：2024" />
        </el-form-item>
        <el-form-item label="客户群体">
          <el-input v-model="form.clientGroup" placeholder="如：娱乐" />
        </el-form-item>
        <el-form-item label="开发组">
          <el-input v-model="form.developGroup" placeholder="如：NodeJs" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" :disabled="!form.platform || !form.externalId || !form.functionName" @click="onSubmit">
          {{ editTarget ? '保存' : '创建' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 导入预览对话框 -->
    <el-dialog v-model="showImport" title="导入预览" width="700px">
      <p style="margin-bottom:8px;color:#909399">已解析 {{ importPreview.length }} 条记录。已存在的 (平台+ID) 将更新，新的将新增。</p>
      <el-table :data="importPreview" max-height="360" size="small" stripe>
        <el-table-column prop="platform" label="平台" width="120" />
        <el-table-column prop="externalId" label="外部 ID" width="90" />
        <el-table-column prop="functionName" label="功能名称" min-width="160" show-overflow-tooltip />
        <el-table-column prop="targetYear" label="目标年份" width="90" />
        <el-table-column prop="clientGroup" label="客户群体" width="100" />
        <el-table-column prop="developGroup" label="开发组" width="100" />
      </el-table>
      <template #footer>
        <el-button @click="showImport = false; importPreview = []">取消</el-button>
        <el-button type="primary" :loading="importing" @click="onConfirmImport">确认导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page { padding: 0; }
.function-actions { display: inline-flex; align-items: center; gap: 8px; }
.function-actions :deep(.el-button + .el-button) { margin-left: 0; }
</style>
