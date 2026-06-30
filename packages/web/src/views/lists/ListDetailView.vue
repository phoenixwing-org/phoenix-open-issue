<script setup lang="ts">
import { onMounted, ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { useIssueStore } from '@/stores/issues'
import { getMembers, addMember, removeMember } from '@/api/issueLists'
import { getAllUsers } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'
import IssueFormDialog from '@/components/IssueFormDialog.vue'
import MemberManageDialog from '@/components/MemberManageDialog.vue'
import PushDialog from '@/views/push/PushDialog.vue'

const route = useRoute()
const router = useRouter()
const listStore = useIssueListStore()
const issueStore = useIssueStore()

const listId = computed(() => route.params.id as string)
const members = ref<any[]>([])
const allUsers = ref<any[]>([])
const showCreateIssue = ref(false)
const showMembers = ref(false)
const showPush = ref(false)
const statusFilter = ref('')
const priorityFilter = ref('')
const searchText = ref('')

const statusLabel: Record<string, string> = { open: '待处理', in_progress: '进行中', resolved: '已解决', closed: '已关闭' }
const statusTag: Record<string, string> = { open: '', in_progress: 'warning', resolved: 'success', closed: 'info' }
const priorityTag: Record<string, string> = { low: 'info', medium: '', high: 'warning', critical: 'danger' }
const priorityLabel: Record<string, string> = { low: '低', medium: '中', high: '高', critical: '紧急' }

const currentList = computed(() => listStore.currentList)

onMounted(async () => {
  await listStore.fetchList(listId.value)
  await loadData()
})

async function loadData() {
  await Promise.all([
    issueStore.fetchIssues(listId.value, {
      status: statusFilter.value || undefined,
      priority: priorityFilter.value || undefined,
      search: searchText.value || undefined,
    }),
    loadMembers(),
    loadAllUsers(),
  ])
}

async function loadMembers() {
  const res = await getMembers(listId.value)
  members.value = res.data
}

async function loadAllUsers() {
  const res = await getAllUsers()
  allUsers.value = res.data
}

watch([statusFilter, priorityFilter, searchText], () => loadData())

function goIssue(id: string) { router.push(`/issues/${id}`) }

async function onCreateIssue(data: { title: string; description?: string; priority?: string }) {
  await issueStore.createIssue(listId.value, data)
  showCreateIssue.value = false
  ElMessage.success('Issue 创建成功')
  loadData()
}

async function onStatusChange(issue: any, newStatus: string) {
  await issueStore.updateStatus(issue.id, newStatus)
  ElMessage.success('状态已更新')
  loadData()
}

async function onDeleteIssue(id: string, title: string) {
  await ElMessageBox.confirm(`确定删除 Issue「${title}」及其所有点检项？`, '确认删除', { type: 'warning' })
  await issueStore.deleteIssue(id)
  ElMessage.success('已删除')
  loadData()
}

async function onAddMember(userId: string, role: string) {
  await addMember(listId.value, userId, role)
  ElMessage.success('成员已添加')
  loadMembers()
}

async function onRemoveMember(userId: string) {
  await removeMember(listId.value, userId)
  ElMessage.success('成员已移除')
  loadMembers()
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div>
        <h2>{{ currentList?.name }}</h2>
        <p v-if="currentList?.description" class="list-desc">{{ currentList.description }}</p>
      </div>
      <div class="head-actions">
        <el-button @click="showPush = true"><el-icon><Promotion /></el-icon> 推送</el-button>
        <el-button @click="showMembers = true"><el-icon><User /></el-icon> 成员 ({{ members.length }})</el-button>
        <el-button type="primary" @click="showCreateIssue = true"><el-icon><Plus /></el-icon> 新建 Issue</el-button>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="filters">
      <el-input v-model="searchText" placeholder="搜索..." clearable style="width:200px" size="small" />
      <el-select v-model="statusFilter" placeholder="状态" clearable size="small" style="width:120px">
        <el-option v-for="(l, v) in statusLabel" :key="v" :label="l" :value="v" />
      </el-select>
      <el-select v-model="priorityFilter" placeholder="优先级" clearable size="small" style="width:120px">
        <el-option v-for="(l, v) in priorityLabel" :key="v" :label="l" :value="v" />
      </el-select>
    </div>

    <el-table :data="issueStore.issues" v-loading="issueStore.loading" stripe @row-click="(row: any) => goIssue(row.id)" style="cursor:pointer">
      <el-table-column prop="title" label="标题" min-width="200" show-overflow-tooltip />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="statusTag[row.status]" size="small">{{ statusLabel[row.status] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="优先级" width="90">
        <template #default="{ row }">
          <el-tag :type="priorityTag[row.priority]" size="small">{{ priorityLabel[row.priority] }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <el-dropdown @command="(cmd: string) => cmd === 'delete' ? onDeleteIssue(row.id, row.title) : onStatusChange(row, cmd)" size="small">
            <el-button link type="primary" size="small" @click.stop>变更状态</el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="open">待处理</el-dropdown-item>
                <el-dropdown-item command="in_progress">进行中</el-dropdown-item>
                <el-dropdown-item command="resolved">已解决</el-dropdown-item>
                <el-dropdown-item command="closed">已关闭</el-dropdown-item>
                <el-dropdown-item command="delete" divided style="color:#f56c6c">删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </template>
      </el-table-column>
      <template #empty><el-empty description="暂无 Issue" /></template>
    </el-table>

    <div class="pagination" v-if="issueStore.total > 50">
      <el-pagination layout="prev, pager, next" :total="issueStore.total" :page-size="50" />
    </div>

    <IssueFormDialog v-if="showCreateIssue" @confirm="onCreateIssue" @close="showCreateIssue = false" />
    <MemberManageDialog
      v-if="showMembers"
      :members="members"
      :all-users="allUsers"
      @add="onAddMember"
      @remove="onRemoveMember"
      @close="showMembers = false"
    />
    <PushDialog v-if="showPush" :list-id="listId" @close="showPush = false" />
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}
.page-head h2 {
  font-size: 1.3rem;
  font-weight: 650;
}
.list-desc {
  color: #909399;
  font-size: 0.85rem;
  margin-top: 2px;
}
.head-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.filters {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.pagination {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
