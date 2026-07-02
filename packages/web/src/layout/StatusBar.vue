<script setup lang="ts">
defineProps<{ label: string }>()
const emit = defineEmits<{ 'toggle-log': [] }>()
</script>

<template>
  <footer class="status">
    <span class="status-label">【{{ label }}】</span>
    <span class="status-divider">·</span>
    <span>Open Issue List v0.1</span>
    <span style="flex:1" />
    <button class="log-toggle" title="日志" @click="emit('toggle-log')">📋</button>
  </footer>
</template>

<style scoped>
.status {
  height: 26px;
  flex-shrink: 0;
  padding: 0 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  color: #909399;
  background: #fafbfc;
  border-top: 1px solid #e4e7ed;
}
.status-label {
  color: #409eff;
  font-weight: 500;
}
.status-divider {
  color: #dcdfe6;
}
</style>
