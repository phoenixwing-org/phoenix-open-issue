import type { RouteRecordRaw } from 'vue-router'
import {
  POI_WORKBENCH_PRIMARY_POLICIES,
  type PoiWorkbenchRouteName,
} from '../layout/workbench/poiWorkbenchPrimaryPolicy'

function workbenchMeta(name: PoiWorkbenchRouteName) {
  return { workbenchPrimary: POI_WORKBENCH_PRIMARY_POLICIES[name] }
}

export const POI_AUTHENTICATED_WORKBENCH_ROUTES: RouteRecordRaw[] = [
  {
    path: 'welcome',
    name: 'welcome',
    component: () => import('@/views/WelcomeView.vue'),
    meta: workbenchMeta('welcome'),
  },
  {
    path: 'dashboard',
    name: 'dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: workbenchMeta('dashboard'),
  },
  {
    path: 'lists',
    name: 'lists',
    component: () => import('@/views/lists/ListIndexView.vue'),
    meta: workbenchMeta('lists'),
  },
  {
    path: 'list/:id',
    name: 'listDetail',
    component: () => import('@/views/lists/ListDetailView.vue'),
    props: true,
    meta: workbenchMeta('listDetail'),
  },
  {
    path: 'issue/:id',
    name: 'issueDetail',
    component: () => import('@/views/issues/IssueDetailView.vue'),
    props: true,
    meta: workbenchMeta('issueDetail'),
  },
  {
    path: 'org',
    name: 'org',
    component: () => import('@/views/org/OrgTreeView.vue'),
    meta: workbenchMeta('org'),
  },
  {
    path: 'push-history',
    name: 'pushHistory',
    component: () => import('@/views/push/PushHistoryView.vue'),
    meta: workbenchMeta('pushHistory'),
  },
  {
    path: 'reports/8d',
    name: 'eightDReports',
    component: () => import('@/views/reports/EightDReportIndexView.vue'),
    meta: workbenchMeta('eightDReports'),
  },
  {
    path: 'settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: workbenchMeta('settings'),
  },
  {
    path: 'functions',
    name: 'functions',
    component: () => import('@/views/functions/FunctionIndexView.vue'),
    meta: workbenchMeta('functions'),
  },
  {
    path: 'test-runner',
    name: 'testRunner',
    component: () => import('@/views/TestRunnerView.vue'),
    meta: workbenchMeta('testRunner'),
  },
]
