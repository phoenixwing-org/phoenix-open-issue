<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  createEightDReport,
  deleteEightDReport,
  getEightDReportIssueOptions,
  getEightDReports,
  updateEightDReport,
} from '/$/phoenix-open-issue/api/eightDReports'
import EightDReportDialog from '/$/phoenix-open-issue/components/EightDReportDialog.vue'
import PoiCompactEditorView from '/$/phoenix-open-issue/components/workbench/PoiCompactEditorView.vue'
import PoiEightDReportsPrimary from '/$/phoenix-open-issue/components/workbench/PoiEightDReportsPrimary.vue'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'
import type { EightDReport, EightDReportInput, EightDReportIssueOption } from '/$/phoenix-open-issue/core'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'

type RelationFilter = 'all' | 'linked' | 'standalone'
interface ReportRow extends EightDReport {
  issueNo?: string | null
  issueTitle?: string | null
  listName?: string | null
  creatorName?: string | null
  _canModify: boolean
}

const route = useRoute()
const hostRouter = useRouter()
// 保留 legacy template 的 router.push('/issue/:id') 写法，前缀只在脚本 facade 中转换。
const router = {
  push(target: string) {
    return hostRouter.push(target.startsWith('/issue/') ? `/open-issue${target}` : target)
  },
}
const capabilities = useIssueCapabilities()
const reports = ref<ReportRow[]>([])
const issueOptions = ref<EightDReportIssueOption[]>([])
const loading = ref(false)
const search = ref('')
const filter = ref<RelationFilter>('all')
const showDialog = ref(false)
const editing = ref<ReportRow | null>(null)
const canCreate = computed(() => capabilities.can('phoenix-open-issue:report:write'))
const counts = computed(() => ({
  all: reports.value.length,
  linked: reports.value.filter(report => !!report.relatedIssueId).length,
  standalone: reports.value.filter(report => !report.relatedIssueId).length,
}))
const filtered = computed(() => {
  const query = search.value.trim().toLowerCase()
  return reports.value.filter(report => {
    if (filter.value === 'linked' && !report.relatedIssueId) return false
    if (filter.value === 'standalone' && report.relatedIssueId) return false
    if (!query) return true
    return [report.title, report.issueNo, report.issueTitle, report.listName, report.creatorName]
      .some(value => String(value ?? '').toLowerCase().includes(query))
  })
})

async function load() {
  loading.value = true
  try {
    const [reportResponse, issueResponse] = await Promise.all([
      getEightDReports(),
      canCreate.value ? getEightDReportIssueOptions() : Promise.resolve({ data: [] }),
    ])
    reports.value = reportResponse.data
    issueOptions.value = issueResponse.data
  } finally {
    loading.value = false
  }
}

onMounted(load)

function openCreate() {
  if (!canCreate.value) return
  editing.value = null
  showDialog.value = true
}

function openEdit(report: ReportRow) {
  if (!canCreate.value || !report._canModify) return
  editing.value = report
  showDialog.value = true
}

async function save(data: EightDReportInput) {
  if (!canCreate.value) return
  if (editing.value) await updateEightDReport(editing.value.id, data)
  else await createEightDReport(data)
  ElMessage.success(editing.value ? '8D 报告已更新' : '8D 报告已创建')
  showDialog.value = false
  await load()
}

async function remove(report: ReportRow) {
  if (!canCreate.value || !report._canModify) return
  try {
    await ElMessageBox.confirm(`确定删除“${report.title}”吗？`, '删除 8D 报告', { type: 'warning' })
    await deleteEightDReport(report.id)
    ElMessage.success('8D 报告已删除')
    await load()
  } catch { /* 用户取消 */ }
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiEightDReportsPrimary,
    props: computed(() => ({
      viewKey: 'phoenix-open-issue-eight-d-reports',
      filter: filter.value,
      counts: counts.value,
      onSelectFilter: (value: RelationFilter) => { filter.value = value },
    })),
  },
})
</script>

<template>
  <PoiCompactEditorView title="8D 报告" content-aria-label="8D 报告列表">
    <template #actions>
      <el-input v-model="search" clearable placeholder="搜索报告或关联 Issue" class="report-search" />
      <el-button v-if="canCreate" type="primary" @click="openCreate">新建报告</el-button>
    </template>

    <el-table class="view-table" :data="filtered" v-loading="loading" stripe size="small">
      <el-table-column prop="title" label="报告" min-width="220" show-overflow-tooltip />
      <el-table-column label="关联 Issue" min-width="230">
        <template #default="{ row }">
          <el-link v-if="row.relatedIssueId" type="primary" @click="router.push(`/issue/${row.relatedIssueId}`)">
            {{ row.issueNo }} · {{ row.issueTitle }}
          </el-link>
          <el-tag v-else type="info" effect="plain" size="small">独立报告</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="listName" label="归属列表" width="150" show-overflow-tooltip />
      <el-table-column prop="creatorName" label="创建人" width="120" />
      <el-table-column label="更新于" width="120"><template #default="{ row }">{{ row.updatedAt.slice(0, 10) }}</template></el-table-column>
      <el-table-column label="操作" width="145" fixed="right">
        <template #default="{ row }">
          <template v-if="row._canModify && canCreate">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
          <span v-else class="readonly">只读</span>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无 8D 报告" /></template>
    </el-table>

    <EightDReportDialog
      v-if="showDialog"
      :initial="editing"
      :issue-options="issueOptions"
      @confirm="save"
      @close="showDialog = false"
    />
  </PoiCompactEditorView>
</template>

<style scoped>
.report-search { width:260px; }
.readonly { color:var(--el-text-color-placeholder); }
.view-table { width: 100%; }
@media (max-width: 720px) { .report-search { width: min(48vw, 220px); } }
</style>
