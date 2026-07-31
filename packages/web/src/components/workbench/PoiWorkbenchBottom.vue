<script setup lang="ts">
defineProps<{
  pageLabel: string
  wingVersion: string
}>()
</script>

<template>
  <section class="poi-workbench-bottom" aria-label="工作台消息">
    <span class="poi-workbench-bottom-icon" aria-hidden="true">✓</span>
    <div>
      <strong>暂无工作台输出</strong>
      <p>{{ pageLabel }} 当前没有需要显示的后台结果或消息。</p>
    </div>
    <small>Phoenix Wing {{ wingVersion }}</small>
  </section>
</template>

<style scoped>
.poi-workbench-bottom {
  min-height: 100%;
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  box-sizing: border-box;
  color: var(--pnw-workbench-text, #0f172a);
}

.poi-workbench-bottom-icon {
  width: 22px;
  height: 22px;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--pnw-control-active-text, #409eff) 14%, transparent);
  color: var(--pnw-control-active-text, #409eff);
  font-size: 12px;
  font-weight: 700;
}

.poi-workbench-bottom div {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.poi-workbench-bottom strong {
  font-size: 12px;
}

.poi-workbench-bottom p,
.poi-workbench-bottom small {
  margin: 0;
  color: var(--pnw-workbench-muted, #64748b);
  font-size: 11px;
  line-height: 1.5;
}

.poi-workbench-bottom small {
  margin-left: auto;
  white-space: nowrap;
}
</style>
