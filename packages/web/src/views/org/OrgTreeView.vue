<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useOrgUnitStore } from '@/stores/orgUnits'
import { getOrgUnitUsers, createOrgUnit, deleteOrgUnit } from '@/api/orgUnits'
import { approveUser, updateUserOrg, updateUser } from '@/api/auth'
import { ElMessage, ElMessageBox } from 'element-plus'

const store = useOrgUnitStore()
const unitUsers = ref<any[]>([])
const selectedUnit = ref<any>(null)
const showCreate = ref(false)
const newUnitName = ref('')
const newUnitType = ref('group')
const newUnitParentId = ref<string | null>(null)

// 扁平化所有组织节点供上级选择
function flattenUnits(nodes: any[], depth = 0): any[] {
  const result: any[] = []
  for (const n of nodes) {
    result.push({ ...n, _depth: depth })
    if (n.children) result.push(...flattenUnits(n.children, depth + 1))
  }
  return result
}

onMounted(() => store.fetchTree())

async function onNodeClick(data: any) {
  selectedUnit.value = data
  const res = await getOrgUnitUsers(data.id)
  unitUsers.value = res.data
}

async function onCreate() {
  if (!newUnitName.value.trim()) return
  await createOrgUnit({ name: newUnitName.value, unitType: newUnitType.value, parentId: newUnitParentId.value ?? undefined })
  showCreate.value = false
  newUnitName.value = ''
  ElMessage.success('组织节点已创建')
  store.fetchTree()
}

async function onApprove(userId: string, approved: boolean) {
  await approveUser(userId, approved)
  ElMessage.success(approved ? '已批准' : '已拒绝')
  // 刷新成员列表
  if (selectedUnit.value) {
    const res = await getOrgUnitUsers(selectedUnit.value.id)
    unitUsers.value = res.data
  }
}

async function onMoveUser(userId: string, newOrgId: string | null) {
  await updateUserOrg(userId, newOrgId)
  ElMessage.success('已更新组织')
  if (selectedUnit.value) {
    const res = await getOrgUnitUsers(selectedUnit.value.id)
    unitUsers.value = res.data
  }
}

const showEditUser = ref(false)
const editUser = ref<any>(null)
const editUserName = ref('')
const editDisplayName = ref('')
const editEmail = ref('')
const editOrgId = ref<string | null>(null)

function onEditUser(u: any) {
  editUser.value = u
  editDisplayName.value = u.displayName || ''
  editEmail.value = u.email || ''
  editOrgId.value = u.orgUnitId
  showEditUser.value = true
}

async function onSaveUser() {
  if (!editUser.value) return
  await updateUser(editUser.value.id, {
    displayName: editDisplayName.value || undefined,
    email: editEmail.value || undefined,
    orgUnitId: editOrgId.value,
  })
  ElMessage.success('已更新')
  showEditUser.value = false
  if (selectedUnit.value) {
    const res = await getOrgUnitUsers(selectedUnit.value.id)
    unitUsers.value = res.data
  }
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
              <el-tag :color="unitTypeColor[data.unitType]" size="small" style="color:#fff;border:none">
                {{ unitTypeLabel[data.unitType] }}
              </el-tag>
              <span style="margin-left:6px">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </div>

      <div class="org-detail-panel">
        <template v-if="selectedUnit">
          <h3>{{ selectedUnit.name }}</h3>
          <el-tag size="small" :color="unitTypeColor[selectedUnit.unitType]" style="color:#fff;border:none">
            {{ unitTypeLabel[selectedUnit.unitType] }}
          </el-tag>

          <div class="unit-users" style="margin-top:16px">
            <h4>成员 ({{ unitUsers.length }})</h4>
            <el-empty v-if="!unitUsers.length" description="暂无成员" :image-size="60" />
            <div v-else class="user-list">
              <div v-for="u in unitUsers" :key="u.id" class="user-item">
                <el-avatar :size="28">{{ (u.displayName || u.username).charAt(0) }}</el-avatar>
                <span style="cursor:pointer" @click="onEditUser(u)">{{ u.displayName || u.username }}</span>
                <span class="user-email" v-if="u.email">{{ u.email }}</span>
                <el-tag v-if="!u.approved" type="warning" size="small">待批准</el-tag>
                <el-select v-if="u.approved" size="small" :model-value="u.orgUnitId" placeholder="更换组织" clearable @change="(v: string) => onMoveUser(u.id, v || null)" style="width:130px" @click.stop>
                  <el-option v-for="org in flattenUnits(store.tree)" :key="org.id" :label="'　'.repeat(org._depth) + org.name" :value="org.id" />
                </el-select>
                <template v-if="!u.approved">
                  <el-button size="small" type="success" @click="onApprove(u.id, true)">批准</el-button>
                  <el-button size="small" type="danger" @click="onApprove(u.id, false)">拒绝</el-button>
                </template>
              </div>
            </div>
          </div>

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
            <el-option v-for="u in flattenUnits(store.tree)" :key="u.id" :label="'　'.repeat(u._depth) + u.name" :value="u.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" @click="onCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- Edit user dialog -->
    <el-dialog v-model="showEditUser" title="编辑人员" width="420px">
      <el-form v-if="editUser" label-position="top">
        <el-form-item label="账号">
          <el-input :model-value="editUser.username" disabled />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="editDisplayName" placeholder="显示名称" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="editEmail" placeholder="邮箱" />
        </el-form-item>
        <el-form-item label="组织">
          <el-select v-model="editOrgId" clearable placeholder="选择组织" style="width:100%">
            <el-option v-for="org in flattenUnits(store.tree)" :key="org.id" :label="'　'.repeat(org._depth) + org.name" :value="org.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditUser = false">取消</el-button>
        <el-button type="primary" @click="onSaveUser">保存</el-button>
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
