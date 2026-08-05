import type { ModuleConfig } from '/@/cool'

/**
 * COOL 前端模块入口。
 *
 * 业务菜单和动态路由由 Pah manifest 管理；这里仅声明模块加载顺序，避免形成第二份路由源。
 */
export default (): ModuleConfig => ({
  order: 80,
  views: [
    {
      path: '/open-issue',
      redirect: '/open-issue/lists',
    },
  ],
})
