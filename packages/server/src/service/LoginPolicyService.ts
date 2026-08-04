import { getSystemFlag, setSystemFlag } from '../seed.js'
import { assertSystemAdminAsync } from '../utils/admin.js'
import { BadRequestError, ForbiddenError } from '../utils/errors.js'
import { getAsyncDb } from '../db/connection.js'
import { config } from '../config.js'

export const LOGIN_LOCAL_FLAG = 'auth.localLoginEnabled'
export const LOGIN_EXTERNAL_FLAG = 'auth.externalLoginEnabled'

export interface LoginPolicy {
  /** 是否允许本地账号密码登录/注册 */
  localEnabled: boolean
  /** 是否允许第三方登录（还需服务端已配置提供方） */
  externalEnabled: boolean
  /** 环境是否已配置至少一个第三方提供方 */
  externalConfigured: boolean
}

export interface LoginPolicyDependencies {
  getFlag(key: string): Promise<string | undefined>
  setFlag(key: string, value: string): Promise<void>
  assertAdmin(actorId: string): Promise<void>
  isExternalConfigured(): boolean
}

function flagEnabled(value: string | undefined, defaultEnabled = true): boolean {
  if (value === undefined || value === '') return defaultEnabled
  return value === '1' || value.toLowerCase() === 'true' || value === 'yes'
}

export class LoginPolicyService {
  constructor(private readonly dependencies: LoginPolicyDependencies = defaultDependencies()) {}

  async getPolicy(): Promise<LoginPolicy> {
    const [localRaw, externalRaw] = await Promise.all([
      this.dependencies.getFlag(LOGIN_LOCAL_FLAG),
      this.dependencies.getFlag(LOGIN_EXTERNAL_FLAG),
    ])
    return {
      localEnabled: flagEnabled(localRaw, true),
      externalEnabled: flagEnabled(externalRaw, true),
      externalConfigured: this.dependencies.isExternalConfigured(),
    }
  }

  async updatePolicy(
    actorId: string,
    input: { localEnabled: boolean; externalEnabled: boolean },
  ): Promise<LoginPolicy> {
    await this.dependencies.assertAdmin(actorId)
    if (typeof input.localEnabled !== 'boolean' || typeof input.externalEnabled !== 'boolean') {
      throw new BadRequestError('localEnabled 与 externalEnabled 必须为布尔值')
    }
    if (!input.localEnabled && !input.externalEnabled) {
      throw new BadRequestError('至少保留一种登录方式')
    }
    await this.dependencies.setFlag(LOGIN_LOCAL_FLAG, input.localEnabled ? '1' : '0')
    await this.dependencies.setFlag(LOGIN_EXTERNAL_FLAG, input.externalEnabled ? '1' : '0')
    console.info(
      `🔐 [LOGIN_POLICY] local=${input.localEnabled} external=${input.externalEnabled} actor=${actorId}`,
    )
    return this.getPolicy()
  }

  async assertLocalLoginAllowed(): Promise<void> {
    const policy = await this.getPolicy()
    if (!policy.localEnabled) throw new ForbiddenError('管理员已关闭本地账号登录')
  }

  async assertExternalLoginAllowed(): Promise<void> {
    const policy = await this.getPolicy()
    if (!policy.externalEnabled) throw new ForbiddenError('管理员已关闭第三方登录')
  }
}

function defaultDependencies(): LoginPolicyDependencies {
  return {
    getFlag: getSystemFlag,
    setFlag: setSystemFlag,
    assertAdmin: actorId => assertSystemAdminAsync(getAsyncDb(), actorId),
    isExternalConfigured: () => config.externalAuth.enabled,
  }
}
