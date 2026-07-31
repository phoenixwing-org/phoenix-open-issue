<script setup lang="ts">
defineProps<{
  issueNo: string
  title: string
  status: string
  priority: string
  severity: string
  canModify: boolean
  canPush: boolean
  has8d: boolean
  hasDescription: boolean
  onBack: () => void
  onEdit: () => void
  onPush: () => void
  onNavigateSection: (sectionId: string) => void
}>()
</script>

<template>
  <aside class="poi-issue-primary" aria-label="Issue 导航与操作">
    <header>
      <span>{{ issueNo || 'Issue' }}</span>
      <strong :title="title">{{ title || '正在加载…' }}</strong>
    </header>
    <dl>
      <div><dt>状态</dt><dd>{{ status || '—' }}</dd></div>
      <div><dt>优先级</dt><dd>{{ priority || '—' }}</dd></div>
      <div><dt>严重度</dt><dd>{{ severity || '—' }}</dd></div>
    </dl>
    <nav aria-label="Issue 章节">
      <span>章节</span>
      <button type="button" @click="onNavigateSection('issue-basic')">基本信息</button>
      <button type="button" @click="onNavigateSection('issue-people')">人员与日期</button>
      <button v-if="has8d" type="button" @click="onNavigateSection('issue-8d')">8D 报告</button>
      <button v-if="hasDescription" type="button" @click="onNavigateSection('issue-description')">问题描述</button>
    </nav>
    <section>
      <span>快速操作</span>
      <button v-if="canModify" type="button" class="is-accent" @click="onEdit">编辑 Issue</button>
      <button v-if="canPush" type="button" @click="onPush">推送到其他列表</button>
      <button type="button" @click="onBack">返回上一页</button>
    </section>
  </aside>
</template>

<style scoped>
.poi-issue-primary {
  display: grid;
  align-content: start;
  gap: 16px;
  padding: 14px;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #0f172a));
}
.poi-issue-primary header { display: grid; gap: 4px; min-width: 0; }
.poi-issue-primary header span,
.poi-issue-primary nav > span,
.poi-issue-primary section > span {
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  font-size: 12px;
}
.poi-issue-primary header strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.poi-issue-primary dl { display: grid; gap: 6px; margin: 0; }
.poi-issue-primary dl div { display: flex; justify-content: space-between; gap: 8px; }
.poi-issue-primary dt { color: var(--pnw-workbench-muted, #64748b); font-size: 12px; }
.poi-issue-primary dd { margin: 0; font-size: 12px; font-weight: 600; }
.poi-issue-primary nav,
.poi-issue-primary section { display: grid; gap: 5px; }
.poi-issue-primary button {
  padding: 7px 9px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}
.poi-issue-primary button:hover {
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, #eff6ff));
}
.poi-issue-primary button.is-accent {
  background: var(--pnw-workbench-active-bg, var(--el-color-primary-light-9, #dbeafe));
  color: var(--pnw-control-active-text, var(--el-color-primary, #2563eb));
  font-weight: 600;
}
</style>
