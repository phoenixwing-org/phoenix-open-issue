<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  members: Array<{ id: string; userId: string; username: string; displayName: string | null; role: string }>
  allUsers: Array<{ id: string; username: string; displayName: string | null }>
}>()
const emit = defineEmits<{
  add: [userId: string, role: string]
  remove: [userId: string]
  close: []
}>()

const selectedUserId = ref('')
const selectedRole = ref('editor')

const nonMemberUsers = computed(() =>
  props.allUsers.filter(u => !props.members.find(m => m.userId === u.id)),
)

const roleLabel: Record<string, string> = { owner: '所有者', editor: '编辑者', viewer: '观察者' }
const roleColor: Record<string, string> = { owner: 'danger', editor: 'warning', viewer: 'info' }

function onAdd() {
  if (!selectedUserId.value) return
  emit('add', selectedUserId.value, selectedRole.value)
  selectedUserId.value = ''
}
</script>

<template>
  <el-dialog :model-value="true" title="管理成员" width="500px" @close="emit('close')">
    <!-- Current members -->
    <h4 style="margin-bottom:8px">当前成员</h4>
    <div class="member-list">
      <div v-for="m in props.members" :key="m.id" class="member-row">
        <span>{{ m.displayName || m.username }}</span>
        <el-tag :type="roleColor[m.role]" size="small">{{ roleLabel[m.role] }}</el-tag>
        <el-button v-if="m.role !== 'owner'" link type="danger" size="small" @click="emit('remove', m.userId)">移除</el-button>
      </div>
    </div>

    <el-divider />

    <!-- Add member -->
    <h4 style="margin-bottom:8px">添加成员</h4>
    <div class="add-member">
      <el-select v-model="selectedUserId" placeholder="选择用户" style="flex:1">
        <el-option v-for="u in nonMemberUsers" :key="u.id" :label="u.displayName || u.username" :value="u.id" />
      </el-select>
      <el-select v-model="selectedRole" style="width:100px">
        <el-option label="编辑者" value="editor" />
        <el-option label="观察者" value="viewer" />
      </el-select>
      <el-button type="primary" @click="onAdd" :disabled="!selectedUserId">添加</el-button>
    </div>

    <template #footer>
      <el-button @click="emit('close')">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.member-list { display: flex; flex-direction: column; gap: 8px; }
.member-row { display: flex; align-items: center; gap: 8px; }
.add-member { display: flex; gap: 8px; }
</style>
