import { describe, expect, it, vi } from 'vitest'
import type {
  LoginPolicyDependencies,
} from '../../packages/server/src/service/LoginPolicyService.js'

process.env.DB_DRIVER = 'postgres'
process.env.DATABASE_URL = 'postgresql://fixture.invalid/open_issue'
delete process.env.DB_PATH

const {
  LOGIN_EXTERNAL_FLAG,
  LOGIN_LOCAL_FLAG,
  LoginPolicyService,
} = await import('../../packages/server/src/service/LoginPolicyService.js')

function fixture(options: {
  externalConfigured?: boolean
  initial?: Record<string, string>
} = {}) {
  const flags = new Map(Object.entries(options.initial ?? {}))
  const assertAdmin = vi.fn(async (actorId: string) => {
    if (actorId !== 'admin-1') throw new Error('需要系统管理员权限')
  })
  const dependencies: LoginPolicyDependencies = {
    getFlag: async key => flags.get(key),
    setFlag: async (key, value) => { flags.set(key, value) },
    assertAdmin,
    isExternalConfigured: () => options.externalConfigured ?? false,
  }
  return {
    flags,
    assertAdmin,
    policy: new LoginPolicyService(dependencies),
  }
}

describe('登录方式策略', () => {
  it('缺少 flag 时默认允许两种方式，并独立报告提供方配置', async () => {
    const { policy } = fixture({ externalConfigured: true })

    await expect(policy.getPolicy()).resolves.toEqual({
      localEnabled: true,
      externalEnabled: true,
      externalConfigured: true,
    })
  })

  it('先校验管理员身份，未授权 actor 不修改任何 flag', async () => {
    const { policy, flags, assertAdmin } = fixture()

    await expect(policy.updatePolicy('viewer-1', {
      localEnabled: true,
      externalEnabled: false,
    })).rejects.toThrow('系统管理员')
    expect(assertAdmin).toHaveBeenCalledWith('viewer-1')
    expect(flags.size).toBe(0)
  })

  it('拒绝非法输入和同时关闭全部登录方式', async () => {
    const { policy, flags } = fixture()

    await expect(policy.updatePolicy('admin-1', {
      localEnabled: false,
      externalEnabled: false,
    })).rejects.toThrow('至少保留一种')
    await expect(policy.updatePolicy('admin-1', {
      localEnabled: 'yes',
      externalEnabled: true,
    } as any)).rejects.toThrow('必须为布尔值')
    expect(flags.size).toBe(0)
  })

  it('管理员可切换策略，禁用断言与持久 flag 保持一致', async () => {
    const { policy, flags } = fixture()

    await expect(policy.updatePolicy('admin-1', {
      localEnabled: false,
      externalEnabled: true,
    })).resolves.toMatchObject({ localEnabled: false, externalEnabled: true })
    await expect(policy.assertLocalLoginAllowed()).rejects.toThrow('本地账号登录')
    expect(flags.get(LOGIN_LOCAL_FLAG)).toBe('0')
    expect(flags.get(LOGIN_EXTERNAL_FLAG)).toBe('1')

    await expect(policy.updatePolicy('admin-1', {
      localEnabled: true,
      externalEnabled: false,
    })).resolves.toMatchObject({ localEnabled: true, externalEnabled: false })
    await expect(policy.assertExternalLoginAllowed()).rejects.toThrow('第三方登录')

    await policy.updatePolicy('admin-1', {
      localEnabled: true,
      externalEnabled: true,
    })
    await expect(policy.assertLocalLoginAllowed()).resolves.toBeUndefined()
  })
})
