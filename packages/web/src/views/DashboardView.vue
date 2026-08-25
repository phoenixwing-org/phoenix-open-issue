<script setup lang="ts">
import { computed, onMounted, ref, inject } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { useDictGroup } from '@/composables/useDictGroup'
import { ElMessage } from 'element-plus'
import { getSeedStatus, addTestData, declineTestData } from '@/api/push'
import PnwPageLayout from 'phoenix-wing/layout/PnwPageLayout.vue'
import PageHelpButton from '@/components/PageHelpButton.vue'
import ListFormDialog from '@/components/ListFormDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { canPerformListAction, isSystemAdmin, isSystemViewer } from '@open-issue/core'
import type { DashboardTaskCounts, DashboardTaskTab } from '@open-issue/core'
import DashboardTaskCenter from '@/components/dashboard/DashboardTaskCenter.vue'
import {
  confirmListArchive,
  filterListsByLifecycle,
  listLifecycleStatus,
  type ListLifecycleFilter,
} from '@/utils/listLifecycle'

const store = useIssueListStore()
const auth = useAuthStore()
const listTypeDict = useDictGroup('listType')
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab')!
const showCreate = ref(false)
type DashboardScope = 'mine' | 'all'
type DashboardSection = 'overview' | DashboardTaskTab
const listScope = ref<DashboardScope>('mine')
const activeDashboardTab = ref<DashboardSection>('overview')
const dashboardTaskCounts = ref<DashboardTaskCounts>({ incoming: 0, outgoing: 0, admin: 0, total: 0 })
const lifecycleFilter = ref<ListLifecycleFilter>('active')
const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))
const canCreateList = computed(() => Boolean(auth.user && !isSystemViewer(auth.user)))
const displayedLists = computed(() => filterListsByLifecycle(store.lists, lifecycleFilter.value))
const emptyDescription = computed(() => {
  if (lifecycleFilter.value === 'archived') return '暂无已归档列表'
  return canCreateList.value ? '暂无正常列表，可点击上方按钮创建' : '暂无可访问的正常列表'
})

function canArchive(list: { myRole?: any }) {
  return canPerformListAction(auth.user ?? undefined, list.myRole ?? null, 'manage-list')
}

// ── 测试数据提示 ──
const showSeedPrompt = ref(false)
const seeding = ref(false)

async function onAddTestData() {
  seeding.value = true
  try {
    await addTestData()
    ElMessage.success('演示数据已添加！')
    showSeedPrompt.value = false
    await store.fetchLists()
  } catch (e: any) {
    ElMessage.error(e?.response?.data?.message || '添加失败')
  } finally {
    seeding.value = false
  }
}

async function onDeclineTestData() {
  try {
    await declineTestData()
  } catch { /* ignore */ }
  showSeedPrompt.value = false
}

async function loadLists() {
  if (listScope.value === 'all' && isAdmin.value) await store.fetchAllLists(true)
  else await store.fetchLists(true)
}

async function switchScope(scope: DashboardScope) {
  listScope.value = scope
  await loadLists()
}

async function onArchive(listId: string, name: string, archived: boolean) {
  if (!await confirmListArchive(name, archived)) return
  await store.archiveList(listId, archived)
}

onMounted(async () => {
  await loadLists()
  if (!isAdmin.value) return

  // 检查是否需要询问测试数据
  let statusRes: any
  try {
    statusRes = await getSeedStatus()
  } catch {
    return // 网络错误，下次再检查
  }
  if (!statusRes.data.pending) return

  // 使用原生 el-dialog 方式更可靠
  showSeedPrompt.value = true
})

function goList(id: string, name: string) {
  const title = name.length > 12 ? name.slice(0, 12) + '…' : name
  openTab(`listDetail:${id}`, title, id)
}

function selectDashboardTab(tab: DashboardSection) {
  activeDashboardTab.value = tab
}

async function onCreate(data: { name: string; listType: string; description?: string }) {
  await store.createList(data)
  lifecycleFilter.value = 'active'
  showCreate.value = false
  ElMessage.success('列表创建成功')
}
</script>

<template>
  <PnwPageLayout class="page dashboard" title="仪表盘">
    <template #actions>
        <nav class="dashboard-header-tabs" role="tablist" aria-label="仪表盘视图">
          <button
            type="button"
            role="tab"
            :aria-selected="activeDashboardTab === 'overview'"
            aria-controls="dashboard-panel-overview"
            :class="{ 'is-active': activeDashboardTab === 'overview' }"
            @click="selectDashboardTab('overview')"
          >概览</button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeDashboardTab === 'incoming'"
            aria-controls="dashboard-panel-incoming"
            :class="{ 'is-active': activeDashboardTab === 'incoming' }"
            @click="selectDashboardTab('incoming')"
          >待我处理 <span>{{ dashboardTaskCounts.incoming }}</span></button>
          <button
            type="button"
            role="tab"
            :aria-selected="activeDashboardTab === 'outgoing'"
            aria-controls="dashboard-panel-outgoing"
            :class="{ 'is-active': activeDashboardTab === 'outgoing' }"
            @click="selectDashboardTab('outgoing')"
          >我发起的 <span>{{ dashboardTaskCounts.outgoing }}</span></button>
          <button
            v-if="isAdmin"
            type="button"
            role="tab"
            :aria-selected="activeDashboardTab === 'admin'"
            aria-controls="dashboard-panel-admin"
            :class="{ 'is-active': activeDashboardTab === 'admin' }"
            @click="selectDashboardTab('admin')"
          >管理审批 <span>{{ dashboardTaskCounts.admin }}</span></button>
        </nav>
    </template>
    <template #help><PageHelpButton page-id="dashboard" /></template>

    <DashboardTaskCenter
      v-model:active-tab="activeDashboardTab"
      @counts-change="dashboardTaskCounts = $event"
    >
      <template #overview>
        <section class="dashboard-overview" aria-label="列表概览">
          <div class="dashboard-overview-toolbar">
            <el-button v-if="canCreateList" type="primary" @click="showCreate = true" data-tour="dashboard-create">
              <el-icon><Plus /></el-icon> 新建列表
            </el-button>
            <div class="dashboard-view-filters" data-tour="dashboard-views">
              <span class="filter-label">范围</span>
              <el-radio-group v-model="listScope" size="small" @change="switchScope">
                <el-radio-button value="mine">我的</el-radio-button>
                <el-radio-button v-if="isAdmin" value="all">所有</el-radio-button>
              </el-radio-group>
              <span class="filter-label">状态</span>
              <el-radio-group v-model="lifecycleFilter" size="small">
                <el-radio-button value="active">正常</el-radio-button>
                <el-radio-button value="archived">已归档</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <div v-loading="store.loading">
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

    <!-- 首次登录：询问是否添加演示数据 -->
    <el-dialog
      :model-value="showSeedPrompt"
      title="欢迎使用 Open Issue"
      width="460px"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      @close="showSeedPrompt = false"
    >
      <p style="margin-bottom:12px">
        系统已创建管理员账号；初始密码由服务端部署配置提供。
      </p>
      <p>是否添加演示数据？（示例列表、Issue、点检等）</p>
      <p style="color:#909399;font-size:0.82rem;margin-top:8px">
        选择"不需要"后将不再询问。
      </p>
      <template #footer>
        <el-button @click="onDeclineTestData">不需要</el-button>
        <el-button type="primary" :loading="seeding" @click="onAddTestData">添加演示数据</el-button>
      </template>
    </el-dialog>
  </PnwPageLayout>
</template>

<style scoped>
.dashboard-header-tabs {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}
.dashboard-header-tabs button {
  min-height: 30px;
  padding: 4px 12px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pnw-workbench-text, var(--el-text-color-primary));
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.dashboard-header-tabs button:hover {
  color: var(--el-color-primary);
  background: var(--el-fill-color-light);
}
.dashboard-header-tabs button.is-active {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.dashboard-header-tabs button:focus-visible {
  outline: 2px solid var(--el-color-primary-light-5);
  outline-offset: 1px;
}
.dashboard-header-tabs span {
  display: inline-grid;
  min-width: 18px;
  height: 18px;
  margin-left: 3px;
  padding: 0 5px;
  box-sizing: border-box;
  place-items: center;
  border-radius: 9px;
  background: var(--el-fill-color);
  color: var(--el-text-color-secondary);
  font-size: 0.7rem;
  line-height: 18px;
}
.dashboard-overview-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.dashboard-view-filters {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}
.filter-label {
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  font-size: 0.75rem;
  white-space: nowrap;
}
.list-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.list-card {
  background: var(--pnw-workbench-surface, var(--el-bg-color, #fff));
  border-radius: 10px;
  border: 1px solid var(--pnw-workbench-border, var(--el-border-color-lighter, #ebeef5));
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.15s;
}
.list-card:hover {
  box-shadow: var(--el-box-shadow-light, 0 4px 16px rgba(0,0,0,0.08));
  transform: translateY(-2px);
}
.card-type {
  display: inline-block;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 0 0 8px 0;
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
@media (max-width: 900px) {
  .dashboard-overview-toolbar {
    align-items: flex-start;
    justify-content: flex-start;
  }
}
</style>
