<script setup lang="ts">
import { useRouter } from 'vue-router'

defineProps<{ collapsed: boolean }>()
const router = useRouter()

const groups = [
  {
    label: '列表',
    tools: [
      { label: '仪表盘', icon: 'Odometer', action: () => router.push('/dashboard') },
      { label: '我的列表', icon: 'List', action: () => router.push('/lists') },
      { label: '新建列表', icon: 'Plus', action: () => router.push('/lists') },
    ],
  },
  {
    label: '组织',
    tools: [
      { label: '组织架构', icon: 'Share', action: () => router.push('/org') },
      { label: '推送历史', icon: 'Promotion', action: () => router.push('/push-history') },
    ],
  },
]
</script>

<template>
  <div class="ribbon" :class="{ collapsed }">
    <template v-if="!collapsed">
      <div class="ribbon-group" v-for="group in groups" :key="group.label">
        <span class="ribbon-group-label">{{ group.label }}</span>
        <div class="ribbon-tools">
          <button
            v-for="tool in group.tools" :key="tool.label"
            class="ribbon-btn"
            @click="tool.action()"
          >
            <el-icon :size="18"><component :is="tool.icon" /></el-icon>
            <span>{{ tool.label }}</span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.ribbon {
  background: #fafbfc;
  border-bottom: 1px solid #e4e7ed;
  padding: 4px 12px;
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  min-height: 68px;
  transition: min-height 0.15s;
  overflow: hidden;
}
.ribbon.collapsed {
  min-height: 0;
  height: 0;
  padding-top: 0;
  padding-bottom: 0;
  border-bottom: none;
}
.ribbon-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 2px 6px;
  border-right: 1px solid #ebeef5;
  margin-right: 4px;
}
.ribbon-group-label {
  font-size: 0.68rem;
  color: #909399;
  padding: 0 2px;
}
.ribbon-tools {
  display: flex;
  gap: 2px;
}
.ribbon-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  font-size: 0.68rem;
  color: #606266;
  min-width: 56px;
  transition: background 0.15s;
}
.ribbon-btn:hover {
  background: #ecf5ff;
  color: #409eff;
}
</style>
