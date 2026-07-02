<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useOrgUnitStore } from '@/stores/orgUnits'
import { useDictStore } from '@/stores/dict'

const dict = useDictStore()
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import { getOrgUnitUsers, createOrgUnit, deleteOrgUnit, updateOrgUnit } from '@/api/orgUnits'
import { approveUser, updateUserOrg, updateUser, getAllUsers, getPendingUsers } from '@/api/auth'
import { ElMessage } from 'element-plus'
import { pnwPromptChoice } from 'phoenix-wing'

const store = useOrgUnitStore()
const treeRef = ref<any>(null)
const unitUsers = ref<any[]>([])
const selectedUnit = ref<any>(null)
const showCreate = ref(false)
const newUnitName = ref('')
const newUnitType = ref('group')
const newUnitParentId = ref<string | null>(null)

/** 虚拟根节点 id：汇总所有组织的人员 */
const ALL_ROOT_ID = '__all__'

const treeDisplayData = computed(() => [{
  id: ALL_ROOT_ID,
  name: '全部人员',
  unitType: 'all',
  isAllRoot: true,
  children: store.tree,
}])

function isAllRoot(unit: any) {
  return unit?.isAllRoot === true || unit?.id === ALL_ROOT_ID
}

const allRootSelection = () => treeDisplayData.value[0]

// 扁平化所有组织节点供上级选择
function flattenUnits(nodes: any[], depth = 0): any[] {
  const result: any[] = []
  for (const n of nodes) {
    result.push({ ...n, _depth: depth })
    if (n.children) result.push(...flattenUnits(n.children, depth + 1))
  }
  return result
}

onMounted(async () => {
  await store.fetchTree()
  dict.load()
  selectedUnit.value = allRootSelection()
  await loadAllUsers()
  await nextTick()
  treeRef.value?.setCurrentKey(ALL_ROOT_ID)
})

async function loadAllUsers() {
  const [approvedRes, pendingRes] = await Promise.all([getAllUsers(), getPendingUsers()])
  unitUsers.value = [...pendingRes.data, ...approvedRes.data]
}

async function reloadUsers() {
  if (!selectedUnit.value || isAllRoot(selectedUnit.value)) {
    await loadAllUsers()
    return
  }
  const res = await getOrgUnitUsers(selectedUnit.value.id)
  unitUsers.value = res.data
}

async function onNodeClick(data: any) {
  selectedUnit.value = data
  editingUnit.value = false
  await reloadUsers()
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
  await reloadUsers()
}

async function onMoveUser(userId: string, newOrgId: string | null) {
  await updateUserOrg(userId, newOrgId)
  ElMessage.success('已更新组织')
  await reloadUsers()
}

const showEditUser = ref(false)
const editUser = ref<any>(null)
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
  await reloadUsers()
}

const editingUnit = ref(false)
const editUnitName = ref('')
const editUnitType = ref('')
const editUnitParentId = ref<string | null>(null)

function onEditUnit() {
  if (!selectedUnit.value || isAllRoot(selectedUnit.value)) return
  editUnitName.value = selectedUnit.value.name
  editUnitType.value = selectedUnit.value.unitType
  editUnitParentId.value = selectedUnit.value.parentId
  editingUnit.value = true
}

async function onSaveUnit() {
  if (!selectedUnit.value || isAllRoot(selectedUnit.value)) return
  await updateOrgUnit(selectedUnit.value.id, {
    name: editUnitName.value,
    parentId: editUnitParentId.value,
    unitType: editUnitType.value,
  })
  ElMessage.success('已更新')
  editingUnit.value = false
  store.fetchTree()
  await reloadUsers()
}

async function onDelete(id: string, name: string) {
  const r = await pnwPromptChoice({ title: '确认', message: `确定删除「${name}」？`, choices: [{ id: 'delete', label: '删除', variant: 'danger' }, { id: 'cancel', label: '取消' }] })
  if (r.choiceId !== 'delete') return
  await deleteOrgUnit(id)
  ElMessage.success('已删除')
  selectedUnit.value = allRootSelection()
  store.fetchTree()
  await loadAllUsers()
  await nextTick()
  treeRef.value?.setCurrentKey(ALL_ROOT_ID)
}

const unitTypeLabel: Record<string, string> = { all: '全部', group: '小组', department: '科室', division: '部' }
const unitTypeColor: Record<string, string> = { all: '#409eff', group: '#67c23a', department: '#409eff', division: '#e6a23c' }

function orgName(orgUnitId: string | null | undefined) {
  if (!orgUnitId) return '—'
  const org = flattenUnits(store.tree).find(o => o.id === orgUnitId)
  return org?.name ?? '—'
}

function unitHasChildren(unit: any) {
  return Array.isArray(unit?.children) && unit.children.length > 0
}

function memberSectionTitle() {
  if (isAllRoot(selectedUnit.value)) return '全部人员'
  return unitHasChildren(selectedUnit.value) ? '成员 (含下级组织)' : '成员'
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="组织架构">
      <template #actions>
        <el-button type="primary" size="small" @click="showCreate = true"><el-icon><Plus /></el-icon> 新建节点</el-button>
      </template>
      <template #help><PageHelpButton page-id="org" /></template>
    </PnwPageHeader>

    <div class="org-layout">
      <div class="org-tree-panel">
        <el-tree
          ref="treeRef"
          :data="treeDisplayData"
          :props="{ children: 'children', label: 'name' }"
          node-key="id"
          highlight-current
          :default-expanded-keys="[ALL_ROOT_ID]"
          @node-click="onNodeClick"
          v-loading="store.loading"
        >
          <template #default="{ data }">
            <span class="tree-node" :class="{ 'tree-node-all': data.isAllRoot }">
              <el-tag :color="unitTypeColor[data.unitType] ?? '#909399'" size="small" style="color:#fff;border:none">
                {{ unitTypeLabel[data.unitType] ?? data.unitType }}
              </el-tag>
              <span style="margin-left:6px">{{ data.name }}</span>
            </span>
          </template>
        </el-tree>
      </div>

      <div class="org-detail-panel">
        <template v-if="selectedUnit && !editingUnit">
          <h3>{{ selectedUnit.name }}</h3>
          <el-tag size="small" :color="unitTypeColor[selectedUnit.unitType] ?? '#909399'" style="color:#fff;border:none">
            {{ unitTypeLabel[selectedUnit.unitType] ?? selectedUnit.unitType }}
          </el-tag>
          <el-button v-if="!isAllRoot(selectedUnit)" size="small" style="margin-left:8px" @click="onEditUnit">编辑</el-button>
          <p v-if="isAllRoot(selectedUnit)" class="panel-hint">汇总所有组织节点下的人员</p>
        </template>
        <el-form v-else-if="selectedUnit && editingUnit" label-position="top" size="small">
          <el-form-item label="名称">
            <el-input v-model="editUnitName" />
          </el-form-item>
          <el-form-item label="类型">
            <el-select v-model="editUnitType">
              <el-option v-for="o in dict.getOptions('orgUnitType')" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
          <el-form-item label="上级节点">
            <el-select v-model="editUnitParentId" clearable placeholder="无（根节点）">
              <el-option v-for="org in flattenUnits(store.tree)" :key="org.id" :label="'　'.repeat(org._depth) + org.name" :value="org.id" />
            </el-select>
          </el-form-item>
          <div>
            <el-button type="primary" size="small" @click="onSaveUnit">保存</el-button>
            <el-button size="small" @click="editingUnit = false">取消</el-button>
          </div>
        </el-form>

        <div class="unit-users" style="margin-top:16px">
          <h4>{{ memberSectionTitle() }} ({{ unitUsers.length }})</h4>
          <el-table
            :data="unitUsers"
            stripe
            size="small"
            empty-text="暂无人员"
            class="user-table"
          >
            <el-table-column label="显示名称" min-width="120">
              <template #default="{ row }">
                <span class="user-name-link" @click="onEditUser(row)">{{ row.displayName || row.username }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="username" label="账号" min-width="100" />
            <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.email || '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="90" align="center">
              <template #default="{ row }">
                <el-tag v-if="row.approved" type="success" size="small">已批准</el-tag>
                <el-tag v-else type="warning" size="small">待批准</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="归属组织" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ orgName(row.orgUnitId) }}</template>
            </el-table-column>
            <el-table-column label="更换组织" min-width="150">
              <template #default="{ row }">
                <el-select
                  v-if="row.approved"
                  size="small"
                  :model-value="row.orgUnitId"
                  placeholder="更换组织"
                  clearable
                  @change="(v: string | null) => onMoveUser(row.id, v)"
                  @click.stop
                >
                  <el-option
                    v-for="org in flattenUnits(store.tree)"
                    :key="org.id"
                    :label="'　'.repeat(org._depth) + org.name"
                    :value="org.id"
                  />
                </el-select>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="onEditUser(row)">编辑</el-button>
                <template v-if="!row.approved">
                  <el-button link type="success" size="small" @click="onApprove(row.id, true)">批准</el-button>
                  <el-button link type="danger" size="small" @click="onApprove(row.id, false)">拒绝</el-button>
                </template>
              </template>
            </el-table-column>
          </el-table>
        </div>
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
            <el-option v-for="o in dict.getOptions('orgUnitType')" :key="o.value" :label="o.label" :value="o.value" />
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
          <el-select v-model="editOrgId" clearable placeholder="选择组织（清空→待定组）" style="width:100%">
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
.tree-node-all { font-weight: 600; }
.org-detail-panel { flex: 1; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; padding: 16px; min-height: 300px; }
.org-detail-panel h3 { font-size: 1.1rem; margin-bottom: 8px; }
.panel-hint { margin: 0 0 4px; font-size: 0.85rem; color: #909399; }
.unit-users h4 { margin-bottom: 12px; font-size: 0.95rem; font-weight: 600; }
.user-table { width: 100%; }
.user-name-link { cursor: pointer; color: var(--el-color-primary); }
.user-name-link:hover { text-decoration: underline; }
.text-muted { color: #c0c4cc; font-size: 12px; }
@media (max-width: 768px) {
  .org-layout { flex-direction: column; }
  .org-tree-panel { width: 100%; }
  .org-detail-panel { min-height: 0; }
}
</style>
