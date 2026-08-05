<script setup lang="ts">
defineProps<{
  title: string
  routeName: string
  onNavigate: (path: string) => void
}>()
</script>

<template>
  <nav class="poi-default-primary" aria-label="页面导航">
    <header>
      <span>当前 View</span>
      <strong>{{ title || routeName || '工作台页面' }}</strong>
    </header>
    <section>
      <span>快速导航</span>
      <button type="button" @click="onNavigate('/lists')">列表管理</button>
      <button type="button" @click="onNavigate('/org')">组织架构</button>
      <button type="button" @click="onNavigate('/functions')">功能表</button>
    </section>
  </nav>
</template>

<style scoped>
.poi-default-primary {
  display: grid;
  align-content: start;
  gap: 18px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-default-primary header,
.poi-default-primary section {
  display: grid;
  gap: 7px;
}
.poi-default-primary span {
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  font-size: 12px;
}
.poi-default-primary button {
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-default-primary button:hover {
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff));
}
</style>
