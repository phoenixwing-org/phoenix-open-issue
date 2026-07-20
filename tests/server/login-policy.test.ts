import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

let tempDir: string
let closeAsyncDb: () => Promise<void>
let policy: import('../../packages/server/src/service/LoginPolicyService.js').LoginPolicyService
let adminId: string

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-login-policy-'))
  process.env.DB_DRIVER = 'sqlite'
  process.env.DB_PATH = path.join(tempDir, 'policy.sqlite')
  process.env.SERVE_STATIC = 'false'
  process.env.NODE_ENV = 'test'

  const connection = await import('../../packages/server/src/db/connection.js')
  closeAsyncDb = connection.closeAsyncDb
  await connection.initializeDb()
  const db = connection.getDb()
  adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id

  const { LoginPolicyService } = await import('../../packages/server/src/service/LoginPolicyService.js')
  policy = new LoginPolicyService()
})

afterAll(async () => {
  await closeAsyncDb?.()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe.sequential('登录方式策略', () => {
  it('默认本地与第三方均允许', async () => {
    const p = await policy.getPolicy()
    expect(p.localEnabled).toBe(true)
    expect(p.externalEnabled).toBe(true)
  })

  it('管理员可开关且禁止全部关闭', async () => {
    await expect(policy.updatePolicy(adminId, { localEnabled: false, externalEnabled: false }))
      .rejects.toThrow('至少保留一种')

    const onlyExternal = await policy.updatePolicy(adminId, { localEnabled: false, externalEnabled: true })
    expect(onlyExternal).toMatchObject({ localEnabled: false, externalEnabled: true })
    await expect(policy.assertLocalLoginAllowed()).rejects.toThrow('本地账号登录')

    const onlyLocal = await policy.updatePolicy(adminId, { localEnabled: true, externalEnabled: false })
    expect(onlyLocal).toMatchObject({ localEnabled: true, externalEnabled: false })
    await expect(policy.assertExternalLoginAllowed()).rejects.toThrow('第三方登录')

    await policy.updatePolicy(adminId, { localEnabled: true, externalEnabled: true })
    await expect(policy.assertLocalLoginAllowed()).resolves.toBeUndefined()
  })
})
