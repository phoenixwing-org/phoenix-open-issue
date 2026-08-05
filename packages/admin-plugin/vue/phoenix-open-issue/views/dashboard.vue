<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '/$/phoenix-open-issue/stores/issueLists'
import { useDictGroup } from '/$/phoenix-open-issue/composables/useDictGroup'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import PageHelpButton from '/$/phoenix-open-issue/components/PageHelpButton.vue'
import ListFormDialog from '/$/phoenix-open-issue/components/ListFormDialog.vue'
import PoiCompactEditorView from '/$/phoenix-open-issue/components/workbench/PoiCompactEditorView.vue'
import { useAuthStore } from '/$/phoenix-open-issue/stores/auth'
import { canPerformListAction } from '/$/phoenix-open-issue/core'
import type { DashboardTaskCounts, DashboardTaskTab } from '/$/phoenix-open-issue/core'
import DashboardTaskCenter from '/$/phoenix-open-issue/components/dashboard/DashboardTaskCenter.vue'
import PoiDashboardPrimary from '/$/phoenix-open-issue/components/workbench/PoiDashboardPrimary.vue'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'
import { usePoiViewContribution } from '/$/phoenix-open-issue/layout/workbench/poiViewContributions'
import {
  confirmListArchive,
  filterListsByLifecycle,
  listLifecycleStatus,
  type ListLifecycleFilter,
} from '/$/phoenix-open-issue/utils/listLifecycle'

const store = useIssueListStore()
const auth = useAuthStore()
const capabilities = useIssueCapabilities()
const route = useRoute()
const router = useRouter()
const listTypeDict = useDictGroup('listType')
const showCreate = ref(false)
type DashboardScope = 'mine' | 'all'
type DashboardSection = 'overview' | DashboardTaskTab
const listScope = ref<DashboardScope>('mine')
const activeDashboardTab = ref<DashboardSection>('overview')
const dashboardTaskCounts = ref<DashboardTaskCounts>({ incoming: 0, outgoing: 0, total: 0 })
const lifecycleFilter = ref<ListLifecycleFilter>('active')
const canAdministerLists = computed(() => capabilities.can('phoenix-open-issue:list:admin'))
const canCreateList = computed(() => capabilities.can('phoenix-open-issue:list:create'))
const displayedLists = computed(() => filterListsByLifecycle(store.lists, lifecycleFilter.value))
const emptyDescription = computed(() => {
  if (lifecycleFilter.value === 'archived') return '暂无已归档列表'
  return canCreateList.value ? '暂无正常列表，可点击上方按钮创建' : '暂无可访问的正常列表'
})

function canArchive(list: { myRole?: any }) {
  return capabilities.can('phoenix-open-issue:list:archive') &&
    canPerformListAction({ hostRoot: auth.isHostRoot }, list.myRole ?? null, 'manage-list')
}

async function loadLists() {
  if (listScope.value === 'all' && canAdministerLists.value) await store.fetchAllLists(true)
  else await store.fetchLists(true)
}

async function switchScope(scope: string | number | boolean | undefined) {
  if (scope !== 'mine' && scope !== 'all') return
  listScope.value = scope
  await loadLists()
}

async function onArchive(listId: string, name: string, archived: boolean) {
  if (!await confirmListArchive(name, archived)) return
  await store.archiveList(listId, archived)
}

onMounted(loadLists)

function goList(id: string, name: string) {
  void router.push(`/open-issue/list/${id}`)
}

function selectDashboardTab(tab: DashboardSection) {
  activeDashboardTab.value = tab
}

function selectLifecycle(filter: ListLifecycleFilter) {
  lifecycleFilter.value = filter
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiDashboardPrimary,
    props: computed(() => ({
      viewKey: 'phoenix-open-issue-dashboard',
      activeSection: activeDashboardTab.value,
      counts: dashboardTaskCounts.value,
      listScope: listScope.value,
      lifecycleFilter: lifecycleFilter.value,
      canAdministerLists: canAdministerLists.value,
      onSelectSection: selectDashboardTab,
      onSelectScope: (scope: DashboardScope) => { void switchScope(scope) },
      onSelectLifecycle: selectLifecycle,
    })),
  },
})

async function onCreate(data: { name: string; listType: string; description?: string }) {
  if (!canCreateList.value) return
  await store.createList(data)
  lifecycleFilter.value = 'active'
  showCreate.value = false
  ElMessage.success('列表创建成功')
}
</script>

<template>
  <PoiCompactEditorView title="仪表盘" content-aria-label="Open Issue 仪表盘">
    <template #actions>
      <el-button v-if="canCreateList && activeDashboardTab === 'overview'" type="primary" @click="showCreate = true" data-tour="dashboard-create">
        <el-icon><Plus /></el-icon>新建列表
      </el-button>
    </template>
    <template #help><PageHelpButton page-id="dashboard" /></template>

    <DashboardTaskCenter
      v-model:active-tab="activeDashboardTab"
      @counts-change="dashboardTaskCounts = $event"
    >
      <template #overview>
        <section class="dashboard-overview" aria-label="列表概览">
          <div v-loading="store.loading" data-tour="dashboard-views">
            <el-empty v-if="!displayedLists.length && !store.loading" :description="emptyDescription" />

            <div class="list-cards" data-tour="dashboard-cards">
              <div
                v-for="list in displayedLists" :key="list.id"
                class="list-card"
                @click="goList(list.id, list.name)"
              >
                <div class="card-type" :style="{ background: listTypeDict.color(list.listType) }">
                  {{ listTypeDict.label(list.listType) }}
                </div>
                <div class="card-body">
                  <div class="card-title-row">
                    <h3>{{ list.name }}</h3>
                    <el-tag :type="listLifecycleStatus(list).type" size="small">
                      {{ listLifecycleStatus(list).label }}
                    </el-tag>
                  </div>
                  <p v-if="list.description">{{ list.description }}</p>
                  <div class="card-info">
                    <span v-if="(list as any).ownerName">👤 {{ (list as any).ownerName }}</span>
                    <span>👥 {{ (list as any).memberCount || 0 }} 人</span>
                  </div>
                </div>
                <div class="card-meta">
                  {{ new Date(list.updatedAt).toLocaleDateString('zh-CN') }}
                  <el-button
                    v-if="canArchive(list)"
                    link size="small" :type="list.archived ? 'primary' : 'warning'"
                    @click.stop="onArchive(list.id, list.name, !Boolean(list.archived))"
                    :title="list.archived ? '取消归档' : '归档此列表'"
                  >{{ list.archived ? '取消归档' : '归档' }}</el-button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </template>
    </DashboardTaskCenter>

    <ListFormDialog v-if="showCreate" @confirm="onCreate" @close="showCreate = false" />

  </PoiCompactEditorView>
</template>

<style scoped>
.list-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}
.list-card {
  background: var(--pnw-workbench-surface, var(--el-bg-color, #fff));
  border-radius: 0;
  border: 1px solid var(--pnw-workbench-border, var(--el-border-color-lighter, #ebeef5));
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s, background-color 0.15s;
}
.list-card:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light));
}
.card-type {
  display: inline-block;
  color: var(--el-color-white, #fff);
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 0;
}
.card-body {
  padding: 12px 16px 8px;
}
.card-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.card-title-row .el-tag {
  flex-shrink: 0;
}
.card-body h3 {
  min-width: 0;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--pnw-workbench-text, var(--el-text-color-primary));
}
.card-body p {
  font-size: 0.82rem;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #909399));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-info {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #909399));
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 12px;
  font-size: 0.72rem;
  color: var(--el-text-color-placeholder, #c0c4cc);
}
</style>
