<script setup lang="ts">
import { onMounted, ref, inject } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { useAuthStore } from '@/stores/auth'
import { canDeleteListAsUser, isSystemAdmin } from '@open-issue/core'
import type { MemberRole } from '@open-issue/core'
import { ElMessage, ElMessageBox } from 'element-plus'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import ListFormDialog from '@/components/ListFormDialog.vue'

const store = useIssueListStore()
const auth = useAuthStore()
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab')!
const showCreate = ref(false)
const editTarget = ref<string | null>(null)

const listTypeLabel: Record<string, string> = { yearly: '年度', monthly: '月度', project: '项目', custom: '自定义' }
const listTypeColor: Record<string, string> = { yearly: '#409EFF', monthly: '#67C23A', project: '#E6A23C', custom: '#909399' }

onMounted(() => {
  if (isSystemAdmin(auth.user?.username ?? '')) store.fetchAllLists()
  else store.fetchLists()
})

function canDelete(row: { ownerId: string; myRole?: MemberRole | null }) {
  if (!auth.user) return false
  return canDeleteListAsUser(row.myRole ?? null, auth.user.username, row.ownerId, auth.user.id)
}

function goDetail(id: string, name: string) {
  const title = name.length > 12 ? name.slice(0, 12) + '…' : name
  openTab(`listDetail:${id}`, title, id)
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
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="列表管理">
      <template #actions>
        <el-button type="primary" @click="showCreate = true" data-tour="lists-create">
          <el-icon><Plus /></el-icon> 新建列表
        </el-button>
      </template>
      <template #help><PageHelpButton page-id="lists" /></template>
    </PnwPageHeader>

    <el-table :data="store.lists" v-loading="store.loading" stripe data-tour="lists-table">
      <el-table-column prop="name" label="名称" min-width="180" fixed>
        <template #default="{ row }">
          <el-tooltip :content="row.name" placement="top" :show-after="500" :hide-after="0">
            <el-link type="primary" @click="goDetail(row.id, row.name)" class="cell-link">{{ row.name }}</el-link>
          </el-tooltip>
        </template>
      </el-table-column>
      <el-table-column prop="listType" label="类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag :color="listTypeColor[row.listType]" effect="dark" size="small" style="color:#fff">
            {{ listTypeLabel[row.listType] || row.listType }}
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
      <el-table-column label="更新时间" width="160" sortable>
        <template #default="{ row }">{{ new Date(row.updatedAt).toLocaleString('zh-CN') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click.stop="editTarget = row.id">编辑</el-button>
          <el-button
            v-if="canDelete(row)"
            link type="danger" size="small"
            @click.stop="onDelete(row.id, row.name)"
          >删除</el-button>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty description="暂无列表" />
      </template>
    </el-table>

    <ListFormDialog v-if="showCreate" @confirm="onCreate" @close="showCreate = false" />
    <ListFormDialog
      v-if="editTarget"
      :initial="store.lists.find(l => l.id === editTarget)"
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
:deep(.el-table th) {
  white-space: nowrap;
}
</style>
