<script setup lang="ts">
import { onMounted, ref, inject } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { ElMessage } from 'element-plus'
import { runSeed } from '@/api/push'
import PnwPageHeader from 'phoenix-wing/layout/PnwPageHeader.vue'
import PageHelpButton from '@/components/PageHelpButton.vue'

const store = useIssueListStore()
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab')!
const showCreate = ref(false)
const newListName = ref('')
const newListType = ref('custom')
const newListDesc = ref('')
const seeding = ref(false)
const listView = ref<'mine' | 'all' | 'archived'>('mine')

async function switchView(view: 'mine' | 'all' | 'archived') {
  listView.value = view
  if (view === 'all') await store.fetchAllLists()
  else if (view === 'archived') await store.fetchArchivedLists()
  else await store.fetchLists()
}

async function onArchive(listId: string) {
  await store.archiveList(listId, true)
}

const listTypeLabel: Record<string, string> = {
  yearly: '年度',
  monthly: '月度',
  project: '项目',
  custom: '自定义',
}

const listTypeColor: Record<string, string> = {
  yearly: '#409eff',
  monthly: '#67c23a',
  project: '#e6a23c',
  custom: '#909399',
}

onMounted(() => {
  store.fetchLists()
})

function goList(id: string, name: string) {
  const title = name.length > 12 ? name.slice(0, 12) + '…' : name
  openTab('lists', title, id)
}

async function onCreate(data: { name: string; listType: string; description?: string }) {
  await store.createList(data)
  showCreate.value = false
  ElMessage.success('列表创建成功')
}

async function onResetDemo() {
  seeding.value = true
  try {
    const res = await runSeed(false)
    const logs = res.data?.logs || []
    if (logs.length === 1 && logs[0].includes('已有数据')) {
      ElMessage.info('演示数据已存在，无需创建')
    } else {
      ElMessage.success('演示数据已创建！')
      store.fetchLists()
    }
  } catch (e: any) {
    ElMessage.error(e.response?.data?.message || '创建失败')
  } finally {
    seeding.value = false
  }
}
</script>

<template>
  <div class="page dashboard">
    <PnwPageHeader title="仪表盘">
      <template #actions>
        <el-radio-group v-model="listView" size="small" @change="switchView">
          <el-radio-button value="mine">👤 我的</el-radio-button>
          <el-radio-button value="all">🌐 所有</el-radio-button>
          <el-radio-button value="archived">📦 归档</el-radio-button>
        </el-radio-group>
        <el-button size="small" :loading="seeding" @click="onResetDemo">
          🗂️ 创建演示数据
        </el-button>
        <el-button type="primary" @click="showCreate = true">
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
          <div class="card-type" :style="{ background: listTypeColor[list.listType] }">
            {{ listTypeLabel[list.listType] }}
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
              v-if="listView !== 'archived'"
              link size="small" type="info"
              @click.stop="onArchive(list.id)"
              title="归档此列表"
            >📦</el-button>
          </div>
        </div>
      </div>
    </div>

    <el-dialog v-if="showCreate" :model-value="true" title="新建列表" width="450px" @close="showCreate = false">
      <el-form label-position="top">
        <el-form-item label="名称" required>
          <el-input v-model="newListName" placeholder="如：2026年7月点检" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="newListType">
            <el-option label="年度" value="yearly" />
            <el-option label="月度" value="monthly" />
            <el-option label="项目" value="project" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newListDesc" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="onCreate({ name: newListName, listType: newListType, description: newListDesc }); showCreate = false; newListName = ''; newListDesc = ''">确认</el-button>
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
