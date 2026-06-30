import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

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
      path: '/',
      component: () => import('@/layout/AppShell.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          redirect: '/dashboard',
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
          path: 'lists/:id',
          name: 'listDetail',
          component: () => import('@/views/lists/ListDetailView.vue'),
          props: true,
        },
        {
          path: 'issues/:id',
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
    next()
  }
})

export default router
