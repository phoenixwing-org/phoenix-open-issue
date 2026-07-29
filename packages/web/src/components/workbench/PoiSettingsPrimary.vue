<script setup lang="ts">
const POI_SETTINGS_SECTIONS = [
  { id: 'dict', label: '数据字典', icon: '📚' },
  { id: 'password', label: '修改密码', icon: '🔑' },
  { id: 'login-methods', label: '登录方式', icon: '🔐' },
  { id: 'backup', label: '数据备份', icon: '💾' },
  { id: 'repair', label: '数据库修正', icon: '🔧' },
  { id: 'function-import', label: '功能导入', icon: '📋' },
] as const

defineProps<{
  activeSection: string
  onSelect: (sectionId: string) => void
}>()
</script>

<template>
  <nav class="poi-settings-primary" aria-label="设置分区">
    <button
      v-for="section in POI_SETTINGS_SECTIONS"
      :key="section.id"
      type="button"
      :class="{ 'is-active': activeSection === section.id }"
      @click="onSelect(section.id)"
    >
      <span aria-hidden="true">{{ section.icon }}</span>
      <span>{{ section.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.poi-settings-primary {
  display: grid;
  gap: 4px;
  padding: 10px;
}
.poi-settings-primary button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--pnw-workbench-text, #0f172a);
  text-align: left;
  cursor: pointer;
}
.poi-settings-primary button:hover {
  background: var(--pnw-workbench-hover-bg, #eff6ff);
}
.poi-settings-primary button.is-active {
  background: var(--pnw-workbench-active-bg, #dbeafe);
  color: var(--pnw-control-active-text, #2563eb);
  font-weight: 600;
}
</style>
