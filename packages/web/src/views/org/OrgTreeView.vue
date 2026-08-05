<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useOrgUnitStore } from '@/stores/orgUnits'
import { useDictStore } from '@/stores/dict'
import { useSettingsStore } from '@/stores/settings'

const dict = useDictStore()
const settings = useSettingsStore()
import PnwPageHeader from "phoenix-wing/layout/PnwPageHeader.vue"
import PageHelpButton from "@/components/PageHelpButton.vue"
import { getOrgUnitUsers, createOrgUnit, updateOrgUnit } from '@/api/orgUnits'
import {
  approveUser,
  updateUserOrg,
  updateUser,
  getAllUsers,
  getPendingUsers,
  disableUser,
  enableUser,
  adminResetPassword,
  getUserExternalIdentities,
  unlinkUserExternalIdentity,
  listExternalBindRequests,
  updateExternalBindRequest,
  bindExternalBindRequest,
  createAndBindExternalBindRequest,
  rejectExternalBindRequest,
  checkUsernameAvailable,
} from '@/api/auth'
import { ElMessage } from 'element-plus'
import { pnwPromptChoice } from 'phoenix-wing'
import type { ExternalBindRequestAdminView, ExternalIdentityAdminView, SystemRole } from '@open-issue/core'
import { isSystemAdmin } from '@open-issue/core'
import { useAuthStore } from '@/stores/auth'
import PoiOrgPrimary from '@/components/workbench/PoiOrgPrimary.vue'
import { usePoiViewContribution } from '@/layout/workbench/poiViewContributions'

const route = useRoute()
const auth = useAuthStore()
const isAdmin = computed(() => isSystemAdmin(auth.user ?? undefined))

const SYSTEM_ROLE_OPTIONS: { value: SystemRole; label: string }[] = [
  { value: 'admin', label: '管理员' },
  { value: 'editor', label: '编辑' },
  { value: 'viewer', label: '查看' },
]

const store = useOrgUnitStore()
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
  selectedUnit.value = allRootSelection()
  await loadAllUsers()
  if (isAdmin.value) await loadBindRequests()
})

const bindRequests = ref<ExternalBindRequestAdminView[]>([])
const bindRequestsLoading = ref(false)
const showHandleBind = ref(false)
const handleBindRow = ref<ExternalBindRequestAdminView | null>(null)
const handleMode = ref<'bind' | 'create'>('bind')
const handleBindUserId = ref('')
const handleUsername = ref('')
const handleDisplayName = ref('')
const handlePassword = ref('')
const handleNote = ref('')
const usernameAvailable = ref<boolean | null>(null)
const handleSubmitting = ref(false)

async function loadBindRequests() {
  if (!isAdmin.value) return
  bindRequestsLoading.value = true
  try {
    const res = await listExternalBindRequests({ status: 'pending' })
    bindRequests.value = res.data
  } finally {
    bindRequestsLoading.value = false
  }
}

const approvedUsersForBind = ref<any[]>([])

function openHandleBind(row: ExternalBindRequestAdminView) {
  handleBindRow.value = row
  handleMode.value = 'bind'
  handleBindUserId.value = ''
  handleUsername.value = row.proposedUsername || ''
  handleDisplayName.value = row.proposedDisplayName || row.displayName || ''
  handlePassword.value = ''
  handleNote.value = row.note || ''
  usernameAvailable.value = null
  showHandleBind.value = true
  void getAllUsers({ includeDisabled: 'true' }).then(res => {
    approvedUsersForBind.value = res.data.filter((u: any) => u.approved && !u.disabled)
  })
}

async function onCheckUsername() {
  const name = handleUsername.value.trim()
  if (!name) {
    usernameAvailable.value = null
    return
  }
  try {
    const res = await checkUsernameAvailable(name)
    usernameAvailable.value = res.data.available
  } catch {
    usernameAvailable.value = false
  }
}

async function onSaveBindDraft() {
  if (!handleBindRow.value) return
  await updateExternalBindRequest(handleBindRow.value.id, {
    proposedUsername: handleUsername.value.trim() || undefined,
    proposedDisplayName: handleDisplayName.value.trim() || undefined,
    note: handleNote.value.trim() || undefined,
  })
  ElMessage.success('已保存草稿')
  await loadBindRequests()
}

async function onSubmitHandleBind() {
  if (!handleBindRow.value) return
  handleSubmitting.value = true
  try {
    if (handleMode.value === 'bind') {
      if (!handleBindUserId.value) {
        ElMessage.error('请选择要绑定的本地用户')
        return
      }
      await bindExternalBindRequest(handleBindRow.value.id, handleBindUserId.value)
      ElMessage.success('已绑定到现有账号')
    } else {
      const username = handleUsername.value.trim()
      if (!username || handlePassword.value.length < 6) {
        ElMessage.error('请填写用户名，且密码至少 6 位')
        return
      }
      const check = await checkUsernameAvailable(username)
      if (!check.data.available) {
        usernameAvailable.value = false
        ElMessage.error('用户名已存在')
        return
      }
      await createAndBindExternalBindRequest(handleBindRow.value.id, {
        username,
        password: handlePassword.value,
        displayName: handleDisplayName.value.trim() || undefined,
      })
      ElMessage.success('已新建账号并绑定')
    }
    showHandleBind.value = false
    await Promise.all([loadBindRequests(), reloadUsers()])
  } finally {
    handleSubmitting.value = false
  }
}

async function onRejectBind(row: ExternalBindRequestAdminView) {
  const result = await pnwPromptChoice({
    title: '拒绝绑定申请',
    message: `拒绝飞书「${row.displayName || row.openId || row.id}」的绑定申请？`,
    choices: [
      { id: 'reject', label: '拒绝', variant: 'danger' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (result.choiceId !== 'reject') return
  await rejectExternalBindRequest(row.id)
  ElMessage.success('已拒绝')
  await loadBindRequests()
}

async function loadAllUsers() {
  if (isAdmin.value) {
    const [approvedRes, pendingRes] = await Promise.all([getAllUsers({ includeDisabled: 'true' }), getPendingUsers()])
    unitUsers.value = [...pendingRes.data, ...approvedRes.data]
  } else {
    const approvedRes = await getAllUsers({ includeDisabled: 'true' })
    unitUsers.value = approvedRes.data
  }
}

async function reloadUsers() {
  if (!selectedUnit.value || isAllRoot(selectedUnit.value)) {
    await loadAllUsers()
    return
  }
  const res = await getOrgUnitUsers(selectedUnit.value.id, settings.orgIncludeChildren)
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

async function onDisableUser(userId: string, name: string) {
  const r = await pnwPromptChoice({
    title: '确认禁用',
    message: `确定禁用用户「${name}」？禁用后无法登录且不会出现在用户列表中。`,
    choices: [
      { id: 'confirm', label: '禁用', variant: 'danger' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (r.choiceId !== 'confirm') return
  try {
    await disableUser(userId)
    ElMessage.success('已禁用')
    await reloadUsers()
  } catch (e: any) {
    console.error('禁用失败', e)
    ElMessage.error(e?.response?.data?.message || '禁用失败')
  }
}

async function onEnableUser(userId: string) {
  try {
    await enableUser(userId)
    ElMessage.success('已启用')
    await reloadUsers()
  } catch (e: any) {
    console.error('启用失败', e)
    ElMessage.error(e?.response?.data?.message || '启用失败')
  }
}

async function onMoveUser(userId: string, newOrgId: string | null) {
  await updateUserOrg(userId, newOrgId)
  ElMessage.success('已更新组织')
  await reloadUsers()
}

async function onChangeSystemRole(userId: string, role: SystemRole) {
  await updateUser(userId, { systemRole: role })
  ElMessage.success('权限已更新')
  await reloadUsers()
}

const showEditUser = ref(false)
const editUser = ref<any>(null)
const editDisplayName = ref('')
const editEmail = ref('')
const editOrgId = ref<string | null>(null)
const editSystemRole = ref<SystemRole>('editor')
const resetPasswordValue = ref('')
const resetPasswordConfirm = ref('')
const editExternalIdentities = ref<ExternalIdentityAdminView[]>([])
const externalIdentitiesLoading = ref(false)

async function onResetPassword() {
  if (!editUser.value) return
  if (resetPasswordValue.value !== resetPasswordConfirm.value) {
    ElMessage.error('两次密码输入不一致')
    return
  }
  if (resetPasswordValue.value.length < 6) {
    ElMessage.error('密码长度不能少于6位')
    return
  }
  await adminResetPassword(editUser.value.id, resetPasswordValue.value)
  ElMessage.success('密码已重置')
  resetPasswordValue.value = ''
  resetPasswordConfirm.value = ''
}

async function onEditUser(u: any) {
  editUser.value = u
  editDisplayName.value = u.displayName || ''
  editEmail.value = u.email || ''
  editOrgId.value = u.orgUnitId
  editSystemRole.value = u.systemRole || 'editor'
  resetPasswordValue.value = ''
  resetPasswordConfirm.value = ''
  editExternalIdentities.value = []
  showEditUser.value = true
  externalIdentitiesLoading.value = true
  try {
    const res = await getUserExternalIdentities(u.id)
    editExternalIdentities.value = res.data
  } finally {
    externalIdentitiesLoading.value = false
  }
}

async function onAdminUnlinkExternal(identity: ExternalIdentityAdminView) {
  if (!editUser.value) return
  const label = identity.displayName || identity.email || identity.openId || '该飞书账号'
  const result = await pnwPromptChoice({
    title: '管理员解除飞书绑定',
    message: `确定解除「${label}」与用户「${editUser.value.displayName || editUser.value.username}」的绑定？用户之后不能再用该飞书账号登录。`,
    choices: [
      { id: 'unlink', label: '解除绑定', variant: 'danger' },
      { id: 'cancel', label: '取消' },
    ],
  })
  if (result.choiceId !== 'unlink') return
  await unlinkUserExternalIdentity(editUser.value.id, identity.id)
  ElMessage.success('已解除飞书绑定')
  const res = await getUserExternalIdentities(editUser.value.id)
  editExternalIdentities.value = res.data
}

async function onSaveUser() {
  if (!editUser.value) return
  await updateUser(editUser.value.id, {
    displayName: editDisplayName.value || undefined,
    email: editEmail.value || undefined,
    orgUnitId: editOrgId.value,
    systemRole: editSystemRole.value,
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

function unitTypeLabel(unitType: string): string {
  return unitType === 'all' ? '全部' : dict.getLabel('orgUnitType', unitType)
}

usePoiViewContribution(() => route.fullPath, {
  primary: {
    component: PoiOrgPrimary,
    props: computed(() => ({
      nodes: treeDisplayData.value,
      loading: store.loading,
      activeNodeId: selectedUnit.value?.id ?? ALL_ROOT_ID,
      unitTypeLabel,
      unitTypeColor: (unitType: string) => dict.getGroupColor('orgUnitType', unitType),
      onSelect: onNodeClick,
    })),
  },
})

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
  if (!unitHasChildren(selectedUnit.value)) return '成员'
  return settings.orgIncludeChildren ? '成员 (含下级组织)' : '成员 (仅本级)'
}

/** 统一判断用户是否禁用（与节点无关，兼容 0/1 与 boolean） */
function isUserDisabled(row: { disabled?: number | boolean | null }) {
  return !!row.disabled
}

/** 统一用户状态展示：禁用 > 待批准 > 已批准 */
function userStatusTag(row: { disabled?: number | boolean | null; approved?: number | boolean | null }) {
  if (isUserDisabled(row)) return { type: 'danger' as const, label: '已禁用' }
  if (row.approved) return { type: 'success' as const, label: '已批准' }
  return { type: 'warning' as const, label: '待批准' }
}

function systemRoleLabel(role: string | undefined) {
  return SYSTEM_ROLE_OPTIONS.find(o => o.value === role)?.label ?? role ?? '—'
}
</script>

<template>
  <div class="page">
    <PnwPageHeader title="组织架构">
      <template #actions>
        <el-button v-if="isAdmin" type="primary" size="small" @click="showCreate = true" data-tour="org-create"><el-icon><Plus /></el-icon> 新建节点</el-button>
      </template>
      <template #help><PageHelpButton page-id="org" /></template>
    </PnwPageHeader>

    <p v-if="!isAdmin" class="panel-hint" style="margin-bottom:12px">仅系统管理员可编辑组织节点、审批用户及管理成员。</p>

    <div
      v-if="isAdmin"
      v-loading="bindRequestsLoading"
      class="bind-requests-panel"
      data-tour="org-bind-requests"
    >
      <div class="bind-requests-header">
        <h4 style="margin:0">第三方登录待审查 ({{ bindRequests.length }})</h4>
        <el-button link type="primary" size="small" @click="loadBindRequests">刷新</el-button>
      </div>
      <el-table v-if="bindRequests.length" :data="bindRequests" size="small" stripe empty-text="暂无待审查">
        <el-table-column label="提供方" width="80">
          <template #default="{ row }">{{ row.provider === 'feishu' ? '飞书' : row.provider }}</template>
        </el-table-column>
        <el-table-column label="飞书姓名" min-width="120">
          <template #default="{ row }">{{ row.displayName || '—' }}</template>
        </el-table-column>
        <el-table-column label="拟用用户名" min-width="120">
          <template #default="{ row }">{{ row.proposedUsername || '—' }}</template>
        </el-table-column>
        <el-table-column label="拟用姓名" min-width="120">
          <template #default="{ row }">{{ row.proposedDisplayName || '—' }}</template>
        </el-table-column>
        <el-table-column label="邮箱" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">{{ row.email || '—' }}</template>
        </el-table-column>
        <el-table-column label="最近登录尝试" width="160">
          <template #default="{ row }">{{ new Date(row.lastSeenAt).toLocaleString('zh-CN', { hour12: false }) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openHandleBind(row)">处理</el-button>
            <el-button link type="danger" size="small" @click="onRejectBind(row)">拒绝</el-button>
          </template>
        </el-table-column>
      </el-table>
      <p v-else class="panel-hint" style="margin:8px 0 0">暂无待审查的飞书绑定申请。用户在登录页使用飞书登录后会出现在此。</p>
    </div>

    <div class="org-layout">
      <div class="org-detail-panel" data-tour="org-detail">
        <template v-if="selectedUnit && !editingUnit">
          <h3>{{ selectedUnit.name }}</h3>
          <el-tag size="small" :color="dict.getGroupColor('orgUnitType', selectedUnit.unitType)" style="color:#fff;border:none">
            {{ dict.getLabel('orgUnitType', selectedUnit.unitType) }}
          </el-tag>
          <el-button v-if="isAdmin && !isAllRoot(selectedUnit)" size="small" style="margin-left:8px" @click="onEditUnit">编辑</el-button>
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
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
            <h4 style="margin:0">{{ memberSectionTitle() }} ({{ unitUsers.length }})</h4>
            <el-checkbox
              v-if="!isAllRoot(selectedUnit) && unitHasChildren(selectedUnit)"
              v-model="settings.orgIncludeChildren"
              size="small"
              @change="reloadUsers"
            >包含下级组织</el-checkbox>
          </div>
          <el-table
            :data="unitUsers"
            stripe
            size="small"
            empty-text="暂无人员"
            class="user-table"
            data-tour="org-users"
          >
            <el-table-column label="显示名称" min-width="120">
              <template #default="{ row }">
                <span
                  v-if="isAdmin"
                  class="user-name-link"
                  @click="onEditUser(row)"
                >{{ row.displayName || row.username }}</span>
                <span v-else>{{ row.displayName || row.username }}</span>
              </template>
            </el-table-column>
            <el-table-column prop="username" label="账号" min-width="100" />
            <el-table-column prop="email" label="邮箱" min-width="160" show-overflow-tooltip>
              <template #default="{ row }">{{ row.email || '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100" align="center">
              <template #default="{ row }">
                <el-tag :type="userStatusTag(row).type" size="small">{{ userStatusTag(row).label }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="权限" width="110" align="center">
              <template #default="{ row }">
                <el-select
                  v-if="isAdmin && row.approved"
                  size="small"
                  :model-value="row.systemRole || 'editor'"
                  @change="(v: SystemRole) => onChangeSystemRole(row.id, v)"
                  @click.stop
                >
                  <el-option v-for="o in SYSTEM_ROLE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
                </el-select>
                <span v-else-if="row.approved">{{ systemRoleLabel(row.systemRole) }}</span>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="归属组织" min-width="140" show-overflow-tooltip>
              <template #default="{ row }">{{ orgName(row.orgUnitId) }}</template>
            </el-table-column>
            <el-table-column v-if="isAdmin" label="更换组织" min-width="150">
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
            <el-table-column v-if="isAdmin" label="操作" width="200" fixed="right" align="center">
              <template #default="{ row }">
                <el-button link type="primary" size="small" @click="onEditUser(row)">编辑</el-button>
                <template v-if="!row.approved">
                  <el-button link type="success" size="small" @click="onApprove(row.id, true)">批准</el-button>
                  <el-button link type="danger" size="small" @click="onApprove(row.id, false)">拒绝</el-button>
                </template>
                <template v-else>
                  <el-button v-if="!isUserDisabled(row)" link type="danger" size="small" @click="onDisableUser(row.id, row.displayName || row.username)">禁用</el-button>
                  <el-button v-else link type="success" size="small" @click="onEnableUser(row.id)">启用</el-button>
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
        <el-form-item label="系统权限">
          <el-select v-model="editSystemRole" style="width:100%">
            <el-option v-for="o in SYSTEM_ROLE_OPTIONS" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
        </el-form-item>
        <el-divider />
        <h4>第三方登录</h4>
        <div v-loading="externalIdentitiesLoading" class="external-identities-admin">
          <div v-for="identity in editExternalIdentities" :key="identity.id" class="external-identity-admin">
            <div>
              <strong>飞书 · {{ identity.displayName || identity.email || identity.openId }}</strong>
              <p>租户 {{ identity.tenantKey || '未知' }} · {{ identity.status === 'active' ? '已绑定' : '已解除' }}</p>
            </div>
            <el-button
              v-if="identity.status === 'active'"
              link
              type="danger"
              size="small"
              @click="onAdminUnlinkExternal(identity)"
            >解除</el-button>
          </div>
          <p v-if="!editExternalIdentities.length && !externalIdentitiesLoading" class="text-muted">未绑定第三方登录</p>
        </div>
        <el-divider />
        <h4>密码重置（管理员）</h4>
        <p style="color:#909399;font-size:12px;margin:0 0 8px">至少 6 位字符，留空则不修改</p>
        <el-form-item label="新密码" :error="resetPasswordValue && resetPasswordValue.length < 6 ? '密码长度不能少于6位' : ''">
          <el-input v-model="resetPasswordValue" type="password" show-password placeholder="输入新密码" autocomplete="new-password" />
        </el-form-item>
        <el-form-item v-if="resetPasswordValue" label="确认新密码" :error="resetPasswordConfirm && resetPasswordValue !== resetPasswordConfirm ? '两次密码输入不一致' : ''">
          <el-input v-model="resetPasswordConfirm" type="password" show-password autocomplete="new-password" />
        </el-form-item>
        <el-button
          v-if="resetPasswordValue"
          type="warning" size="small"
          :disabled="resetPasswordValue !== resetPasswordConfirm || resetPasswordValue.length < 6"
          @click="onResetPassword"
        >重置密码</el-button>
      </el-form>
      <template #footer>
        <el-button @click="showEditUser = false">取消</el-button>
        <el-button type="primary" @click="onSaveUser">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showHandleBind" title="处理飞书绑定申请" width="480px">
      <template v-if="handleBindRow">
        <el-alert
          :title="`飞书 · ${handleBindRow.displayName || handleBindRow.openId || '未知用户'}`"
          type="info"
          :closable="false"
          show-icon
          style="margin-bottom:12px"
        >
          <p style="margin:4px 0 0">邮箱 {{ handleBindRow.email || '—' }} · 租户 {{ handleBindRow.tenantKey || '未知' }}</p>
        </el-alert>
        <el-form label-position="top" size="small">
          <el-form-item label="拟用用户名">
            <el-input v-model="handleUsername" maxlength="64" @blur="onCheckUsername" />
            <p v-if="usernameAvailable === true" class="text-muted" style="color:#67c23a">用户名可用</p>
            <p v-else-if="usernameAvailable === false" class="text-muted" style="color:#f56c6c">用户名不可用或已存在</p>
          </el-form-item>
          <el-form-item label="拟用姓名">
            <el-input v-model="handleDisplayName" maxlength="64" />
          </el-form-item>
          <el-form-item label="备注">
            <el-input v-model="handleNote" type="textarea" :rows="2" maxlength="500" />
          </el-form-item>
          <el-form-item label="处理方式">
            <el-radio-group v-model="handleMode">
              <el-radio value="bind">绑定已有账号</el-radio>
              <el-radio value="create">新建账号并绑定</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="handleMode === 'bind'" label="选择本地用户">
            <el-select v-model="handleBindUserId" filterable placeholder="选择已批准用户" style="width:100%">
              <el-option
                v-for="u in approvedUsersForBind"
                :key="u.id"
                :label="`${u.displayName || u.username} (${u.username})`"
                :value="u.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item v-else label="初始密码">
            <el-input v-model="handlePassword" type="password" show-password placeholder="至少 6 位" autocomplete="new-password" />
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="onSaveBindDraft">仅保存草稿</el-button>
        <el-button @click="showHandleBind = false">取消</el-button>
        <el-button type="primary" :loading="handleSubmitting" @click="onSubmitHandleBind">确认处理</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.page-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.page-head h2 { font-size: 1.3rem; font-weight: 650; }
.bind-requests-panel { background: #fff; border-radius: 8px; border: 1px solid #ebeef5; padding: 12px 16px; margin-bottom: 16px; }
.bind-requests-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
.org-layout { min-width: 0; }
.org-detail-panel { flex: 1; background: #fff; border-radius: 8px; border: 1px solid #ebeef5; padding: 16px; min-height: 300px; }
.org-detail-panel h3 { font-size: 1.1rem; margin-bottom: 8px; }
.panel-hint { margin: 0 0 4px; font-size: 0.85rem; color: #909399; }
.unit-users h4 { margin-bottom: 12px; font-size: 0.95rem; font-weight: 600; }
.user-table { width: 100%; }
.user-name-link { cursor: pointer; color: var(--el-color-primary); }
.user-name-link:hover { text-decoration: underline; }
.text-muted { color: #c0c4cc; font-size: 12px; }
.external-identities-admin { min-height: 28px; }
.external-identity-admin { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; margin-top: 8px; border: 1px solid #ebeef5; border-radius: 6px; }
.external-identity-admin p { margin: 3px 0 0; color: #909399; font-size: 11px; }
</style>
