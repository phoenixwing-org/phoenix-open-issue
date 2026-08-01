<script setup lang="ts">
import { onMounted, ref, computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '/$/phoenix-open-issue/stores/issueLists'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import { canPerformListAction, isSystemAdmin, isSystemViewer } from '/$/phoenix-open-issue/core'
import type { MemberRole } from '/$/phoenix-open-issue/core'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "/$/phoenix-open-issue/components/PageHelpButton.vue"
import ListFormDialog from '/$/phoenix-open-issue/components/ListFormDialog.vue'
import { useDictGroup } from '/$/phoenix-open-issue/composables/useDictGroup'
import { confirmListArchive, listLifecycleStatus } from '/$/phoenix-open-issue/utils/listLifecycle'
import PoiIssueListPrimary from '/$/phoenix-open-issue/components/workbench/PoiIssueListPrimary.vue'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'

const route = useRoute()
const router = useRouter()
const store = useIssueListStore()
const auth = useAuthStore()
const listTypeDict = useDictGroup('listType')
const showCreate = ref(false)
const editTarget = ref<string | null>(null)
type ListView = 'all' | 'active' | 'archived' | 'deleted'
const listView = ref<ListView>('all')
const searchText = ref('')
const listTypeFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(30)
const PAGE_SIZE_OPTIONS = [30, 50, 100]

const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))
const canCreateList = computed(() => Boolean(auth.user && !isSystemViewer(auth.user)))

const filteredLists = computed(() => {
  const keyword = searchText.value.trim().toLocaleLowerCase()
  return store.lists.filter(list => {
    if (listTypeFilter.value && list.listType !== listTypeFilter.value) return false
    if (!keyword) return true
    return [list.name, list.description, list.ownerName]
      .some(value => value?.toLocaleLowerCase().includes(keyword))
  })
})

const paginatedLists = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredLists.value.slice(start, start + pageSize.value)
})

const hasActiveFilters = computed(() => Boolean(searchText.value.trim() || listTypeFilter.value))
const emptyDescription = computed(() => ({
  all: '暂无可访问的列表',
  active: '暂无正常列表',
  archived: '暂无已归档列表',
  deleted: '暂无已删除列表',
})[listView.value])

watch([searchText, listTypeFilter, pageSize, listView], () => { currentPage.value = 1 })
watch(() => filteredLists.value.length, (total) => {
  const lastPage = Math.max(1, Math.ceil(total / pageSize.value))
  if (currentPage.value > lastPage) currentPage.value = lastPage
})

function clearFilters() {
  searchText.value = ''
  listTypeFilter.value = ''
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiIssueListPrimary,
    props: computed(() => ({
      searchText: searchText.value,
      listType: listTypeFilter.value,
      listTypeOptions: listTypeDict.options.value,
      hasActiveFilters: hasActiveFilters.value,
      onUpdateSearch: (value: string) => {
        searchText.value = value
      },
      onUpdateListType: (value: string) => {
        listTypeFilter.value = value
      },
      onClear: clearFilters,
    })),
  },
})

onMounted(() => {
  loadLists()
})

async function loadLists() {
  switch (listView.value) {
    case 'all':
      if (isAdmin.value) await store.fetchAllLists(true, true)
      else await store.fetchLists(true)
      break
    case 'active':
      if (isAdmin.value) await store.fetchAllLists()
      else await store.fetchLists()
      break
    case 'archived':
      await store.fetchArchivedLists()
      break
    case 'deleted':
      await store.fetchDeletedLists()
      break
  }
}

async function switchView(view: string | number | boolean | undefined) {
  if (view !== 'all' && view !== 'active' && view !== 'archived' && view !== 'deleted') return
  listView.value = view
  await loadLists()
}

function canEditOwner(row: { myRole?: MemberRole | null }) {
  if (!auth.user) return false
  return canPerformListAction(auth.user, row.myRole ?? null, 'manage-members')
}

function canEdit(row: { myRole?: MemberRole | null }) {
  if (!auth.user) return false
  return canPerformListAction(auth.user, row.myRole ?? null, 'manage-list')
}

function canDelete(row: { myRole?: MemberRole | null }) {
  if (!auth.user) return false
  return canPerformListAction(auth.user, row.myRole ?? null, 'delete-list')
}

function goDetail(id: string, name: string) {
  void name
  void router.push(`/open-issue/list/${id}`)
}

async function onCreate(data: any) {
  await store.createList(data)
  showCreate.value = false
  ElMessage.success('创建成功')
}

async function onEdit(data: any) {
  if (editTarget.value) {
    await store.updateList(editTarget.value, data)
    editTarget.value = null
    ElMessage.success('更新成功')
  }
}

async function onDelete(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定删除列表「${name}」？列表将被标记为已删除，数据仍保留在系统中。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    await store.deleteList(id)
    await loadLists()
  } catch {
    // 用户取消
  }
}

async function onArchive(id: string, name: string, archived: boolean) {
  if (!await confirmListArchive(name, archived)) return
  await store.archiveList(id, archived)
  await loadLists()
}

async function onRestore(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定恢复列表「${name}」？`,
      '确认恢复',
      { confirmButtonText: '恢复', cancelButtonText: '取消', type: 'info' },
    )
    await store.restoreList(id)
    await loadLists()
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="列表管理">
      <template #actions>
        <el-button v-if="['all', 'active'].includes(listView) && canCreateList" type="primary" @click="showCreate = true" data-tour="lists-create">
          <el-icon><Plus /></el-icon> 新建列表
        </el-button>
        <el-radio-group
          v-model="listView"
          size="small"
          @change="switchView"
          data-tour="lists-status"
        >
          <el-radio-button value="all">全部</el-radio-button>
          <el-radio-button value="active">正常</el-radio-button>
          <el-radio-button value="archived">已归档</el-radio-button>
          <el-radio-button v-if="isAdmin" value="deleted">已删除</el-radio-button>
        </el-radio-group>
      </template>
      <template #help><PageHelpButton page-id="lists" /></template>
    </PnwPageHeader>

    <el-table :data="paginatedLists" v-loading="store.loading" stripe data-tour="lists-table">
      <el-table-column type="index" :index="(index: number) => (currentPage - 1) * pageSize + index + 1" label="#" width="50" align="center" fixed />
      <el-table-column prop="name" label="名称" min-width="180" fixed="left">
        <template #default="{ row }">
          <el-tooltip :content="row.name" placement="top" :show-after="500" :hide-after="0">
            <el-link
              v-if="!row.isDeleted"
              type="primary"
              @click="goDetail(row.id, row.name)"
              class="cell-link"
            >{{ row.name }}</el-link>
            <span v-else class="cell-link">{{ row.name }}</span>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="listType" label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :color="listTypeDict.color(row.listType)" effect="dark" size="small" style="color:#fff">
            {{ listTypeDict.label(row.listType) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="listLifecycleStatus(row).type" size="small">
            {{ listLifecycleStatus(row).label }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="ownerName" label="负责人" width="100" align="center">
        <template #default="{ row }">
          {{ row.ownerName || '—' }}
        </template>
      </el-table-column>
      <el-table-column prop="memberCount" label="成员" width="70" align="center" sortable />
      <el-table-column prop="issueCount" label="Issue" width="70" align="center" sortable />
      <el-table-column prop="description" label="描述" min-width="160" show-overflow-tooltip />
      <el-table-column v-if="listView === 'deleted'" label="删除时间" width="160" sortable>
        <template #default="{ row }">
          {{ row.deletedAt ? new Date(row.deletedAt).toLocaleString('zh-CN') : '—' }}
        </template>
      </el-table-column>
      <el-table-column v-else label="更新时间" width="160" sortable>
        <template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="190" fixed="right">
        <template #default="{ row }">
          <template v-if="row.isDeleted">
            <el-button link type="success" size="small" @click.stop="onRestore(row.id, row.name)">恢复</el-button>
          </template>
          <template v-else>
            <el-button v-if="canEdit(row)" link type="primary" size="small" @click.stop="editTarget = row.id">编辑</el-button>
            <el-button
              v-if="canEdit(row)"
              link type="warning" size="small"
              @click.stop="onArchive(row.id, row.name, !row.archived)"
            >{{ row.archived ? '取消归档' : '归档' }}</el-button>
            <el-button
              v-if="canDelete(row)"
              link type="danger" size="small"
              @click.stop="onDelete(row.id, row.name)"
            >删除</el-button>
          </template>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="emptyDescription" />
      </template>
    </el-table>

    <div class="pagination-bar" data-tour="lists-pagination">
      <span class="pagination-summary">
        当前 {{ filteredLists.length }} 条<span v-if="filteredLists.length !== store.lists.length"> / 共 {{ store.lists.length }} 条</span>
      </span>
      <el-pagination
        v-if="filteredLists.length > PAGE_SIZE_OPTIONS[0]"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :page-sizes="PAGE_SIZE_OPTIONS"
        :total="filteredLists.length"
        layout="sizes, prev, pager, next"
        background
        small
      />
    </div>

    <ListFormDialog v-if="showCreate" @confirm="onCreate" @close="showCreate = false" />
    <ListFormDialog
      v-if="editTarget"
      :initial="store.lists.find(l => l.id === editTarget)"
      :can-edit-owner="canEditOwner(store.lists.find(l => l.id === editTarget) ?? {})"
      @confirm="onEdit"
      @close="editTarget = null"
    />
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.page-head h2 {
  font-size: 1.3rem;
  font-weight: 650;
}
.cell-link {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  min-height: 32px;
  margin-top: 12px;
}
.pagination-summary {
  color: #909399;
  font-size: 0.8rem;
  white-space: nowrap;
}
:deep(.el-table th) {
  white-space: nowrap;
}
</style>
