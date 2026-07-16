<script setup lang="ts">
import { computed, onMounted, ref, inject } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { useDictGroup } from '@/composables/useDictGroup'
import { ElMessage } from 'element-plus'
import { getSeedStatus, addTestData, declineTestData } from '@/api/push'
import PnwPageHeader from 'phoenix-wing/layout/PnwPageHeader.vue'
import PageHelpButton from '@/components/PageHelpButton.vue'
import ListFormDialog from '@/components/ListFormDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { canPerformListAction, isSystemAdmin, isSystemViewer } from '@open-issue/core'

const store = useIssueListStore()
const auth = useAuthStore()
const listTypeDict = useDictGroup('listType')
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab')!
const showCreate = ref(false)
const listView = ref<'mine' | 'all' | 'archived'>('mine')
const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))
const canCreateList = computed(() => Boolean(auth.user && !isSystemViewer(auth.user)))

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

async function switchView(view: 'mine' | 'all' | 'archived') {
  listView.value = view
  if (view === 'all') await store.fetchAllLists()
  else if (view === 'archived') await store.fetchArchivedLists()
  else await store.fetchLists()
}

async function onArchive(listId: string) {
  await store.archiveList(listId, true)
}

onMounted(async () => {
  await store.fetchLists()
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

async function onCreate(data: { name: string; listType: string; description?: string }) {
  await store.createList(data)
  showCreate.value = false
  ElMessage.success('列表创建成功')
}
</script>

<template>
  <div class="page dashboard">
    <PnwPageHeader title="仪表盘">
      <template #actions>
        <el-radio-group v-model="listView" size="small" @change="switchView" data-tour="dashboard-views">
          <el-radio-button value="mine">👤 我的</el-radio-button>
          <el-radio-button v-if="isAdmin" value="all">🌐 所有</el-radio-button>
          <el-radio-button value="archived">📦 归档</el-radio-button>
        </el-radio-group>
        <el-button v-if="canCreateList" type="primary" @click="showCreate = true" data-tour="dashboard-create">
          <el-icon><Plus /></el-icon> 新建列表
        </el-button>
      </template>
      <template #help><PageHelpButton page-id="dashboard" /></template>
    </PnwPageHeader>

    <div v-loading="store.loading">
      <el-empty v-if="!store.lists.length && !store.loading" description="还没有列表，点击上方按钮创建" />

      <div class="list-cards">
        <div
          v-for="list in store.lists" :key="list.id"
          class="list-card"
          @click="goList(list.id, list.name)"
        >
          <div class="card-type" :style="{ background: listTypeDict.color(list.listType) }">
            {{ listTypeDict.label(list.listType) }}
          </div>
          <div class="card-body">
            <h3>{{ list.name }}</h3>
            <p v-if="list.description">{{ list.description }}</p>
            <div class="card-info">
              <span v-if="(list as any).ownerName">👤 {{ (list as any).ownerName }}</span>
              <span>👥 {{ (list as any).memberCount || 0 }} 人</span>
            </div>
          </div>
          <div class="card-meta">
            {{ new Date(list.updatedAt).toLocaleDateString('zh-CN') }}
            <el-button
              v-if="listView !== 'archived' && canArchive(list)"
              link size="small" type="info"
              @click.stop="onArchive(list.id)"
              title="归档此列表"
            >📦</el-button>
          </div>
        </div>
      </div>
    </div>

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
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.page-head h2 {
  font-size: 1.3rem;
  font-weight: 650;
}
.list-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.list-card {
  background: #fff;
  border-radius: 10px;
  border: 1px solid #ebeef5;
  cursor: pointer;
  overflow: hidden;
  transition: box-shadow 0.2s, transform 0.15s;
}
.list-card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.08);
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
.card-body h3 {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
}
.card-body p {
  font-size: 0.82rem;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-info {
  display: flex;
  gap: 12px;
  margin-top: 6px;
  font-size: 0.75rem;
  color: #909399;
}
.card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px 12px;
  font-size: 0.72rem;
  color: #c0c4cc;
}
</style>
