<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useIssueListStore } from '@/stores/issueLists'
import { ElMessage } from 'element-plus'
import ListFormDialog from '@/components/ListFormDialog.vue'
import { ref } from 'vue'

const router = useRouter()
const store = useIssueListStore()
const showCreate = ref(false)

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

function goList(id: string) {
  router.push(`/lists/${id}`)
}

async function onCreate(data: { name: string; list_type: string; description?: string }) {
  await store.createList(data)
  showCreate.value = false
  ElMessage.success('列表创建成功')
}
</script>

<template>
  <div class="page dashboard">
    <div class="page-head">
      <h2>仪表盘</h2>
      <el-button type="primary" @click="showCreate = true">
        <el-icon><Plus /></el-icon> 新建列表
      </el-button>
    </div>

    <div v-loading="store.loading">
      <el-empty v-if="!store.lists.length && !store.loading" description="还没有列表，点击上方按钮创建" />

      <div class="list-cards">
        <div
          v-for="list in store.lists" :key="list.id"
          class="list-card"
          @click="goList(list.id)"
        >
          <div class="card-type" :style="{ background: listTypeColor[list.list_type] }">
            {{ listTypeLabel[list.list_type] }}
          </div>
          <div class="card-body">
            <h3>{{ list.name }}</h3>
            <p v-if="list.description">{{ list.description }}</p>
          </div>
          <div class="card-meta">
            {{ new Date(list.updated_at).toLocaleDateString('zh-CN') }}
          </div>
        </div>
      </div>
    </div>

    <ListFormDialog
      v-if="showCreate"
      @confirm="onCreate"
      @close="showCreate = false"
    />
  </div>
</template>

<style scoped>
.page-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
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
.card-meta {
  padding: 8px 16px 12px;
  font-size: 0.72rem;
  color: #c0c4cc;
}
</style>
