<script setup lang="ts">
import { computed, ref } from "vue";
import { driver, type DriveStep } from "../runtime/driver.js.mjs";
import "../runtime/driver.css";
import { PAGE_HELP } from "/$/phoenix-open-issue/content/pageHelp";

const props = defineProps<{
  pageId: string;
}>();

const help = computed(() => PAGE_HELP[props.pageId]);
const popoverVisible = ref(false);

function isTourStepVisible(step: DriveStep): boolean {
  if (typeof step.element !== "string") return true;
  const target = document.querySelector(step.element);
  return Boolean(target && target.getClientRects().length > 0);
}

function runPageTour() {
  const content = help.value;
  if (!content?.tourSteps?.length) return;
  const visibleSteps = content.tourSteps.filter(isTourStepVisible);
  if (!visibleSteps.length) return;

  popoverVisible.value = false;
  window.setTimeout(() => {
    const d = driver({
      showProgress: true,
      progressText: "{{current}} / {{total}}",
      nextBtnText: "下一步",
      prevBtnText: "上一步",
      doneBtnText: "完成",
      steps: visibleSteps,
    });
    d.drive();
  }, 120);
}
</script>

<template>
  <el-popover
    v-if="help"
    v-model:visible="popoverVisible"
    placement="bottom-end"
    :width="320"
    trigger="click"
    :title="help.title"
    popper-class="page-help-popover"
  >
    <template #reference>
      <button
        type="button"
        class="help-btn"
        :title="`${help.title} 帮助`"
        aria-label="页面帮助"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.3"/>
          <path d="M6.2 6a1.8 1.8 0 1 1 3.6 0c0 1.2-1.8 1.8-1.8 2.8" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/>
          <circle cx="8" cy="11.5" r="0.75" fill="currentColor"/>
        </svg>
      </button>
    </template>
    <ul class="help-bullets">
      <li v-for="(b, i) in help.bullets" :key="i">{{ b }}</li>
    </ul>
    <div v-if="help.tourSteps?.length" class="help-tour-row">
      <el-button size="small" text type="primary" @click="runPageTour">
        本页导引
      </el-button>
    </div>
  </el-popover>
</template>

<style scoped>
.help-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  margin: 0;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--pnw-workbench-muted, var(--el-text-color-secondary, #64748b));
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}

.help-btn:hover {
  background: var(--pnw-workbench-hover-bg, var(--el-fill-color-light, rgba(148, 163, 184, 0.12)));
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #334155));
}

.help-bullets {
  margin: 0;
  padding: 0 0 0 16px;
  list-style: disc;
  font-size: 0.82rem;
  line-height: 1.6;
  color: var(--pnw-workbench-text, var(--el-text-color-primary, #334155));
}

.help-tour-row {
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--pnw-workbench-border, var(--el-border-color, #e2e8f0));
  text-align: right;
}
</style>
