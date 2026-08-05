<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useDictGroup } from '/$/phoenix-open-issue/composables/useDictGroup'
import { getAllUsers } from '/$/phoenix-open-issue/api/auth'
import type { UserPublic } from '/$/phoenix-open-issue/core'
import { useIssueCapabilities } from '/$/phoenix-open-issue/composables/useIssueCapabilities'

const props = defineProps<{
  initial?: { name: string; description: string; listType: string; ownerId?: string }
  canEditOwner?: boolean
}>()
const emit = defineEmits<{
  confirm: [data: { name: string; listType: string; description?: string; ownerId?: string }]
  close: []
}>()

const capabilities = useIssueCapabilities()
const canListHostUsers = computed(() => capabilities.has('base:sys:user:list'))
const { options: listTypeOptions, ensureLoaded: ensureListTypeLoaded, defaultOf: listTypeDefault } = useDictGroup('listType')
const name = ref(props.initial?.name || '')
const listType = ref(props.initial?.listType || '')
const description = ref(props.initial?.description || '')
const ownerId = ref(props.initial?.ownerId || '')
const users = ref<UserPublic[]>([])
const isEdit = computed(() => !!props.initial)

const userOptions = computed(() =>
  users.value.map(u => ({
    value: u.id,
    label: u.displayName ? `${u.displayName} (${u.username})` : u.username,
  })),
)

onMounted(async () => {
  await ensureListTypeLoaded()
  if (!listType.value) {
    listType.value = listTypeDefault('custom')
  }
  if (props.canEditOwner && isEdit.value && canListHostUsers.value) {
    const res = await getAllUsers()
    users.value = res.data
    if (!ownerId.value && props.initial?.ownerId) {
      ownerId.value = props.initial.ownerId
    }
  }
})

function submit() {
  if (!name.value.trim()) return
  const data: { name: string; listType: string; description?: string; ownerId?: string } = {
    name: name.value,
    listType: listType.value,
    description: description.value,
  }
  if (props.canEditOwner && isEdit.value && canListHostUsers.value && ownerId.value) {
    data.ownerId = ownerId.value
  }
  emit('confirm', data)
}
</script>

<template>
  <el-dialog :model-value="true" :title="isEdit ? '编辑列表' : '新建列表'" width="450px" @close="emit('close')">
    <el-form label-position="top" @submit.prevent="submit">
      <el-form-item label="名称" required>
        <el-input v-model="name" placeholder="如：2026年7月点检" />
      </el-form-item>
      <el-form-item label="类型">
        <el-select v-model="listType" :teleported="false">
          <el-option
            v-for="o in listTypeOptions"
            :key="o.value"
            :label="o.label"
            :value="o.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item v-if="canEditOwner && isEdit && canListHostUsers" label="负责人">
        <el-select v-model="ownerId" filterable placeholder="选择负责人" :teleported="false" style="width:100%">
          <el-option v-for="o in userOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="description" type="textarea" :rows="2" placeholder="可选" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="emit('close')">取消</el-button>
      <el-button type="primary" @click="submit">确认</el-button>
    </template>
  </el-dialog>
</template>
