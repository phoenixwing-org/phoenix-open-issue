<script setup lang="ts">
import { onMounted, ref, inject, computed } from 'vue'
import { useIssueListStore } from '@/stores/issueLists'
import { useAuthStore } from '@/stores/auth'
import { canDeleteListAsUser, isSystemAdmin } from '@open-issue/core'
import type { MemberRole } from '@open-issue/core'
import { ElMessage, ElMessageBox } from 'element-plus'
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import ListFormDialog from '@/components/ListFormDialog.vue'
import { useDictGroup } from '@/composables/useDictGroup'

const store = useIssueListStore()
const auth = useAuthStore()
const listTypeDict = useDictGroup('listType')
const openTab = inject<(pageId: string, title: string, contextKey?: string) => void>('openTab')!
const showCreate = ref(false)
const editTarget = ref<string | null>(null)
const listView = ref<'active' | 'deleted'>('active')

const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))

onMounted(() => {
  loadLists()
})

async function loadLists() {
  if (listView.value === 'deleted') {
    await store.fetchDeletedLists()
  } else if (isAdmin.value) {
    await store.fetchAllLists()
  } else {
    await store.fetchLists()
  }
}

async function switchView(view: 'active' | 'deleted') {
  listView.value = view
  await loadLists()
}

function canEditOwner(row: { myRole?: MemberRole | null }) {
  if (!auth.user) return false
  if (isSystemAdmin(auth.user)) return true
  const role = row.myRole ?? null
  return role === 'owner' || role === 'admin'
}

function canDelete(row: { ownerId: string; myRole?: MemberRole | null }) {
  if (!auth.user) return false
  return canDeleteListAsUser(row.myRole ?? null, auth.user, row.ownerId, auth.user.id)
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

async function onRestore(id: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `确定恢复列表「${name}」？`,
      '确认恢复',
      { confirmButtonText: '恢复', cancelButtonText: '取消', type: 'info' },
    )
    await store.restoreList(id)
  } catch {
    // 用户取消
  }
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="列表管理">
      <template #actions>
        <el-radio-group
          v-if="isAdmin"
          v-model="listView"
          size="small"
          @change="switchView"
        >
          <el-radio-button value="active">正常</el-radio-button>
          <el-radio-button value="deleted">已删除</el-radio-button>
        </el-radio-group>
        <el-button v-if="listView === 'active'" type="primary" @click="showCreate = true" data-tour="lists-create">
          <el-icon><Plus /></el-icon> 新建列表
        </el-button>
      </template>
      <template #help><PageHelpButton page-id="lists" /></template>
    </PnwPageHeader>

    <el-table :data="store.lists" v-loading="store.loading" stripe data-tour="lists-table">
      <el-table-column type="index" label="#" width="50" align="center" fixed />
      <el-table-column prop="name" label="名称" min-width="180" fixed="left">
        <template #default="{ row }">
          <el-tooltip :content="row.name" placement="top" :show-after="500" :hide-after="0">
            <el-link
              v-if="listView === 'active'"
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
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <template v-if="listView === 'deleted'">
            <el-button link type="success" size="small" @click.stop="onRestore(row.id, row.name)">恢复</el-button>
          </template>
          <template v-else>
            <el-button link type="primary" size="small" @click.stop="editTarget = row.id">编辑</el-button>
            <el-button
              v-if="canDelete(row)"
              link type="danger" size="small"
              @click.stop="onDelete(row.id, row.name)"
            >删除</el-button>
          </template>
        </template>
      </el-table-column>
      <template #empty>
        <el-empty :description="listView === 'deleted' ? '暂无已删除列表' : '暂无列表'" />
      </template>
    </el-table>

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
:deep(.el-table th) {
  white-space: nowrap;
}
</style>
