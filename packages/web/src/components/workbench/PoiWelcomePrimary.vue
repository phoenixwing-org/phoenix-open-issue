<script setup lang="ts">
defineProps<{
  onNavigate: (path: string) => void
  onStartTour: () => void
}>()
</script>

<template>
  <nav class="poi-welcome-primary" aria-label="欢迎页导航">
    <section>
      <span>开始使用</span>
      <button type="button" class="is-accent" @click="onNavigate('/dashboard')">打开仪表盘</button>
      <button type="button" @click="onNavigate('/lists')">管理 Issue 列表</button>
      <button type="button" @click="onNavigate('/org')">查看组织架构</button>
    </section>
    <section>
      <span>了解工作台</span>
      <button type="button" @click="onStartTour">启动界面巡游</button>
    </section>
  </nav>
</template>

<style scoped>
.poi-welcome-primary {
  display: grid;
  align-content: start;
  gap: 20px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-welcome-primary section { display: grid; gap: 7px; }
.poi-welcome-primary span {
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  font-size: 12px;
  font-weight: 600;
}
.poi-welcome-primary button {
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-welcome-primary button:hover {
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff));
}
.poi-welcome-primary button.is-accent {
  background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9, #dbeafe));
  color: var(--pnw-control-active-text, var(--el-color-primary, #2563eb));
  font-weight: 600;
}
</style>
