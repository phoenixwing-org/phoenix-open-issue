<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

const props = defineProps<{
  nodes: readonly Record<string, any>[]
  loading: boolean
  activeNodeId: string
  unitTypeLabel: (unitType: string) => string
  unitTypeColor: (unitType: string) => string
  onSelect: (node: Record<string, any>) => void
}>()

const treeRef = ref<any>(null)

watch(
  () => props.activeNodeId,
  async (nodeId) => {
    await nextTick()
    treeRef.value?.setCurrentKey(nodeId)
  },
  { immediate: true },
)
</script>

<template>
  <div class="poi-org-primary" data-tour="org-tree">
    <el-tree
      ref="treeRef"
      :data="nodes"
      :props="{ children: 'children', label: 'name' }"
      node-key="id"
      highlight-current
      :default-expanded-keys="['__all__']"
      :current-node-key="activeNodeId"
      v-loading="loading"
      @node-click="onSelect"
    >
      <template #default="{ data }">
        <span class="poi-org-node" :class="{ 'poi-org-node--all': data.isAllRoot }">
          <el-tag
            :color="data.unitType === 'all' ? '#409eff' : unitTypeColor(data.unitType)"
            size="small"
            style="color:#fff;border:none"
          >
            {{ unitTypeLabel(data.unitType) }}
          </el-tag>
          <span>{{ data.name }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<style scoped>
.poi-org-primary {
  height: 100%;
  overflow: auto;
  padding: 12px;
}
.poi-org-node {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
}
.poi-org-node--all {
  font-weight: 600;
}
</style>
