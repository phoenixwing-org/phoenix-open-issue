import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { IncomingMessage, ServerResponse } from 'node:http'
import { Duplex } from 'node:stream'

let tempDir: string
let app: any
let db: import('../../packages/server/src/db/pnwDbAdapter.js').PnwDbAdapter
let closeAsyncDb: () => Promise<void>
let adminId: string
let viewerId: string
let editorId: string
let outsiderId: string
let adminToken: string
let viewerToken: string
let editorToken: string
let outsiderToken: string

async function request(pathname: string, token?: string, init: RequestInit = {}) {
  const bodyText = init.body ? String(init.body) : ''
  const responseBody: Buffer[] = []
  const socket = new Duplex({
    read() {},
    write(_chunk, _encoding, callback) { callback() },
  })
  Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' })

  const req = new IncomingMessage(socket as any)
  req.method = init.method || 'GET'
  req.url = pathname
  const headers: Record<string, string> = {}
  if (token) headers.authorization = `Bearer ${token}`
  if (bodyText) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(Buffer.byteLength(bodyText))
  }
  req.headers = headers
  req.rawHeaders = Object.entries(headers).flatMap(([key, value]) => [key, value])

  const res = new ServerResponse(req)
  const finished = new Promise<void>((resolve) => {
    ;(res as any).write = (chunk: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) => {
      if (chunk !== undefined && chunk !== null) {
        responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : undefined))
      }
      if (typeof encoding === 'function') encoding()
      callback?.()
      return true
    }
    ;(res as any).end = (chunk?: unknown, encoding?: BufferEncoding | (() => void), callback?: () => void) => {
      if (chunk !== undefined && chunk !== null) {
        responseBody.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), typeof encoding === 'string' ? encoding : undefined))
      }
      if (typeof encoding === 'function') encoding()
      callback?.()
      resolve()
      return res
    }
  })
  app(req, res)
  if (bodyText) req.push(Buffer.from(bodyText))
  req.push(null)
  await finished

  const payload = Buffer.concat(responseBody).toString()
  return { status: res.statusCode, body: payload ? JSON.parse(payload) : undefined }
}

async function login(username: string): Promise<string> {
  const { status, body } = await request('/api/auth/login', undefined, {
    method: 'POST',
    body: JSON.stringify({ username, password: '123456' }),
  })
  expect(status).toBe(200)
  return body.token
}

beforeAll(async () => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'open-issue-access-test-'))
  process.env.DB_DRIVER = 'sqlite'
  process.env.DB_PATH = path.join(tempDir, 'access.sqlite')
  process.env.SERVE_STATIC = 'false'
  process.env.NODE_ENV = 'test'

  const connection = await import('../../packages/server/src/db/connection.js')
  closeAsyncDb = connection.closeAsyncDb
  await connection.initializeDb()
  db = connection.getDb()
  adminId = (db.get("SELECT id FROM users WHERE username = 'admin'") as { id: string }).id

  const { AuthService } = await import('../../packages/server/src/service/AuthService.js')
  const authService = new AuthService()
  viewerId = (await authService.register({ username: 'viewer', password: '123456' })).user.id
  editorId = (await authService.register({ username: 'editor', password: '123456' })).user.id
  outsiderId = (await authService.register({ username: 'outsider', password: '123456' })).user.id
  db.run("UPDATE users SET approved = 1, systemRole = 'viewer' WHERE id = ?", viewerId)
  db.run("UPDATE users SET approved = 1, systemRole = 'editor' WHERE id IN (?, ?)", [editorId, outsiderId])

  db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-a', '列表 A', 'custom', ?)`, adminId)
  db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-b', '列表 B', 'custom', ?)`, adminId)
  for (const member of [
    ['member-a-admin', 'list-a', adminId, 'owner'],
    ['member-a-viewer', 'list-a', viewerId, 'editor'],
    ['member-b-admin', 'list-b', adminId, 'owner'],
    ['member-b-editor', 'list-b', editorId, 'editor'],
  ]) {
    db.run('INSERT INTO issueListMembers (id, listId, userId, role) VALUES (?, ?, ?, ?)', member)
  }
  db.run(
    `INSERT INTO issues (id, listId, issueNo, title, createdBy)
     VALUES ('issue-access', 'list-a', 'ISS-2098-0001', '权限测试 Issue', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
     VALUES ('link-access', 'issue-access', 'list-a', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO checkpoints (id, issueId, checkpointDate, description)
     VALUES ('checkpoint-access', 'issue-access', '2098-01-01', '权限测试点检')`,
  )
  db.run(
    `INSERT INTO pushRecords (id, fromListId, toListId, issueId, pushedBy)
     VALUES ('push-access', 'list-a', 'list-b', 'issue-access', ?)`,
    adminId,
  )

  const { createApp } = await import('../../packages/server/src/app.js')
  app = createApp()

  ;[adminToken, viewerToken, editorToken, outsiderToken] = await Promise.all([
    login('admin'), login('viewer'), login('editor'), login('outsider'),
  ])
})

afterAll(async () => {
  await closeAsyncDb?.()
  fs.rmSync(tempDir, { recursive: true, force: true })
})

describe.sequential('HTTP 权限与认证回归', () => {
  it('systemRole=viewer 即使是列表 editor 也只能查看', async () => {
    expect((await request('/api/list/list-a', viewerToken)).status).toBe(200)
    expect((await request('/api/list/list-a/issues', viewerToken)).status).toBe(200)
    expect((await request('/api/issue/issue-access', viewerToken)).status).toBe(200)
    expect((await request('/api/issue/issue-access/checkpoints', viewerToken)).status).toBe(200)

    expect((await request('/api/list/list-a/issue', viewerToken, {
      method: 'POST', body: JSON.stringify({ title: '不应创建' }),
    })).status).toBe(403)
    expect((await request('/api/list/list-a', viewerToken, {
      method: 'PUT', body: JSON.stringify({ name: '不应修改' }),
    })).status).toBe(403)
    expect((await request('/api/dict', viewerToken, {
      method: 'POST', body: JSON.stringify({ groupName: 'x', value: 'x', label: 'x' }),
    })).status).toBe(403)
  })

  it('非列表成员不能通过 ID 读取列表、Issue 或点检', async () => {
    expect((await request('/api/list/list-a', outsiderToken)).status).toBe(403)
    expect((await request('/api/list/list-a/issues', outsiderToken)).status).toBe(403)
    expect((await request('/api/issue/issue-access', outsiderToken)).status).toBe(403)
    expect((await request('/api/issue/issue-access/checkpoints', outsiderToken)).status).toBe(403)
    expect((await request('/api/list/list-a/push-history', outsiderToken)).status).toBe(403)
  })

  it('目标列表 editor 不能审批推送，重复审批只有一次成功', async () => {
    expect((await request('/api/push/push-access/handle', editorToken, {
      method: 'PATCH', body: JSON.stringify({ action: 'accepted' }),
    })).status).toBe(403)

    const results = await Promise.all([
      request('/api/push/push-access/handle', adminToken, {
        method: 'PATCH', body: JSON.stringify({ action: 'accepted' }),
      }),
      request('/api/push/push-access/handle', adminToken, {
        method: 'PATCH', body: JSON.stringify({ action: 'accepted' }),
      }),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 403])
    expect((db.get(
      `SELECT COUNT(*) AS count FROM issueListLinks WHERE issueId = 'issue-access' AND listId = 'list-b'`,
    ) as { count: number }).count).toBe(1)

    const targetIssues = await request('/api/list/list-b/issues', editorToken)
    expect(targetIssues.status).toBe(200)
    expect(targetIssues.body.items[0]).toEqual(expect.objectContaining({
      id: 'issue-access',
      _canModify: false,
      _canSetAttention: true,
      _canPush: false,
    }))
  })

  it('越权变更负责人时不会先保存同请求中的其他列表字段', async () => {
    const result = await request('/api/list/list-b', editorToken, {
      method: 'PUT',
      body: JSON.stringify({ name: '不应部分保存', ownerId: viewerId }),
    })
    expect(result.status).toBe(403)
    expect((db.get("SELECT name FROM issueLists WHERE id = 'list-b'") as { name: string }).name).toBe('列表 B')
  })

  it('启动基础种子不再自动批准待审批用户', async () => {
    const { AuthService } = await import('../../packages/server/src/service/AuthService.js')
    const pendingUser = await new AuthService().register({ username: 'pending', password: '123456' })
    const { seedEssential } = await import('../../packages/server/src/seed.js')
    await seedEssential()
    const pending = db.get('SELECT approved FROM users WHERE id = ?', pendingUser.user.id) as { approved: number }
    expect(pending.approved).toBe(0)
  })

  it('禁用账号后已签发令牌立即失效', async () => {
    expect((await request('/api/auth/me', outsiderToken)).status).toBe(200)
    db.run(
      'UPDATE users SET disabled = 1, tokenVersion = tokenVersion + 1 WHERE id = ?',
      outsiderId,
    )
    expect((await request('/api/auth/me', outsiderToken)).status).toBe(401)
  })
})
