<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { SwitchButton, UserFilled } from '@element-plus/icons-vue'
import pkg from '../../package.json'
import {
  PnwAppModalOverlay,
  PnwAsyncProgressOverlay,
  PnwChoiceDialogHost,
  PnwPhoenixWingMark,
  PnwWorkbenchShell,
  PNW_VERSION,
  pnwResolveViewBlockComponentProps,
  type PnwBottomPanelTab,
  type PnwViewBlockContributions,
  usePnwDocumentTitle,
} from 'phoenix-wing'
import WelcomeView from '@/views/WelcomeView.vue'
import PoiWorkbenchBottom from '@/components/workbench/PoiWorkbenchBottom.vue'
import { useAuthStore } from '@/stores/auth'
import { useWorkbenchStore } from '@/stores/workbench'
import { useOpenIssueWorkbench } from '@/composables/useOpenIssueWorkbench'
import {
  createPoiViewContributionRegistry,
  providePoiViewContributionRegistry,
  usePoiRegisteredViewContribution,
} from '@/layout/workbench/poiViewContributions'
import { usePoiColorScheme } from '@/layout/workbench/usePoiColorScheme'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const workbenchStore = useWorkbenchStore()
usePoiColorScheme(() => workbenchStore.colorScheme)
const poiViewContributionRegistry = createPoiViewContributionRegistry()
providePoiViewContributionRegistry(poiViewContributionRegistry)
const openIssueWorkbenchController = useOpenIssueWorkbench()
const openIssueWorkbench = reactive(openIssueWorkbenchController)
const showWelcome = ref(false)
const wingSource = import.meta.env.VITE_PHOENIX_WING_SOURCE === 'LOCAL' ? 'LOCAL' : 'REGISTRY'
const wingBrandSubtitle = `Phoenix Wing / ${wingSource} ${PNW_VERSION}`
const workbenchContributions: PnwViewBlockContributions = { bottom: true }
const WORKBENCH_BOTTOM_TABS = [
  {
    id: 'workbench-messages',
    label: '工作台消息',
  },
] satisfies readonly PnwBottomPanelTab[]
const activeViewId = computed(() =>
  openIssueWorkbenchController.tabs.empty.value ? null : route.fullPath,
)
const viewBlocks = usePoiRegisteredViewContribution(
  poiViewContributionRegistry,
  activeViewId,
  () => route.name,
  () => ({
    title: openIssueWorkbenchController.pageLabel.value,
    routeName: String(route.name || ''),
    onNavigate: (path: string) => router.push(path),
  }),
)

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
        :tree-appearance="workbenchStore.treeAppearance"
        :tab-bar-placement="workbenchStore.tabBarPlacement"
        :color-scheme="workbenchStore.colorScheme"
        :layout-state="workbenchStore.layoutState"
        :display-settings-positions="workbenchStore.settingsPositions"
        :contributions="workbenchContributions"
        :view-blocks="viewBlocks"
        :bottom-tabs="WORKBENCH_BOTTOM_TABS"
        :tabs="openIssueWorkbench.tabs.items"
        :active-tab-id="openIssueWorkbench.tabs.activeId"
        :show-empty-view="openIssueWorkbench.tabs.empty"
        :can-close-all-tabs="openIssueWorkbench.tabs.items.length > 1"
        :show-ribbon-appearance-menu="true"
        brand-title="Open Issue List"
        :brand-subtitle="wingBrandSubtitle"
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
        @update:tree-appearance="workbenchStore.treeAppearance = $event"
        @update:tab-bar-placement="workbenchStore.tabBarPlacement = $event"
        @update:color-scheme="workbenchStore.colorScheme = $event"
        @update:layout-state="workbenchStore.layoutState = $event"
        @update:display-settings-positions="workbenchStore.settingsPositions = $event"
      >
        <template #brand>
          <button class="open-issue-brand" type="button" @click="showWelcome = true">
            <PnwPhoenixWingMark class="open-issue-brand-mark" decorative />
            <span>
              <strong>Open Issue List</strong>
              <small>{{ wingBrandSubtitle }}</small>
            </span>
          </button>
        </template>

        <template #header-actions>
          <div v-if="auth.user" class="open-issue-account">
            <span class="open-issue-user-avatar" aria-hidden="true">
              <UserFilled />
            </span>
            <span
              class="open-issue-user"
              :title="auth.user.displayName || auth.user.username"
            >
              {{ auth.user.displayName || auth.user.username }}
            </span>
          </div>
          <el-tooltip content="退出登录" placement="bottom">
            <button
              class="open-issue-logout"
              type="button"
              aria-label="退出登录"
              @click="logout"
            >
              <SwitchButton aria-hidden="true" />
            </button>
          </el-tooltip>
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
          <component
            v-if="viewBlocks.bottom"
            :is="viewBlocks.bottom.component"
            v-bind="pnwResolveViewBlockComponentProps(viewBlocks.bottom)"
          />
          <PoiWorkbenchBottom
            v-else
            :page-label="openIssueWorkbench.pageLabel"
            :wing-version="PNW_VERSION"
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
  --poi-editor-padding: 24px;
  width: 100%;
  height: 100%;
  overflow: auto;
  padding: var(--poi-editor-padding);
  box-sizing: border-box;
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

.open-issue-account {
  height: 100%;
  max-width: 154px;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 10px;
  box-sizing: border-box;
  color: var(--pnw-workbench-text, #0f172a);
}

.open-issue-user-avatar {
  width: 24px;
  height: 24px;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: color-mix(in srgb, var(--pnw-control-active-text, #409eff) 13%, transparent);
  color: var(--pnw-control-active-text, #409eff);
}

.open-issue-user-avatar svg {
  width: 14px;
  height: 14px;
}

.open-issue-user {
  min-width: 0;
  overflow: hidden;
  color: var(--pnw-workbench-text, #0f172a);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.open-issue-logout {
  width: 38px;
  height: 100%;
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  border-left: 1px solid var(--pnw-header-divider, var(--pnw-workbench-border, #dbe3ed));
  background: transparent;
  color: var(--pnw-workbench-muted, #64748b);
  cursor: pointer;
}

.open-issue-logout svg {
  width: 17px;
  height: 17px;
}

.open-issue-logout:hover,
.open-issue-logout:focus-visible {
  outline: none;
  background: color-mix(in srgb, var(--el-color-danger, #f56c6c) 10%, transparent);
  color: var(--el-color-danger, #f56c6c);
}

.open-issue-logout:focus-visible {
  box-shadow: inset 0 0 0 2px var(--pnw-focus-ring, #409eff);
}

@container pnw-workbench (max-width: 700px) {
  .open-issue-brand { min-width: 38px; padding-right: 4px; }
  .open-issue-brand span { display: none; }
  .open-issue-account { max-width: 112px; padding: 0 7px; }
}
</style>
