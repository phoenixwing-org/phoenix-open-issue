import { describe, expect, it } from 'vitest'
import {
  validateHostOwnedSettingsBoundary,
} from '../../../../scripts/lib/admin-plugin-settings-boundary.mjs'

const baseManifest = {
  hostReuse: ['identity', 'users', 'departments', 'roles'],
  routes: [{ path: '/open-issue/maintenance', title: '维护', viewPath: 'modules/phoenix-open-issue/views/maintenance.vue' }],
  capabilities: [{
    id: 'phoenix-open-issue:maintenance:read',
    endpoints: [{ method: 'GET', path: '/admin/phoenix-open-issue/maintenance/repair-tasks' }],
  }],
}

describe('Admin plugin Host-owned settings boundary', () => {
  it('accepts read-only Host user adapters and declared idempotent Issue repairs', () => {
    expect(validateHostOwnedSettingsBoundary({
      manifest: baseManifest,
      repairTasks: ['checkpoints', 'links', 'list-org-references'],
      sources: {
        'vue/phoenix-open-issue/api/auth.ts': 'service.base.sys.user.list({ status: 1 })',
        'vue/phoenix-open-issue/components/UserSelector.vue': "base:sys:user:list; getAllUsers()",
        'midway/phoenix-open-issue/service/host-user.ts': 'SELECT id FROM base_sys_user WHERE id = $1',
        'midway/phoenix-open-issue/domain/issue-list.ts': 'orgUnitId: string; targetType: user',
      },
    })).toEqual([])
  })

  it('fails closed for copied account surfaces, permission bypasses and Host table mutation', () => {
    const errors = validateHostOwnedSettingsBoundary({
      manifest: {
        hostReuse: ['identity'],
        routes: [{ path: '/open-issue/password', title: '修改密码', viewPath: 'modules/phoenix-open-issue/views/settings.vue' }],
        capabilities: [{ endpoints: [{ method: 'POST', path: '/admin/phoenix-open-issue/users/reset-password' }] }],
      },
      repairTasks: ['checkpoints', 'users'],
      sources: {
        'vue/phoenix-open-issue/views/login.vue': 'interface LoginInput { password: string }',
        'vue/phoenix-open-issue/components/UserSelector.vue': 'getAllUsers()',
        'vue/phoenix-open-issue/views/Bypass.vue': 'service.base.sys.user.list({})',
        'midway/phoenix-open-issue/service/host-user.ts': 'UPDATE base_sys_user SET status = 0',
        'midway/phoenix-open-issue/service/other.ts': 'SELECT * FROM base_sys_user',
      },
    })

    expect(errors).toEqual(expect.arrayContaining([
      expect.stringContaining('hostReuse'),
      expect.stringContaining('路由'),
      expect.stringContaining('endpoint'),
      expect.stringContaining('maintenance task'),
      expect.stringContaining('legacy Host 设置文件'),
      expect.stringContaining('legacy login input'),
      expect.stringContaining('base:sys:user:list'),
      expect.stringContaining('集中 Host adapter'),
      expect.stringContaining('不得修改 base_sys_user'),
      expect.stringContaining('集中后端 adapter'),
    ]))
  })

  it('rejects unused legacy password, external-auth, organization and system-role types', () => {
    const errors = validateHostOwnedSettingsBoundary({
      manifest: baseManifest,
      repairTasks: ['checkpoints', 'links', 'list-org-references'],
      sources: {
        'vue/phoenix-open-issue/core/types/user.ts': 'passwordHash: string; type ChangePasswordInput = {}; systemRole: string',
        'vue/phoenix-open-issue/core/types/external-auth.ts': 'interface LoginPolicy {}',
        'vue/phoenix-open-issue/core/types/org-unit.ts': 'interface OrgUnit {}',
      },
    })

    expect(errors.length).toBeGreaterThanOrEqual(7)
  })
})
