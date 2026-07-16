import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDictStore } from '@/stores/dict'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/oauth/callback',
      name: 'oauthCallback',
      component: () => import('@/views/OAuthCallbackView.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/',
      component: () => import('@/layout/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
        },
        {
          path: 'welcome',
          name: 'welcome',
          component: () => import('@/views/WelcomeView.vue'),
        },
        {
          path: 'dashboard',
          name: 'dashboard',
          component: () => import('@/views/DashboardView.vue'),
        },
        {
          path: 'lists',
          name: 'lists',
          component: () => import('@/views/lists/ListIndexView.vue'),
        },
        {
          path: 'list/:id',
          name: 'listDetail',
          component: () => import('@/views/lists/ListDetailView.vue'),
          props: true,
        },
        {
          path: 'issue/:id',
          name: 'issueDetail',
          component: () => import('@/views/issues/IssueDetailView.vue'),
          props: true,
        },
        {
          path: 'org',
          name: 'org',
          component: () => import('@/views/org/OrgTreeView.vue'),
        },
        {
          path: 'push-history',
          name: 'pushHistory',
          component: () => import('@/views/push/PushHistoryView.vue'),
        },
        {
          path: 'settings',
          name: 'settings',
          component: () => import('@/views/SettingsView.vue'),
        },
        {
          path: 'functions',
          name: 'functions',
          component: () => import('@/views/functions/FunctionIndexView.vue'),
        },
        {
          path: 'test-runner',
          name: 'testRunner',
          component: () => import('@/views/TestRunnerView.vue'),
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()
  if (to.meta.requiresAuth !== false && !auth.token) {
    next({ name: 'login', query: { redirect: to.fullPath } })
  } else if (to.name === 'login' && auth.token) {
    next({ name: 'dashboard' })
  } else {
    if (auth.token && to.meta.requiresAuth !== false) {
      useDictStore().ensureLoaded()
    }
    next()
  }
})

export default router
