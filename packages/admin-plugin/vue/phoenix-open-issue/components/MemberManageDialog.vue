<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  members: Array<{ id: string; userId: string; username: string; displayName: string | null; role: string }>
  allUsers: Array<{ id: string; username: string; displayName: string | null }>
  primaryOwnerId?: string
  currentUserId?: string
  canManage?: boolean
  canGrantOwner?: boolean
  isOwner?: boolean
}>()
const emit = defineEmits<{
  add: [userId: string, role: string]
  remove: [userId: string]
  updateRole: [userId: string, role: string]
  transferOwner: [userId: string]
  close: []
}>()

const selectedUserId = ref('')
const selectedRole = ref('editor')

const nonMemberUsers = computed(() =>
  props.allUsers.filter(u => !props.members.find(m => m.userId === u.id)),
)

const ownerCount = computed(() => props.members.filter(m => m.role === 'owner').length)

const allRoleOptions = [
  { label: '所有者', value: 'owner' },
  { label: '管理员', value: 'admin' },
  { label: '编辑者', value: 'editor' },
  { label: '报告者', value: 'reporter' },
  { label: '观察者', value: 'viewer' },
]

const addRoleOptions = computed(() => {
  if (props.canGrantOwner) return allRoleOptions
  return allRoleOptions.filter(o => o.value !== 'owner')
})

function isPrimaryOwner(userId: string) {
  return !!props.primaryOwnerId && userId === props.primaryOwnerId
}

function roleOptionsFor(m: { role: string }) {
  if (props.isOwner) return allRoleOptions
  if (m.role === 'owner') return allRoleOptions.filter(o => o.value === 'owner')
  return allRoleOptions.filter(o => o.value !== 'owner')
}

function canEditRole(m: { userId: string; role: string }) {
  if (!props.canManage) return false
  if (m.role === 'owner' && ownerCount.value <= 1) return false
  if (!props.isOwner && m.role === 'owner') return false
  return true
}

function canRemoveMember(m: { userId: string; role: string }) {
  if (!props.canManage) return false
  if (isPrimaryOwner(m.userId)) return false
  if (m.role !== 'owner') return true
  return ownerCount.value > 1
}

function canSetPrimary(m: { userId: string }) {
  return props.isOwner && !isPrimaryOwner(m.userId)
}

function onAdd() {
  if (!selectedUserId.value) return
  emit('add', selectedUserId.value, selectedRole.value)
  selectedUserId.value = ''
  selectedRole.value = 'editor'
}

function onRoleChange(m: { userId: string; role: string }, newRole: string) {
  if (newRole === m.role) return
  emit('updateRole', m.userId, newRole)
}
</script>

<template>
  <el-dialog :model-value="true" title="管理成员" width="640px" @close="emit('close')">
    <p class="hint">
      可设<strong>多名所有者</strong>；「主负责人」用于列表展示与推送审批，设为主负责人时<strong>不降级</strong>原主负责人的权限。主负责人<strong>不可移除</strong>，须先指定新的主负责人。
    </p>

    <h4 style="margin-bottom:8px">当前成员</h4>
    <el-table :data="props.members" size="small" stripe empty-text="暂无成员">
      <el-table-column label="成员" min-width="120">
        <template #default="{ row }">
          {{ row.displayName || row.username }}
        </template>
      </el-table-column>
      <el-table-column label="权限" width="130">
        <template #default="{ row }">
          <el-select
            v-if="canEditRole(row)"
            :model-value="row.role"
            size="small"
            style="width:110px"
            @change="(v: string) => onRoleChange(row, v)"
          >
            <el-option v-for="o in roleOptionsFor(row)" :key="o.value" :label="o.label" :value="o.value" />
          </el-select>
          <span v-else>{{ allRoleOptions.find(o => o.value === row.role)?.label || row.role }}</span>
        </template>
      </el-table-column>
      <el-table-column label="标识" width="100" align="center">
        <template #default="{ row }">
          <el-tag v-if="isPrimaryOwner(row.userId)" type="warning" size="small" effect="plain">主负责人</el-tag>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center">
        <template #default="{ row }">
          <el-button v-if="canSetPrimary(row)" link type="primary" size="small" @click="emit('transferOwner', row.userId)">
            设为主负责人
          </el-button>
          <el-button v-if="canRemoveMember(row)" link type="danger" size="small" @click="emit('remove', row.userId)">
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <template v-if="canManage">
      <el-divider />
      <h4 style="margin-bottom:8px">添加成员</h4>
      <p class="hint-sm">非成员须先添加为成员后，才能设为主负责人（Q2）。</p>
      <div class="add-member">
        <el-select v-model="selectedUserId" placeholder="选择用户" filterable style="flex:1">
          <el-option v-for="u in nonMemberUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
        </el-select>
        <el-select v-model="selectedRole" style="width:110px">
          <el-option v-for="o in addRoleOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
        <el-button type="primary" @click="onAdd" :disabled="!selectedUserId">添加</el-button>
      </div>
    </template>

    <template #footer>
      <el-button @click="emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.hint { margin: 0 0 12px; font-size: 0.85rem; color: #909399; line-height: 1.5; }
.hint-sm { margin: 0 0 8px; font-size: 0.78rem; color: #909399; }
.text-muted { color: #c0c4cc; font-size: 12px; }
.add-member { display: flex; gap: 8px; flex-wrap: wrap; }
</style>
