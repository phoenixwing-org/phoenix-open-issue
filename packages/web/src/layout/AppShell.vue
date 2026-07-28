<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import pkg from '../../package.json'
import {
  PnwAppModalOverlay,
  PnwAsyncProgressOverlay,
  PnwChoiceDialogHost,
  PnwPhoenixWingMark,
  PnwShellLogPanel,
  PnwWorkbenchShell,
  usePnwDocumentTitle,
} from 'phoenix-wing'
import WelcomeView from '@/views/WelcomeView.vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkbenchStore } from '@/stores/workbench'
import { useOpenIssueWorkbench } from '@/composables/useOpenIssueWorkbench'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const workbenchStore = useWorkbenchStore()
const openIssueWorkbenchController = useOpenIssueWorkbench()
const openIssueWorkbench = reactive(openIssueWorkbenchController)
const showWelcome = ref(false)
const logText = ref('')

usePnwDocumentTitle({
  workspaceShort: ref('Open Issue'),
  workspacePath: ref(''),
  pageLabel: openIssueWorkbenchController.pageLabel,
})

function logout() {
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <div class="open-issue-shell">
    <div class="open-issue-workbench">
      <PnwWorkbenchShell
        :nodes="openIssueWorkbench.navigation.nodes"
        :presentation="workbenchStore.presentation"
        :active-node-id="openIssueWorkbench.navigation.activeNodeId"
        :expanded-node-ids="workbenchStore.expandedNodeIds"
        :tree-collapsed="workbenchStore.treeCollapsed"
        :ribbon-appearance="workbenchStore.ribbonAppearance"
        :color-scheme="workbenchStore.colorScheme"
        :layout-state="workbenchStore.layoutState"
        :contributions="{ bottom: true }"
        :tabs="openIssueWorkbench.tabs.items"
        :active-tab-id="openIssueWorkbench.tabs.activeId"
        :can-close-all-tabs="openIssueWorkbench.tabs.items.length > 1"
        :show-ribbon-appearance-menu="true"
        brand-title="Open Issue List"
        brand-subtitle="Phoenix Wing / local 0.5.2"
        activity-aria-label="Open Issue 导航"
        tree-header-label="Open Issue 工具"
        @activate="openIssueWorkbench.actions.activateNode"
        @select-module="openIssueWorkbench.actions.selectModule"
        @select-tab="openIssueWorkbench.actions.selectTab"
        @close-tab="openIssueWorkbench.actions.closeTab"
        @close-all-tabs="openIssueWorkbench.actions.closeAllTabs"
        @update:expanded-node-ids="workbenchStore.expandedNodeIds = $event"
        @update:presentation="workbenchStore.presentation = $event"
        @update:tree-collapsed="workbenchStore.treeCollapsed = $event"
        @update:ribbon-appearance="workbenchStore.ribbonAppearance = $event"
        @update:layout-state="workbenchStore.layoutState = $event"
      >
        <template #brand>
          <button class="open-issue-brand" type="button" @click="showWelcome = true">
            <PnwPhoenixWingMark class="open-issue-brand-mark" decorative />
            <span>
              <strong>Open Issue List</strong>
              <small>PHOENIX WING / LOCAL 0.5.2</small>
            </span>
          </button>
        </template>

        <template #header-actions>
          <span v-if="auth.user" class="open-issue-user">
            {{ auth.user.displayName || auth.user.username }}
          </span>
          <el-button text size="small" type="danger" @click="logout">退出</el-button>
        </template>

        <div class="open-issue-editor" data-tour="shell-main">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <keep-alive :max="10">
                <component :is="Component" :key="route.fullPath" />
              </keep-alive>
            </transition>
          </router-view>
        </div>

        <template #bottom>
          <PnwShellLogPanel
            class="open-issue-bottom-log"
            :log-text="logText"
            empty-text="（暂无运行日志）"
            @clear="logText = ''"
            @close="workbenchStore.closeBottom()"
          />
        </template>

        <template #footer>
          <span class="open-issue-footer-page">【{{ openIssueWorkbench.pageLabel }}】</span>
          <span aria-hidden="true">·</span>
          <span>Open Issue List v{{ pkg.version }}</span>
        </template>
      </PnwWorkbenchShell>
    </div>
    <PnwChoiceDialogHost />
    <PnwAsyncProgressOverlay />
    <PnwAppModalOverlay
      :open="showWelcome"
      aria-label="欢迎"
      panel-class="welcome-modal"
      @close="showWelcome = false"
    >
      <WelcomeView @close="showWelcome = false" />
    </PnwAppModalOverlay>
  </div>
</template>

<style scoped>
.open-issue-shell {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.open-issue-workbench {
  flex: 1;
  min-height: 0;
}

.open-issue-editor {
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: 24px;
  box-sizing: border-box;
}

.open-issue-bottom-log {
  --border: var(--pnw-workbench-border, #dbe3ed);
  --muted: var(--pnw-workbench-muted, #64748b);
  --panel-head-bg: var(--pnw-workbench-bg, #f8fafc);
  --sidebar-bg: var(--pnw-workbench-surface, #fff);
  --text: var(--pnw-workbench-text, #0f172a);
  border-top: 0;
}

.open-issue-footer-page {
  color: var(--pnw-control-active-text, #409eff);
  font-weight: 600;
}

.open-issue-brand {
  min-width: 188px;
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 0 12px 0 8px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.open-issue-brand:hover {
  background: var(--pnw-workbench-hover-bg, rgba(59, 130, 246, 0.09));
}

.open-issue-brand-mark {
  --pnw-phoenix-wing-mark-size: 32px;
}

.open-issue-brand span {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.open-issue-brand strong,
.open-issue-brand small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-issue-brand strong { font-size: 13px; }
.open-issue-brand small { color: var(--pnw-workbench-muted, #64748b); font-size: 9px; letter-spacing: .06em; }
.open-issue-user { color: var(--pnw-workbench-muted, #64748b); font-size: 12px; white-space: nowrap; }

@container pnw-workbench (max-width: 700px) {
  .open-issue-brand { min-width: 38px; padding-right: 4px; }
  .open-issue-brand span { display: none; }
}
</style>
