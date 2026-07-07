<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { getAllDict, createDictItem, updateDictItem, deleteDictItem, applyDictPreset, deleteDictByTag } from '@/api/dict'
import { ElMessage } from 'element-plus';
import { pnwPromptChoice, pnwAlert } from 'phoenix-wing'
import { changePassword } from '@/api/auth'
import { exportDb, importDb, repairIssueListLinks } from '@/api/backup'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import type { DictItem } from '@open-issue/core'

const activeTab = ref('dict')

// ═══════════════════ 数据字典 ═══════════════════
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
  const r = await pnwPromptChoice({ title: '确认', message: '确定删除？', choices: [{ id: 'delete', label: '删除', variant: 'danger' }, { id: 'cancel', label: '取消' }] })
  if (r.choiceId !== 'delete') return
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

// ═══════════════════ 按标签批量删除 ═══════════════════
const showDeleteByTag = ref(false)
const selectedTag = ref('')
const deletingByTag = ref(false)

const availableTags = (): { value: string; label: string; count: number }[] => {
  const tagMap: Record<string, { label: string; count: number }> = {}
  for (const item of items.value) {
    if (!item.tags) continue
    const tagList = item.tags.split(',').map(t => t.trim()).filter(Boolean)
    for (const t of tagList) {
      if (!tagMap[t]) {
        tagMap[t] = { label: t === 'automotive' ? '汽车' : t === 'software' ? '软件' : t, count: 0 }
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
    load()
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

// ═══════════════════ 数据备份 ═══════════════════
const exporting = ref(false)
const importing = ref(false)
const showImportConfirm = ref(false)
const importMode = ref<'replace' | 'merge'>('replace')
const importFileData = ref<any>(null)

async function onExport() {
  exporting.value = true
  try {
    const res = await exportDb()
    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('导出成功')
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
    ElMessage.success(`导入完成：${Object.entries(res.data.imported).map(([k, v]) => `${k} ${v}条`).join(', ')}`)
    showImportConfirm.value = false
    importFileData.value = null
  } finally { importing.value = false }
}

// ═══════════════════ 数据库修正 ═══════════════════
const repairing = ref(false)
const repairResult = ref<{ created: number; skipped: number } | null>(null)

async function onRepairLinks() {
  repairing.value = true
  repairResult.value = null
  try {
    const res = await repairIssueListLinks()
    repairResult.value = res.data
    ElMessage.success(`修正完成：补建 ${res.data.created} 条，现有 ${res.data.skipped} 条有效链接`)
  } catch {
    // error handled by interceptor
  } finally {
    repairing.value = false
  }
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="设置">
      <template #help><PageHelpButton page-id="settings" /></template>
    </PnwPageHeader>

    <el-tabs v-model="activeTab">
      <!-- ═══ 数据字典 ═══ -->
      <el-tab-pane label="📚 数据字典" name="dict">
        <div style="margin-bottom:12px;display:flex;gap:8px">
          <el-button type="default" size="small" @click="onApplyPreset('automotive')">🚗 汽车默认值</el-button>
          <el-button type="default" size="small" @click="onApplyPreset('software')">💻 软件默认值</el-button>
          <el-button type="primary" size="small" @click="showAdd = true">+ 添加</el-button>
          <el-button type="danger" size="small" plain @click="showDeleteByTag = true">🗑 删除一类值</el-button>
        </div>

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
      </el-tab-pane>

      <!-- ═══ 修改密码 ═══ -->
      <el-tab-pane label="🔑 修改密码" name="password">
        <el-form label-position="top" style="max-width:400px" @submit.prevent="onChangePassword">
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

      <!-- ═══ 数据备份 ═══ -->
      <el-tab-pane label="💾 数据备份" name="backup">
        <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
          <el-button type="primary" :loading="exporting" @click="onExport">
            📥 导出数据
          </el-button>
          <el-upload
            :auto-upload="false"
            :show-file-list="false"
            accept=".json"
            @change="onImportFile"
          >
            <el-button type="warning">📤 导入数据</el-button>
          </el-upload>
        </div>
        <p style="color:#909399;font-size:0.82rem">
          导出全部数据为 JSON 文件（不含密码哈希）。导入可替换或合并现有数据。
        </p>

        <el-dialog v-model="showImportConfirm" title="确认导入" width="400px">
          <p>导入将<strong>{{ importMode === 'replace' ? '清空并替换' : '追加合并' }}</strong>现有数据。</p>
          <el-radio-group v-model="importMode">
            <el-radio value="replace">替换模式（清空后导入）</el-radio>
            <el-radio value="merge">合并模式（追加不冲突的数据）</el-radio>
          </el-radio-group>
          <p style="color:#909399;font-size:0.82rem;margin-top:8px">
            导入后用户密码将统一重置为 <code>123456</code>
          </p>
          <template #footer>
            <el-button @click="showImportConfirm = false">取消</el-button>
            <el-button type="primary" :loading="importing" @click="onConfirmImport">确认导入</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <!-- ═══ 数据库修正 ═══ -->
      <el-tab-pane label="🔧 数据库修正" name="repair">
        <p style="color:#909399;font-size:0.82rem;margin-bottom:12px">
          为没有 <code>issueListLinks</code> 记录的 Issue 补建链接。如果列表中的 Issue 数量不对，请执行此修正。
        </p>
        <el-button type="success" :loading="repairing" @click="onRepairLinks">
          🔧 修正 Issue 链接
        </el-button>
        <span v-if="repairResult" style="margin-left:12px;font-size:0.85rem;color:#67C23A">
          已补建 {{ repairResult.created }} 条，现有 {{ repairResult.skipped }} 条有效链接
        </span>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
</style>
