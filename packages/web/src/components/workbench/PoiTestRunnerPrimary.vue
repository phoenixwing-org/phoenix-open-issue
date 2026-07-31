<script setup lang="ts">
defineProps<{
  isAdmin: boolean
  available: boolean
  running: boolean
  fileCount: number
  totalCases: number
  hasResult: boolean
  onRunAll: () => void
  onNavigateSection: (sectionId: string) => void
}>()
</script>

<template>
  <aside class="poi-test-primary" aria-label="单元测试导航与操作">
    <header>
      <strong>测试概况</strong>
      <span>{{ fileCount }} 个文件 · {{ totalCases }} 条用例</span>
    </header>
    <el-alert
      v-if="!isAdmin"
      title="仅系统管理员可运行"
      type="warning"
      :closable="false"
      show-icon
    />
    <el-alert
      v-else-if="!available"
      title="当前环境未提供 Vitest"
      type="info"
      :closable="false"
      show-icon
    />
    <el-button
      v-if="isAdmin"
      size="small"
      type="primary"
      :loading="running"
      :disabled="!available || running"
      @click="onRunAll"
    >全部运行</el-button>
    <nav aria-label="测试页章节">
      <button type="button" @click="onNavigateSection('test-files')">测试文件</button>
      <button v-if="hasResult" type="button" @click="onNavigateSection('test-result')">最近结果</button>
    </nav>
  </aside>
</template>

<style scoped>
.poi-test-primary {
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-test-primary header { display: grid; gap: 4px; }
.poi-test-primary header strong { font-size: 12px; }
.poi-test-primary header span { color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b)); font-size: 12px; }
.poi-test-primary nav { display: grid; gap: 5px; }
.poi-test-primary nav button {
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-test-primary nav button:hover { background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff)); }
</style>
