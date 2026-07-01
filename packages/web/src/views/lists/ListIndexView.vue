<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { ElMessage, ElMessageBox } from 'element-plus'
import ListFormDialog from '@/components/ListFormDialog.vue'

const router = useRouter()
const store = useIssueListStore()
const showCreate = ref(false)
const editTarget = ref<string | null>(null)

const listTypeLabel: Record<string, string> = { yearly: '年度', monthly: '月度', project: '项目', custom: '自定义' }
const listTypeColor: Record<string, string> = { yearly: '#409EFF', monthly: '#67C23A', project: '#E6A23C', custom: '#909399' }

onMounted(() => store.fetchLists())

function goDetail(id: string) { router.push(`/lists/${id}`) }

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
  await ElMessageBox.confirm(`确定删除列表「${name}」？所有 Issue 和点检项将被删除。`, '确认删除', { type: 'warning' })
  await store.deleteList(id)
  ElMessage.success('已删除')
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2>列表管理</h2>
      <el-button type="primary" @click="showCreate = true"><el-icon><Plus /></el-icon> 新建列表</el-button>
    </div>

    <el-table :data="store.lists" v-loading="store.loading" stripe>
      <el-table-column prop="name" label="名称" min-width="180" fixed>
        <template #default="{ row }">
          <el-tooltip :content="row.name" placement="top" :show-after="500" :hide-after="0">
            <el-link type="primary" @click="goDetail(row.id)" class="cell-link">{{ row.name }}</el-link>
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
      <el-table-column label="操作" width="80" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" size="small" @click="editTarget = row.id">编辑</el-button>
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
