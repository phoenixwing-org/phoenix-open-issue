<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { getAllDict, createDictItem, updateDictItem, deleteDictItem, applyDictPreset, deleteDictByTag, dedupeDict } from '@/api/dict'
import { ElMessage } from 'element-plus';
import { pnwPromptChoice, pnwAlert } from 'phoenix-wing'
import {
  changePassword,
  getExternalAuthProviders,
  getMyExternalIdentities,
  startExternalLink,
  unlinkMyExternalIdentity,
} from '@/api/auth'
import { exportDb, importDb, runDbRepair, type RepairTaskId, type RepairTaskResult } from '@/api/backup'
import { importFunctions } from '@/api/functions'
import { mapXlsxRow, parseDictTags } from '@open-issue/core'
import * as XLSX from 'xlsx'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import type { DictItem, ExternalAuthProviderId, ExternalAuthProviderInfo, ExternalIdentityPublic } from '@open-issue/core'
import { useDictStore, DICT_GROUPS } from '@/stores/dict'
import { useAuthStore } from '@/stores/auth'

const dictStore = useDictStore()
const authStore = useAuthStore()
const route = useRoute()
const isSystemAdmin = computed(() => authStore.user?.systemRole === 'admin')

const activeTab = ref(route.query.tab === 'login-methods' ? 'login-methods' : 'dict')

// ═══════════════════ 数据字典 ═══════════════════
const items = ref<DictItem[]>([])
const loading = ref(false)
const showAdd = ref(false)
const newGroup = ref('issueCategory')
const newValue = ref('')
const newLabel = ref('')
const newTags = ref('')
const showEdit = ref(false)
const editItem = ref<DictItem | null>(null)
const editValue = ref('')
const editLabel = ref('')
const editTags = ref('')

const groups = Object.entries(DICT_GROUPS).map(([value, label]) => ({ value, label }))

const presetLabels: Record<string, string> = {
  automotive: '汽车默认值',
  software: '软件默认值',
}

async function syncDictCache() {
  await dictStore.refresh()
  await load()
}

async function load() {
  loading.value = true
  try {
    const res = await getAllDict()
    items.value = res.data
  } finally { loading.value = false }
}

onMounted(async () => {
  await Promise.all([load(), loadLoginMethods()])
})

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
    syncDictCache()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '应用预设失败')
  }
}

const deduping = ref(false)

async function onDedupeDict() {
  const r = await pnwPromptChoice({
    title: '去重确认',
    message: '按「分组 + 值」合并重复字典行：保留一条并合并 tags，删除多余行。Issue 等引用的是 value，去重不影响已有数据。',
    choices: [
      { id: 'dedupe', label: '去重', variant: 'primary' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'dedupe') return
  deduping.value = true
  try {
    const res = await dedupeDict()
    const { removed, tagsMerged } = res.data
    if (removed > 0) {
      ElMessage.success(`已删除重复 ${removed} 条${tagsMerged ? `，合并 tags ${tagsMerged} 组` : ''}`)
    } else {
      ElMessage.info('未发现重复项')
    }
    syncDictCache()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '去重失败')
  } finally {
    deduping.value = false
  }
}

async function onAdd() {
  if (!newValue.value.trim() || !newLabel.value.trim()) return
  try {
    await createDictItem({
      groupName: newGroup.value,
      value: newValue.value.trim(),
      label: newLabel.value.trim(),
      tags: newTags.value.trim() || undefined,
    })
    ElMessage.success('已添加')
    newValue.value = ''
    newLabel.value = ''
    newTags.value = ''
    showAdd.value = false
    syncDictCache()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.response?.data?.message || '添加失败')
  }
}

function onOpenEdit(item: DictItem) {
  editItem.value = item
  editValue.value = item.value
  editLabel.value = item.label
  editTags.value = parseDictTags(item.tags).join(', ')
  showEdit.value = true
}

async function onSaveEdit() {
  if (!editItem.value) return
  try {
    const payload: { label: string; value?: string; tags: string } = {
      label: editLabel.value.trim(),
      tags: editTags.value.trim(),
    }
    if (!isCoreItem(editItem.value)) {
      payload.value = editValue.value.trim()
    }
    await updateDictItem(editItem.value.id, payload)
    ElMessage.success('已保存')
    showEdit.value = false
    syncDictCache()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || e?.response?.data?.message || '保存失败')
  }
}

async function onToggle(item: DictItem) {
  await updateDictItem(item.id, { enabled: item.enabled ? 0 : 1 })
  ElMessage.success(item.enabled ? '已禁用' : '已启用')
  syncDictCache()
}

async function onDelete(id: string) {
  const r = await pnwPromptChoice({ title: '确认', message: '确定删除？', choices: [{ id: 'delete', label: '删除', variant: 'danger' }, { id: 'cancel', label: '取消' }] })
  if (r.choiceId !== 'delete') return
  try {
    await deleteDictItem(id)
    ElMessage.success('已删除')
    syncDictCache()
  } catch (e: any) {
    if (e?.response?.status === 409) {
      const msg = e.response.data?.message || e.response.data?.error || '该字典项正在使用中，无法删除'
      await pnwAlert('无法删除', msg)
    } else if (e?.response?.status === 403) {
      await pnwAlert('无法删除', e.response.data?.message || e.response.data?.error || '内置字典项不可删除')
    } else {
      ElMessage.error('删除失败')
    }
  }
}

// ═══════════════════ 按标签批量删除 ═══════════════════
const showDeleteByTag = ref(false)
const selectedTag = ref('')
const deletingByTag = ref(false)

const availableTags = (): { value: string; label: string; count: number }[] => {
  const tagMap: Record<string, { label: string; count: number }> = {}
  for (const item of items.value) {
    if (!item.tags) continue
    const tagList = parseDictTags(item.tags)
    for (const t of tagList) {
      if (!tagMap[t]) {
        tagMap[t] = { label: t === 'automotive' ? '汽车' : t === 'software' ? '软件' : t === 'general' ? '通用' : t === 'core' ? '内置' : t, count: 0 }
      }
      tagMap[t].count++
    }
  }
  return Object.entries(tagMap).map(([value, { label, count }]) => ({ value, label: `${label} (${count} 项)`, count }))
}

async function onDeleteByTag() {
  if (!selectedTag.value) {
    ElMessage.warning('请选择要删除的标签')
    return
  }
  const tagInfo = availableTags().find(t => t.value === selectedTag.value)
  const r = await pnwPromptChoice({
    title: '确认删除一类值',
    message: `将删除所有标签为「${tagInfo?.label || selectedTag.value}」的字典项。\n无引用的项会被删除，有引用的项会跳过。`,
    choices: [
      { id: 'delete', label: '删除', variant: 'danger' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'delete') return

  deletingByTag.value = true
  try {
    const res = await deleteDictByTag(selectedTag.value)
    const data = res.data as { deleted: number; skipped: number; details: { id: string; label: string; groupName: string; reason: string }[] }
    if (data.skipped > 0) {
      const skippedItems = data.details.filter(d => d.reason !== '已删除').map(d => `「${d.label}」— ${d.reason}`).join('\n')
      await pnwAlert(
        '部分删除',
        `已删除 ${data.deleted} 项，跳过 ${data.skipped} 项（有引用）：\n${skippedItems}`
      )
    } else if (data.deleted > 0) {
      ElMessage.success(`已删除 ${data.deleted} 项`)
    } else {
      ElMessage.info('没有可删除的项')
    }
    showDeleteByTag.value = false
    selectedTag.value = ''
    syncDictCache()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.error || '删除失败')
  } finally {
    deletingByTag.value = false
  }
}

function tagColor(tag: string): string {
  const map: Record<string, string> = {
    automotive: '#409EFF',
    software: '#67C23A',
    general: '#909399',
    core: '#E6A23C',
  }
  return map[tag] || '#909399'
}

function tagLabel(tag: string): string {
  const map: Record<string, string> = {
    automotive: '汽车',
    software: '软件',
    general: '通用',
    core: '内置',
  }
  return map[tag] || tag
}

function isCoreItem(row: DictItem): boolean {
  return dictStore.isCoreItem(row)
}

function groupedItems(): Record<string, DictItem[]> {
  const map: Record<string, DictItem[]> = {}
  for (const g of groups) {
    map[g.value] = items.value.filter(i => i.groupName === g.value)
  }
  return map
}

// ═══════════════════ 修改密码 ═══════════════════
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')

async function onChangePassword() {
  if (newPassword.value !== confirmPassword.value) {
    ElMessage.error('两次密码输入不一致')
    return
  }
  if (newPassword.value.length < 6) {
    ElMessage.error('密码长度不能少于6位')
    return
  }
  try {
    await changePassword(oldPassword.value, newPassword.value)
    ElMessage.success('密码已修改')
    oldPassword.value = ''
    newPassword.value = ''
    confirmPassword.value = ''
  } catch { /* error handled by interceptor */ }
}

// ═══════════════════ 第三方登录方式 ═══════════════════
const externalProviders = ref<ExternalAuthProviderInfo[]>([])
const externalIdentities = ref<ExternalIdentityPublic[]>([])
const loginMethodsLoading = ref(false)
const bindingProvider = ref<ExternalAuthProviderId | ''>('')

async function loadLoginMethods() {
  loginMethodsLoading.value = true
  try {
    const [providersRes, identitiesRes] = await Promise.all([
      getExternalAuthProviders(),
      getMyExternalIdentities(),
    ])
    externalProviders.value = providersRes.data
    externalIdentities.value = identitiesRes.data
  } finally {
    loginMethodsLoading.value = false
  }
}

function hasActiveIdentity(provider: ExternalAuthProviderId): boolean {
  return externalIdentities.value.some(identity => identity.provider === provider && identity.status === 'active')
}

async function onBindExternal(provider: ExternalAuthProviderId) {
  bindingProvider.value = provider
  try {
    const res = await startExternalLink(provider)
    window.location.assign(res.data.authorizationUrl)
  } catch {
    bindingProvider.value = ''
  }
}

async function onUnlinkExternal(identity: ExternalIdentityPublic) {
  const label = identity.displayName || identity.email || '当前飞书账号'
  const result = await pnwPromptChoice({
    title: '解除飞书绑定',
    message: `确定解除「${label}」？解除后将不能再使用该飞书账号登录，但本地账号密码仍可正常使用。`,
    choices: [
      { id: 'unlink', label: '解除绑定', variant: 'danger' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (result.choiceId !== 'unlink') return
  await unlinkMyExternalIdentity(identity.id)
  ElMessage.success('已解除飞书绑定')
  await loadLoginMethods()
}

function formatIdentityTime(value: string | null): string {
  if (!value) return '尚未使用'
  return new Date(value).toLocaleString('zh-CN', { hour12: false })
}

// ═══════════════════ 数据备份 ═══════════════════
const exporting = ref(false)
const importing = ref(false)
const showImportConfirm = ref(false)
const importMode = ref<'replace' | 'merge'>('replace')
const importFileData = ref<any>(null)

async function onExport(passwordPolicy: 'resetAll' | 'resetAdmin' = 'resetAll') {
  exporting.value = true
  try {
    const res = await exportDb(passwordPolicy)
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const prefix = passwordPolicy === 'resetAdmin' ? 'migration' : 'backup'
    a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success(passwordPolicy === 'resetAdmin' ? '迁移导出成功' : '备份导出成功')
  } finally { exporting.value = false }
}

function onImportFile(file: any) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      importFileData.value = JSON.parse(e.target?.result as string)
      showImportConfirm.value = true
    } catch {
      ElMessage.error('JSON 解析失败，请检查文件格式')
    }
  }
  reader.readAsText(file.raw)
}

async function onConfirmImport() {
  if (!importFileData.value) return
  importing.value = true
  try {
    const res = await importDb(importFileData.value, importMode.value)
    const passwordMessage = res.data.passwords
      ? `；密码保留 ${res.data.passwords.preserved} 个，重置 ${res.data.passwords.reset} 个`
      : ''
    ElMessage.success(`导入完成：${Object.entries(res.data.imported).map(([k, v]) => `${k} ${v}条`).join(', ')}${passwordMessage}`)
    showImportConfirm.value = false
    importFileData.value = null
  } finally { importing.value = false }
}

// ═══════════════════ 数据库修正 ═══════════════════
interface RepairTaskDef {
  id: RepairTaskId
  title: string
  description: string
  buttonType: '' | 'success' | 'warning' | 'primary'
}

const REPAIR_TASKS: RepairTaskDef[] = [
  {
    id: 'schema',
    title: '表结构补全',
    description: '创建缺失的数据表，追加 users / issueLists / checkpoints / issueListLinks 等表的缺失列，并执行 listType、systemRole 等数据迁移。',
    buttonType: 'primary',
  },
  {
    id: 'checkpoints',
    title: '点检数据修正',
    description: '补全 checkpoints 表缺失列（status、sortOrder、createdAt、updatedAt 等），并为空值记录回填默认值。',
    buttonType: 'success',
  },
  {
    id: 'links',
    title: 'Issue 链接修正',
    description: '为没有 issueListLinks 记录的 Issue 补建链接；清理重复的链接记录。',
    buttonType: 'success',
  },
  {
    id: 'dict',
    title: '数据字典补全',
    description: '补全 dict 缺失列、规范 tags、去重并建立 (groupName,value) 唯一索引。旧库有重复时不阻塞启动，请登录后在此修正；不新增字典行。',
    buttonType: 'success',
  },
  {
    id: 'users',
    title: '用户权限补全',
    description: '旧库缺 systemRole 列时：admin 账号设为管理员，其余用户默认编辑权限。',
    buttonType: 'success',
  },
  {
    id: 'linkAttention',
    title: '链接关注系数迁移',
    description: '将旧库 issueListLinks.voided* 迁移为 attentionLevel，并删除 voided / voidedAt / voidedBy 三列。新库无需执行。',
    buttonType: 'success',
  },
  {
    id: 'issueNo',
    title: 'Issue 编号去重',
    description: '检测重复的 issueNo（如多个 ISS-2026-0001），按创建时间顺序重编为 ISS-2026-0001、0002、0003…，同一年份内全局连续编号。',
    buttonType: 'success',
  },
  {
    id: 'all',
    title: '全部执行',
    description: '按顺序执行以上所有修正任务。升级后建议先执行一次。',
    buttonType: 'warning',
  },
]

const repairingTask = ref<RepairTaskId | null>(null)
const repairResults = ref<RepairTaskResult[]>([])

async function onRepairTask(taskId: RepairTaskId) {
  repairingTask.value = taskId
  if (taskId !== 'all') repairResults.value = []
  try {
    const res = await runDbRepair(taskId)
    const data = res.data as { results: RepairTaskResult[]; totalFixed: number; message: string }
    if (taskId === 'all') {
      repairResults.value = data.results
    } else {
      repairResults.value = data.results
    }
    ElMessage.success(data.message + (data.totalFixed ? `（共修正 ${data.totalFixed} 项）` : ''))
  } catch {
    // error handled by interceptor
  } finally {
    repairingTask.value = null
  }
}

function repairResultFor(taskId: RepairTaskId): RepairTaskResult | undefined {
  return repairResults.value.find(r => r.task === taskId)
}

// ═══════════════════ 功能导入 ═══════════════════
const showFuncImport = ref(false)
const funcImportPreview = ref<any[]>([])
const funcImporting = ref(false)

function onFuncImportFile(file: any) {
  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer)
      const workbook = XLSX.read(data, { type: 'array' })
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const json = XLSX.utils.sheet_to_json(sheet)
      funcImportPreview.value = json.map((row: any) => mapXlsxRow(row))
      showFuncImport.value = true
    } catch {
      ElMessage.error('XLSX 解析失败，请检查文件格式')
    }
  }
  reader.readAsArrayBuffer(file.raw)
}

async function onFuncImportConfirm() {
  if (!funcImportPreview.value.length) return
  funcImporting.value = true
  try {
    const res = await importFunctions(funcImportPreview.value)
    const data = res.data as { imported: number; updated: number }
    ElMessage.success(`导入完成：新增 ${data.imported} 条，更新 ${data.updated} 条`)
    showFuncImport.value = false
    funcImportPreview.value = []
  } finally { funcImporting.value = false }
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="设置">
      <template #help><PageHelpButton page-id="settings" /></template>
    </PnwPageHeader>

    <el-tabs v-model="activeTab" data-tour="settings-tabs">
      <!-- ═══ 数据字典 ═══ -->
      <el-tab-pane label="📚 数据字典" name="dict">
        <p style="color:#909399;font-size:0.82rem;margin-bottom:12px">
          各分组内「值」不可重复（含严重度、问题分类等）。标签可填多个，英文逗号分隔（如 <code>automotive,general</code>）。
        </p>
        <div v-if="isSystemAdmin" style="margin-bottom:12px;display:flex;gap:8px" data-tour="settings-dict-toolbar">
          <el-button type="default" size="small" @click="onApplyPreset('automotive')">🚗 汽车默认值</el-button>
          <el-button type="default" size="small" @click="onApplyPreset('software')">💻 软件默认值</el-button>
          <el-button type="primary" size="small" @click="showAdd = true">+ 添加</el-button>
          <el-button type="warning" size="small" plain :loading="deduping" @click="onDedupeDict">去重</el-button>
          <el-button type="danger" size="small" plain @click="showDeleteByTag = true">🗑 删除一类值</el-button>
        </div>

        <div v-loading="loading" data-tour="settings-dict-list">
          <div v-for="g in groups" :key="g.value" style="margin-bottom:20px">
            <h3 style="margin-bottom:8px">{{ g.label }} ({{ groupedItems()[g.value]?.length || 0 }})</h3>
            <el-table :data="groupedItems()[g.value]" size="small" stripe>
              <el-table-column prop="value" label="值" width="140" />
              <el-table-column prop="label" label="显示名" width="140" />
              <el-table-column label="标签" width="160">
                <template #default="{ row }">
                  <template v-if="row.tags">
                    <el-tag
                      v-for="t in parseDictTags(row.tags)"
                      :key="t"
                      size="small"
                      :color="tagColor(t)"
                      effect="dark"
                      style="margin-right:4px;margin-bottom:2px"
                    >{{ tagLabel(t) }}</el-tag>
                  </template>
                  <span v-else style="color:#909399;font-size:12px">—</span>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="70" align="center">
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column v-if="isSystemAdmin" label="操作" width="140">
                <template #default="{ row }">
                  <el-button link size="small" @click="onOpenEdit(row)">编辑</el-button>
                  <el-button link size="small" @click="onToggle(row)">{{ row.enabled ? '禁用' : '启用' }}</el-button>
                  <el-button v-if="!isCoreItem(row)" link size="small" type="danger" @click="onDelete(row.id)">删除</el-button>
                  <span v-else style="color:#909399;font-size:12px">内置</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
          <el-empty v-if="!items.length && !loading" description="暂无字典数据，点击添加" />
        </div>

        <el-dialog v-model="showDeleteByTag" title="删除一类值" width="450px">
          <p style="margin-bottom:12px;color:#909399;font-size:0.88rem">
            选择要删除的标签，系统将逐个检查引用关系：<strong>无引用的项会被删除，有引用的项会跳过</strong>。
          </p>
          <el-form label-position="top">
            <el-form-item label="选择标签">
              <el-select v-model="selectedTag" placeholder="请选择要删除的标签" style="width:100%">
                <el-option
                  v-for="t in availableTags()"
                  :key="t.value"
                  :label="t.label"
                  :value="t.value"
                />
              </el-select>
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showDeleteByTag = false; selectedTag = ''">取消</el-button>
            <el-button type="danger" :loading="deletingByTag" :disabled="!selectedTag" @click="onDeleteByTag">
              确认删除
            </el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="showAdd" title="添加字典项" width="400px">
          <el-form label-position="top">
            <el-form-item label="分组">
              <el-select v-model="newGroup">
                <el-option v-for="g in groups" :key="g.value" :label="g.label" :value="g.value" />
              </el-select>
            </el-form-item>
            <el-form-item label="值">
              <el-input v-model="newValue" placeholder="如：safety（同分组内唯一）" />
            </el-form-item>
            <el-form-item label="显示名">
              <el-input v-model="newLabel" placeholder="如：安全" />
            </el-form-item>
            <el-form-item label="标签">
              <el-input v-model="newTags" placeholder="可选，多个用英文逗号分隔，如 general,custom" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showAdd = false">取消</el-button>
            <el-button type="primary" @click="onAdd">添加</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="showEdit" title="编辑字典项" width="420px">
          <el-form v-if="editItem" label-position="top">
            <el-form-item label="分组">
              <el-input :model-value="groups.find(g => g.value === editItem!.groupName)?.label || editItem!.groupName" disabled />
            </el-form-item>
            <el-form-item label="值">
              <el-input v-model="editValue" :disabled="isCoreItem(editItem)" placeholder="同分组内唯一" />
            </el-form-item>
            <el-form-item label="显示名">
              <el-input v-model="editLabel" />
            </el-form-item>
            <el-form-item label="标签">
              <el-input v-model="editTags" placeholder="多个用英文逗号分隔" />
            </el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showEdit = false">取消</el-button>
            <el-button type="primary" @click="onSaveEdit">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- ═══ 修改密码 ═══ -->
      <el-tab-pane label="🔑 修改密码" name="password">
        <el-form label-position="top" style="max-width:400px" @submit.prevent="onChangePassword" data-tour="settings-password">
          <el-form-item label="当前密码">
            <el-input v-model="oldPassword" type="password" show-password />
          </el-form-item>
          <el-form-item label="新密码" :error="newPassword && newPassword.length < 6 ? '密码长度不能少于6位' : ''">
            <el-input v-model="newPassword" type="password" show-password autocomplete="new-password" />
            <span v-if="!newPassword" style="color:#909399;font-size:11px">至少 6 位字符</span>
          </el-form-item>
          <el-form-item label="确认新密码" :error="confirmPassword && newPassword !== confirmPassword ? '两次密码输入不一致' : ''">
            <el-input v-model="confirmPassword" type="password" show-password autocomplete="new-password" />
          </el-form-item>
          <el-button type="primary" @click="onChangePassword" :disabled="!oldPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || newPassword.length < 6">
            修改密码
          </el-button>
        </el-form>
      </el-tab-pane>

      <!-- ═══ 登录方式 ═══ -->
      <el-tab-pane label="🔐 登录方式" name="login-methods">
        <div v-loading="loginMethodsLoading" class="login-methods" data-tour="settings-login-methods">
          <div class="login-method local-method">
            <div class="login-method-icon">🔑</div>
            <div class="login-method-body">
              <strong>本地账号密码</strong>
              <p>账号：{{ authStore.user?.username }}。这是当前账号的基础登录方式。</p>
            </div>
            <el-tag type="success">已启用</el-tag>
          </div>

          <div
            v-for="identity in externalIdentities"
            :key="identity.id"
            class="login-method"
          >
            <el-avatar v-if="identity.avatarUrl" :src="identity.avatarUrl" :size="42" />
            <div v-else class="login-method-icon">🪶</div>
            <div class="login-method-body">
              <strong>飞书 · {{ identity.displayName || identity.email || '已绑定账号' }}</strong>
              <p>租户：{{ identity.tenantKey || '未知' }} · 最后登录：{{ formatIdentityTime(identity.lastLoginAt) }}</p>
            </div>
            <el-tag v-if="identity.status === 'active'" type="success">已绑定</el-tag>
            <el-tag v-else type="info">已解除</el-tag>
            <el-button
              v-if="identity.status === 'active'"
              type="danger"
              plain
              size="small"
              @click="onUnlinkExternal(identity)"
            >解除绑定</el-button>
          </div>

          <div v-for="provider in externalProviders" :key="provider.id" class="provider-action">
            <el-button
              v-if="!hasActiveIdentity(provider.id)"
              type="primary"
              :loading="bindingProvider === provider.id"
              @click="onBindExternal(provider.id)"
            >🪶 绑定{{ provider.name }}账号</el-button>
            <span v-else class="provider-hint">{{ provider.name }}已绑定，可在登录页直接使用。</span>
          </div>

          <el-alert
            v-if="!externalProviders.length && !externalIdentities.length"
            title="管理员尚未启用第三方登录；本地账号密码不受影响。"
            type="info"
            show-icon
            :closable="false"
          />
          <p class="security-hint">第三方身份只用于确认登录用户，组织、角色和列表权限仍由本系统管理。</p>
        </div>
      </el-tab-pane>

      <!-- ═══ 数据备份 ═══ -->
      <el-tab-pane label="💾 数据备份" name="backup">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px" data-tour="settings-backup">
          <el-button type="primary" :loading="exporting" @click="onExport('resetAll')">
            📥 {{ isSystemAdmin ? '备份导出' : '导出我的数据' }}
          </el-button>
          <el-button v-if="isSystemAdmin" type="success" :loading="exporting" @click="onExport('resetAdmin')">
            📦 迁移导出
          </el-button>
          <el-upload
            v-if="isSystemAdmin"
            :auto-upload="false"
            :show-file-list="false"
            accept=".json"
            @change="onImportFile"
          >
            <el-button type="warning">📤 导入数据</el-button>
          </el-upload>
        </div>
        <p style="color:#909399;font-size:0.82rem">
          <template v-if="isSystemAdmin">
            备份导出包含全部业务数据但不含密码哈希，导入后所有用户密码重置为 <code>123456</code>。迁移导出仅保留非 admin 用户的密码哈希，导入时只重置 admin。导入仅管理员可用。
          </template>
          <template v-else>
            仅导出你可访问列表及其 Issue、点检、链接和相关推送；不包含用户、组织、字典或功能数据，且该文件不能导入数据库。
          </template>
        </p>

        <el-dialog v-model="showImportConfirm" title="确认导入" width="400px">
          <p>导入将<strong>{{ importMode === 'replace' ? '清空并替换' : '追加合并' }}</strong>现有数据。</p>
          <el-radio-group v-model="importMode">
            <el-radio value="replace">替换模式（清空后导入）</el-radio>
            <el-radio value="merge">合并模式（追加不冲突的数据）</el-radio>
          </el-radio-group>
          <p style="color:#909399;font-size:0.82rem;margin-top:8px">
            <template v-if="importFileData?.passwordPolicy === 'resetAdmin'">
              此迁移文件会保留非 admin 用户密码，仅将 admin 重置为 <code>123456</code>。
            </template>
            <template v-else>
              此备份文件不含密码哈希，导入后用户密码将统一重置为 <code>123456</code>。
            </template>
          </p>
          <template #footer>
            <el-button @click="showImportConfirm = false">取消</el-button>
            <el-button type="primary" :loading="importing" @click="onConfirmImport">确认导入</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- ═══ 数据库修正 ═══ -->
      <el-tab-pane label="🔧 数据库修正" name="repair">
        <p style="color:#909399;font-size:0.82rem;margin-bottom:16px">
          升级版本后若出现功能异常、数据缺失或列表 Issue 数量不对，可在此逐项修正。所有操作幂等，可重复执行。
          若控制台提示数据字典重复，请先执行<strong>数据字典补全</strong>（系统仍可正常登录使用）。
        </p>

        <div class="repair-list" data-tour="settings-repair">
          <div v-for="task in REPAIR_TASKS" :key="task.id" class="repair-item">
            <div class="repair-item-head">
              <strong>{{ task.title }}</strong>
              <el-button
                :type="task.buttonType || 'default'"
                size="small"
                :loading="repairingTask === task.id"
                :disabled="!!repairingTask && repairingTask !== task.id"
                @click="onRepairTask(task.id)"
              >
                {{ task.id === 'all' ? '▶ 全部执行' : '执行修正' }}
              </el-button>
            </div>
            <p class="repair-desc">{{ task.description }}</p>
            <div v-if="repairResultFor(task.id)" class="repair-result">
              <el-tag type="success" size="small">{{ repairResultFor(task.id)!.message }}</el-tag>
              <ul v-if="repairResultFor(task.id)!.details.length">
                <li v-for="(line, i) in repairResultFor(task.id)!.details" :key="i">{{ line }}</li>
              </ul>
            </div>
          </div>
        </div>
      </el-tab-pane>

      <!-- ═══ 功能导入 ═══ -->
      <el-tab-pane label="📋 功能导入" name="function-import">
        <p style="color:#909399;font-size:0.82rem;margin-bottom:12px">
          从 <code>.xlsx</code> 文件导入功能表数据。已存在的 (平台+ID) 将更新，新的将新增。
        </p>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx" @change="onFuncImportFile" data-tour="settings-function-import">
          <el-button type="primary">📥 选择 XLSX 文件</el-button>
        </el-upload>
        <p style="margin-top:8px;color:#909399;font-size:0.78rem">
          列名支持中文（平台/id/功能/目标年份/客户分组/开发组）或英文（platform/id/function/targetYear/clientGroup/developGroup）。
        </p>

        <el-dialog v-model="showFuncImport" title="导入预览" width="700px">
          <p style="margin-bottom:8px;color:#909399">已解析 {{ funcImportPreview.length }} 条记录</p>
          <el-table :data="funcImportPreview" max-height="360" size="small" stripe>
            <el-table-column prop="platform" label="平台" width="120" />
            <el-table-column prop="externalId" label="外部 ID" width="90" />
            <el-table-column prop="functionName" label="功能名称" min-width="160" show-overflow-tooltip />
            <el-table-column prop="targetYear" label="目标年份" width="90" />
            <el-table-column prop="clientGroup" label="客户群体" width="100" />
            <el-table-column prop="developGroup" label="开发组" width="100" />
          </el-table>
          <template #footer>
            <el-button @click="showFuncImport = false; funcImportPreview = []">取消</el-button>
            <el-button type="primary" :loading="funcImporting" @click="onFuncImportConfirm">确认导入</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
.repair-list { display: flex; flex-direction: column; gap: 16px; max-width: 720px; }
.repair-item { padding: 14px 16px; border: 1px solid #ebeef5; border-radius: 8px; background: #fafafa; }
.repair-item-head { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 6px; }
.repair-desc { margin: 0 0 8px; font-size: 0.82rem; color: #909399; line-height: 1.5; }
.repair-result { margin-top: 8px; font-size: 0.82rem; }
.repair-result ul { margin: 6px 0 0; padding-left: 18px; color: #606266; }
.repair-result li { margin-bottom: 2px; }
.login-methods { display: flex; flex-direction: column; gap: 12px; max-width: 760px; min-height: 120px; }
.login-method { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #e4e7ed; border-radius: 9px; background: #fff; }
.local-method { background: #fafcff; }
.login-method-icon { width: 42px; height: 42px; display: grid; place-items: center; flex: 0 0 42px; border-radius: 10px; background: #eef4ff; font-size: 22px; }
.login-method-body { flex: 1; min-width: 0; }
.login-method-body p { margin: 4px 0 0; color: #909399; font-size: .8rem; }
.provider-action { display: flex; align-items: center; min-height: 38px; }
.provider-hint, .security-hint { color: #909399; font-size: .82rem; }
.security-hint { margin: 2px 0 0; }
</style>
