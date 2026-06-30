<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useOrgUnitStore } from '@/stores/orgUnits'
import { getOrgUnitUsers, createOrgUnit, deleteOrgUnit } from '@/api/orgUnits'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useOrgUnitStore()
const unitUsers = ref<any[]>([])
const selectedUnit = ref<any>(null)
const showCreate = ref(false)
const newUnitName = ref('')
const newUnitType = ref('group')
const newUnitParentId = ref<string | null>(null)

onMounted(() => store.fetchTree())

async function onNodeClick(data: any) {
  selectedUnit.value = data
  const res = await getOrgUnitUsers(data.id)
  unitUsers.value = res.data
}

async function onCreate() {
  if (!newUnitName.value.trim()) return
  await createOrgUnit({ name: newUnitName.value, unit_type: newUnitType.value, parent_id: newUnitParentId.value ?? undefined })
  showCreate.value = false
  newUnitName.value = ''
  ElMessage.success('组织节点已创建')
  store.fetchTree()
}

async function onDelete(id: string, name: string) {
  await ElMessageBox.confirm(`确定删除「${name}」？`, '确认', { type: 'warning' })
  await deleteOrgUnit(id)
  ElMessage.success('已删除')
  selectedUnit.value = null
  unitUsers.value = []
  store.fetchTree()
}

const unitTypeLabel: Record<string, string> = { group: '小组', department: '科室', division: '部' }
const unitTypeColor: Record<string, string> = { group: '#67c23a', department: '#409eff', division: '#e6a23c' }
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h2>组织架构</h2>
      <el-button type="primary" size="small" @click="showCreate = true"><el-icon><Plus /></el-icon> 新建节点</el-button>
    </div>

    <div class="org-layout">
      <div class="org-tree-panel">
        <el-tree
          :data="store.tree"
          :props="{ children: 'children', label: 'name' }"
          node-key="id"
          highlight-current
          @node-click="onNodeClick"
          v-loading="store.loading"
        >
          <template #default="{ data }">
            <span class="tree-node">
              <el-tag :color="unitTypeColor[data.unit_type]" size="small" style="color:#fff;border:none">
                {{ unitTypeLabel[data.unit_type] }}
              </el-tag>
              <span style="margin-left:6px">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </div>

      <div class="org-detail-panel">
        <template v-if="selectedUnit">
          <h3>{{ selectedUnit.name }}</h3>
          <el-tag size="small" :color="unitTypeColor[selectedUnit.unit_type]" style="color:#fff;border:none">
            {{ unitTypeLabel[selectedUnit.unit_type] }}
          </el-tag>

          <div class="unit-users" style="margin-top:16px">
            <h4>成员 ({{ unitUsers.length }})</h4>
            <el-empty v-if="!unitUsers.length" description="暂无成员" :image-size="60" />
            <div v-else class="user-list">
              <div v-for="u in unitUsers" :key="u.id" class="user-item">
                <el-avatar :size="28">{{ (u.display_name || u.username).charAt(0) }}</el-avatar>
                <span>{{ u.display_name || u.username }}</span>
                <span class="user-email" v-if="u.email">{{ u.email }}</span>
              </div>
            </div>
          </div>

          <el-button type="danger" size="small" style="margin-top:16px" @click="onDelete(selectedUnit.id, selectedUnit.name)">
            删除此节点
          </el-button>
        </template>
        <el-empty v-else description="选择左侧组织节点查看详情" :image-size="80" />
      </div>
    </div>

    <!-- Create dialog (inline simple) -->
    <el-dialog v-model="showCreate" title="新建组织节点" width="400px">
      <el-form label-position="top">
        <el-form-item label="名称">
          <el-input v-model="newUnitName" placeholder="如：前端组" />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="newUnitType">
            <el-option label="小组" value="group" />
            <el-option label="科室" value="department" />
            <el-option label="部" value="division" />
          </el-select>
        </el-form-item>
        <el-form-item label="上级节点">
          <el-select v-model="newUnitParentId" clearable placeholder="无（根节点）">
            <el-option v-for="u in store.tree" :key="u.id" :label="u.name" :value="u.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
.org-layout { display: flex; gap: 24px; }
.org-tree-panel { width: 280px; flex-shrink: 0; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; padding: 12px; }
.org-detail-panel { flex: 1; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; padding: 16px; min-height: 300px; }
.org-detail-panel h3 { font-size: 1.1rem; margin-bottom: 8px; }
.user-list { display: flex; flex-direction: column; gap: 8px; }
.user-item { display: flex; align-items: center; gap: 8px; }
.user-email { font-size: 0.8rem; color: #c0c4cc; }
</style>
