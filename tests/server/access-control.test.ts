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
  db.run(`INSERT INTO issueLists (id, name, listType, ownerId) VALUES ('list-c', '列表 C', 'custom', ?)`, outsiderId)
  db.run(`INSERT INTO issueLists (id, name, listType, ownerId, archived) VALUES ('list-archived-access', '可访问归档列表', 'custom', ?, 1)`, adminId)
  db.run(`INSERT INTO issueLists (id, name, listType, ownerId, archived) VALUES ('list-archived-private', '无权归档列表', 'custom', ?, 1)`, adminId)
  db.run(`
    INSERT INTO issueLists (id, name, listType, ownerId, isDeleted, deletedAt)
    VALUES ('list-deleted', '已删除列表', 'custom', ?, 1, CURRENT_TIMESTAMP)
  `, adminId)
  for (const member of [
    ['member-a-admin', 'list-a', adminId, 'owner'],
    ['member-a-viewer', 'list-a', viewerId, 'editor'],
    ['member-b-admin', 'list-b', adminId, 'owner'],
    ['member-b-editor', 'list-b', editorId, 'editor'],
    ['member-c-owner', 'list-c', outsiderId, 'owner'],
    ['member-archived-access-admin', 'list-archived-access', adminId, 'owner'],
    ['member-archived-access-viewer', 'list-archived-access', viewerId, 'editor'],
    ['member-archived-private-admin', 'list-archived-private', adminId, 'owner'],
    ['member-archived-private-editor', 'list-archived-private', editorId, 'editor'],
    ['member-deleted-admin', 'list-deleted', adminId, 'owner'],
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
    `INSERT INTO issues (id, listId, issueNo, title, createdBy)
     VALUES ('issue-private-report', 'list-archived-private', 'ISS-2098-0002', '私有报告 Issue', ?)`,
    adminId,
  )
  db.run(
    `INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
     VALUES ('link-private-report', 'issue-private-report', 'list-archived-private', ?)`,
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
  it('列表全部视图按当前用户权限合并正常、归档和删除状态', async () => {
    const viewerActive = await request('/api/lists', viewerToken)
    expect(viewerActive.status).toBe(200)
    expect(viewerActive.body.map((list: { id: string }) => list.id)).toEqual(['list-a'])

    const viewerAll = await request('/api/lists?includeArchived=true', viewerToken)
    expect(viewerAll.status).toBe(200)
    expect(viewerAll.body.map((list: { id: string }) => list.id).sort()).toEqual([
      'list-a',
      'list-archived-access',
    ])
    expect(viewerAll.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'list-archived-private' }),
      expect.objectContaining({ id: 'list-deleted' }),
    ]))

    expect((await request('/api/lists/all?includeArchived=true&includeDeleted=true', viewerToken)).status).toBe(403)

    const adminAll = await request('/api/lists/all?includeArchived=true&includeDeleted=true', adminToken)
    expect(adminAll.status).toBe(200)
    expect(adminAll.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'list-a', archived: 0, isDeleted: 0 }),
      expect.objectContaining({ id: 'list-archived-access', archived: 1, isDeleted: 0 }),
      expect.objectContaining({ id: 'list-deleted', isDeleted: 1 }),
    ]))
  })

  it('归档列表可取消归档，系统查看用户不能执行该操作', async () => {
    expect((await request('/api/list/list-archived-access/archive', viewerToken, {
      method: 'PATCH', body: JSON.stringify({ archived: false }),
    })).status).toBe(403)

    const restored = await request('/api/list/list-archived-access/archive', adminToken, {
      method: 'PATCH', body: JSON.stringify({ archived: false }),
    })
    expect(restored.status).toBe(200)
    expect(restored.body.archived).toBe(0)

    const archivedAgain = await request('/api/list/list-archived-access/archive', adminToken, {
      method: 'PATCH', body: JSON.stringify({ archived: true }),
    })
    expect(archivedAgain.status).toBe(200)
    expect(archivedAgain.body.archived).toBe(1)
  })

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

  it('仪表盘待办中心按接收、发起和管理员审批权限聚合', async () => {
    db.run(
      `INSERT INTO issues (id, listId, issueNo, title, createdBy)
       VALUES ('issue-dashboard-task', 'list-b', 'ISS-2098-0099', '仪表盘待办 Issue', ?)`,
      editorId,
    )
    db.run(
      `INSERT INTO issueListLinks (id, issueId, listId, linkedBy)
       VALUES ('link-dashboard-task', 'issue-dashboard-task', 'list-b', ?)`,
      editorId,
    )
    db.run(
      `INSERT INTO pushRecords
         (id, fromListId, targetType, toListId, toUserId, issueId, pushedBy, status)
       VALUES
         ('push-dashboard-list', 'list-b', 'list', 'list-c', NULL, 'issue-dashboard-task', ?, 'pending'),
         ('push-dashboard-user', 'list-b', 'user', NULL, ?, 'issue-dashboard-task', ?, 'pending')`,
      [editorId, outsiderId, editorId],
    )
    db.run(
      `INSERT INTO externalBindRequests
         (id, provider, providerSubject, displayName, status)
       VALUES ('bind-dashboard-task', 'feishu', 'feishu-dashboard-task', '飞书待关联', 'pending')`,
    )
    const registered = await request('/api/auth/register', undefined, {
      method: 'POST',
      body: JSON.stringify({ username: 'pending-dashboard', password: '123456', displayName: '待审批用户' }),
    })
    expect(registered.status).toBe(201)

    const outsiderTasks = await request('/api/dashboard/tasks?tab=incoming&limit=5', outsiderToken)
    expect(outsiderTasks.status).toBe(200)
    expect(outsiderTasks.body.scope).toBe('incoming')
    expect(outsiderTasks.body.incomingPushes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'push-dashboard-list', _canHandle: true }),
      expect.objectContaining({ id: 'push-dashboard-user', _canHandle: true }),
    ]))
    expect(outsiderTasks.body.outgoingPushes).toEqual([])
    expect(outsiderTasks.body.pendingUsers).toEqual([])
    expect(outsiderTasks.body.externalBindRequests).toEqual([])

    const editorTasks = await request('/api/dashboard/tasks?tab=outgoing&limit=5', editorToken)
    expect(editorTasks.status).toBe(200)
    expect(editorTasks.body.scope).toBe('outgoing')
    expect(editorTasks.body.outgoingPushes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'push-dashboard-list', _canWithdraw: true }),
      expect.objectContaining({ id: 'push-dashboard-user', _canWithdraw: true }),
    ]))
    expect(editorTasks.body.incomingPushes).toEqual([])

    const viewerTasks = await request('/api/dashboard/tasks?tab=incoming&limit=5', viewerToken)
    expect(viewerTasks.status).toBe(200)
    expect(viewerTasks.body.incomingPushes).toEqual([])
    expect(viewerTasks.body.outgoingPushes).toEqual([])

    const adminTasks = await request('/api/dashboard/tasks?tab=admin&limit=5', adminToken)
    expect(adminTasks.status).toBe(200)
    expect(adminTasks.body.scope).toBe('admin')
    expect(adminTasks.body.pendingUsers).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: registered.body.user.id, username: 'pending-dashboard' }),
    ]))
    expect(adminTasks.body.externalBindRequests).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'bind-dashboard-task', provider: 'feishu' }),
    ]))
    expect(adminTasks.body.incomingPushes).toEqual([])
    const adminPersonalTasks = await request('/api/dashboard/tasks?tab=incoming&limit=5', adminToken)
    expect(adminPersonalTasks.body.incomingPushes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'push-dashboard-list' }),
    ]))
    expect(adminPersonalTasks.body.incomingPushes).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'push-dashboard-user' }),
    ]))
    expect(adminTasks.body.counts.admin).toBeGreaterThanOrEqual(2)

    const summary = await request('/api/dashboard/tasks?tab=summary', adminToken)
    expect(summary.status).toBe(200)
    expect(summary.body.scope).toBe('summary')
    expect(summary.body.incomingPushes).toEqual([])
    expect(summary.body.outgoingPushes).toEqual([])
    expect(summary.body.pendingUsers).toEqual([])
    expect(summary.body.externalBindRequests).toEqual([])
    expect((await request('/api/dashboard/tasks?tab=unknown', adminToken)).status).toBe(400)

    const approved = await request(`/api/user/${registered.body.user.id}/approve`, adminToken, {
      method: 'PATCH',
      body: JSON.stringify({ approved: true }),
    })
    expect(approved.status).toBe(200)
    const refreshed = await request('/api/dashboard/tasks?tab=admin&limit=5', adminToken)
    expect(refreshed.body.pendingUsers).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ id: registered.body.user.id }),
    ]))
  })

  it('目标列表 editor 不能审批推送，但接受关联后可以从当前列表继续转推', async () => {
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
    expect(targetIssues.body.items.find((item: { id: string }) => item.id === 'issue-access')).toEqual(expect.objectContaining({
      id: 'issue-access',
      _canModify: false,
      _canSetAttention: true,
      _canPush: true,
    }))

    const forwarded = await request('/api/push', editorToken, {
      method: 'POST',
      body: JSON.stringify({
        fromListId: 'list-b',
        targetType: 'user',
        toUserId: outsiderId,
        issueIds: ['issue-access'],
        note: '从小组继续推送到上级处理人',
      }),
    })
    expect(forwarded.status).toBe(201)
    expect(forwarded.body.records[0]).toEqual(expect.objectContaining({
      fromListId: 'list-b',
      issueId: 'issue-access',
      targetType: 'user',
      toUserId: outsiderId,
      status: 'pending',
    }))
  })

  it('可定向推送给用户，由指定接收人选择有管理权的列表且并发只接受一次', async () => {
    const pushed = await request('/api/push', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        fromListId: 'list-a',
        targetType: 'user',
        toUserId: outsiderId,
        issueIds: ['issue-access'],
        note: '请接收到合适的列表',
      }),
    })
    expect(pushed.status).toBe(201)
    expect(pushed.body.records[0]).toEqual(expect.objectContaining({
      targetType: 'user',
      toUserId: outsiderId,
      toListId: null,
      status: 'pending',
    }))
    const recordId = pushed.body.records[0].id

    const outsiderHistory = await request('/api/push/history', outsiderToken)
    expect(outsiderHistory.status).toBe(200)
    expect(outsiderHistory.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: recordId, toListName: null, _canHandle: true }),
    ]))

    expect((await request(`/api/push/${recordId}/target-lists`, editorToken)).status).toBe(403)
    const targets = await request(`/api/push/${recordId}/target-lists`, outsiderToken)
    expect(targets.status).toBe(200)
    expect(targets.body.map((list: { id: string }) => list.id)).toEqual(['list-c'])

    expect((await request(`/api/push/${recordId}/handle`, editorToken, {
      method: 'PATCH', body: JSON.stringify({ action: 'accepted', toListId: 'list-b' }),
    })).status).toBe(403)

    const results = await Promise.all([
      request(`/api/push/${recordId}/handle`, outsiderToken, {
        method: 'PATCH', body: JSON.stringify({ action: 'accepted', toListId: 'list-c' }),
      }),
      request(`/api/push/${recordId}/handle`, outsiderToken, {
        method: 'PATCH', body: JSON.stringify({ action: 'accepted', toListId: 'list-c' }),
      }),
    ])
    expect(results.map(result => result.status).sort()).toEqual([200, 403])
    expect((db.get(
      `SELECT COUNT(*) AS count FROM issueListLinks WHERE issueId = 'issue-access' AND listId = 'list-c'`,
    ) as { count: number }).count).toBe(1)
  })

  it('用户推送拒绝查看用户为接收人，并允许发起人在待处理时撤回', async () => {
    const invalid = await request('/api/push', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        fromListId: 'list-a', targetType: 'user', toUserId: viewerId, issueIds: ['issue-access'],
      }),
    })
    expect(invalid.status).toBe(400)

    const pushed = await request('/api/push', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        fromListId: 'list-a', targetType: 'user', toUserId: outsiderId, issueIds: ['issue-access'],
      }),
    })
    const recordId = pushed.body.records[0].id
    expect((await request(`/api/push/${recordId}/withdraw`, outsiderToken, { method: 'PATCH' })).status).toBe(403)
    const withdrawn = await request(`/api/push/${recordId}/withdraw`, adminToken, { method: 'PATCH' })
    expect(withdrawn.status).toBe(200)
    expect(withdrawn.body.status).toBe('withdrawn')
    expect((await request(`/api/push/${recordId}/withdraw`, adminToken, { method: 'PATCH' })).status).toBe(403)
  })

  it('8D 报告可独立存在或关联 Issue，且关联不绕过 Issue 权限', async () => {
    const linked = await request('/api/eight-d-report', adminToken, {
      method: 'POST',
      body: JSON.stringify({
        relatedIssueId: 'issue-access',
        title: '权限回归 8D',
        containment: '临时隔离',
        rootCause: '根因',
        correctiveAction: '永久措施',
      }),
    })
    expect(linked.status).toBe(201)
    expect(linked.body).toEqual(expect.objectContaining({
      relatedIssueId: 'issue-access',
      title: '权限回归 8D',
      _canModify: true,
    }))

    const viewerReports = await request('/api/issue/issue-access/eight-d-reports', viewerToken)
    expect(viewerReports.status).toBe(200)
    expect(viewerReports.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: linked.body.id, _canModify: false }),
    ]))
    // 前面的定向推送已让 outsider 合法获得 issue-access 的读取权限。
    expect((await request(`/api/eight-d-report/${linked.body.id}`, outsiderToken)).status).toBe(200)
    const privateLinked = await request('/api/eight-d-report', adminToken, {
      method: 'POST', body: JSON.stringify({ relatedIssueId: 'issue-private-report', title: '私有 8D' }),
    })
    expect(privateLinked.status).toBe(201)
    expect((await request(`/api/eight-d-report/${privateLinked.body.id}`, outsiderToken)).status).toBe(403)
    expect((await request('/api/eight-d-report', viewerToken, {
      method: 'POST', body: JSON.stringify({ title: '只读用户不应创建' }),
    })).status).toBe(403)

    const standalone = await request('/api/eight-d-report', outsiderToken, {
      method: 'POST', body: JSON.stringify({ title: '独立 8D', relatedIssueId: null }),
    })
    expect(standalone.status).toBe(201)
    expect(standalone.body.relatedIssueId).toBeNull()
    expect((await request(`/api/eight-d-report/${standalone.body.id}`, editorToken)).status).toBe(403)
    const updated = await request(`/api/eight-d-report/${standalone.body.id}`, outsiderToken, {
      method: 'PUT', body: JSON.stringify({ title: '独立 8D（已更新）', relatedIssueId: null }),
    })
    expect(updated.status).toBe(200)
    expect(updated.body.title).toBe('独立 8D（已更新）')
    expect((await request(`/api/eight-d-report/${standalone.body.id}`, outsiderToken, { method: 'DELETE' })).status).toBe(204)
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

  it('重要度和紧急度是低到高排列的内置字典且只能修改显示名', async () => {
    const { seedIssueDimensionDict } = await import('../../packages/server/src/seed.js')
    const { DictService } = await import('../../packages/server/src/service/DictService.js')
    await seedIssueDimensionDict()

    const importance = db.all(
      "SELECT id, value, label, enabled, tags FROM dict WHERE groupName = 'severity' ORDER BY sortOrder",
    ) as { id: string; value: string; label: string; enabled: number; tags: string }[]
    const urgency = db.all(
      "SELECT id, value, label, enabled, tags FROM dict WHERE groupName = 'priority' ORDER BY sortOrder",
    ) as { id: string; value: string; label: string; enabled: number; tags: string }[]

    expect(importance.map(item => item.value)).toEqual(['trivial', 'minor', 'major', 'fatal'])
    expect(urgency.map(item => item.value)).toEqual(['low', 'medium', 'high', 'critical'])
    expect([...importance, ...urgency].every(item => item.enabled === 1 && item.tags.includes(',core,'))).toBe(true)

    const service = new DictService()
    await expect(service.create('priority', 'rush', '火速')).rejects.toThrow('内置系统字段')
    await expect(service.update(urgency[0].id, { value: 'later' })).rejects.toThrow('只能修改显示名')
    await expect(service.update(urgency[0].id, { enabled: 0 })).rejects.toThrow('只能修改显示名')

    await service.update(urgency[0].id, { label: '稍后处理' })
    expect((db.get('SELECT label FROM dict WHERE id = ?', urgency[0].id) as { label: string }).label).toBe('稍后处理')
    await service.update(urgency[0].id, { label: '可延后' })
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
