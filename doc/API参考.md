# API 参考

Base URL: `http://localhost:3400/api`

认证：`Authorization: Bearer <token>`（除 `[public]` 外均需）

权限：`systemRole=admin` 可跨列表管理；`systemRole=viewer` 为全局只读；`systemRole=editor` 再按列表角色授权。非成员不能通过资源 ID 读取列表、Issue、点检或推送记录。详细矩阵见 [多人权限与列表筛选加固.md](./多人权限与列表筛选加固.md)。

> 路径规则：**返回集合用复数，单条操作用单数**（如 `GET /lists` vs `GET /list/:id`）

---

## Auth

### POST /auth/register `[public]`
```json
// Request
{ "username": "alice", "password": "123456", "displayName": "Alice" }
// Response 201（注册后待管理员审批，不能直接登录）
{ "token": null, "user": { ... }, "pending": true }
```

### POST /auth/login `[public]`
```json
// Request  { "username": "admin", "password": "123456" }
// Response 200  { "token": "eyJ...", "user": { ... } }
```

### GET /auth/me
### PATCH /auth/change-password — `{ "oldPassword": "...", "newPassword": "..." }`

---

## User

### GET /users — 所有用户
### GET /users/pending — 待审批（系统管理员）

以下用户管理写操作均需系统管理员：

### PATCH /user/:userId/approve
### PATCH /user/:userId/org — `{ "orgUnitId": "uuid" }`
### PATCH /user/:userId — 更新信息
### PATCH /user/:userId/disable
### PATCH /user/:userId/enable
### PATCH /user/:userId/reset-password — `{ "newPassword": "..." }`

---

## Org Unit

### GET /org-units — 组织树
### GET /org-unit/:id
### POST /org-unit — `{ "name": "...", "unitType": "group", "parentId": "uuid" }`
### PUT /org-unit/:id
### DELETE /org-unit/:id
### GET /org-unit/:id/users

---

## List

### GET /lists — 当前用户可访问的正常列表；`?includeArchived=true` 时包含可访问的归档列表
### GET /lists/all — 全系统正常列表（系统管理员）；`includeArchived=true` 包含归档，`includeDeleted=true` 包含软删除
### GET /lists/archived — 当前用户可访问的归档列表；系统管理员返回全部
### GET /lists/deleted — 已软删除列表（系统管理员）

### POST /list — `{ "name": "...", "listType": "monthly" }`
### GET /list/:id
### PUT /list/:id
### DELETE /list/:id
### PATCH /list/:id/archive — `{ "archived": true }`
传 `false` 可取消归档。归档与软删除是两个独立字段；列表管理界面将其合并显示为正常、已归档、已删除三种生命周期状态。
### PATCH /list/:id/restore — 恢复软删除列表（系统管理员）

### GET /list/:id/members
### POST /list/:id/member — `{ "userId": "uuid", "role": "editor" }`
### DELETE /list/:id/member/:userId
### PATCH /list/:id/member/:userId/role — `{ "role": "admin" }`
### PATCH /list/:id/transfer-owner — `{ "userId": "uuid" }`

---

## Issue

### GET /list/:listId/issues — 分页
```
Query: ?status=open&priority=high&search=xxx&sort=attention:desc,priority:asc&page=1&size=50
```
```json
// Response 200  { "items": [...], "total": 3 }
// 每条 item 含 _attentionLevel（0~5）；接口返回全量链接，不关注项显隐由前端「只显示【不关注】」控制
```

**sort 参数**：`field:dir` 或复合 `field:dir,field2:dir2`。支持 `attention`、`priority`、`severity`、`status`、`issueNo`、`title`、`dueDate`、`createdAt`。未传时默认 `attention DESC, priority ASC, createdAt DESC`。

### POST /list/:listId/issue — `{ "title": "...", "priority": "high" }`
### GET /issue/:id
### PUT /issue/:id
### PATCH /issue/:id/status — `{ "status": "resolved" }`
### DELETE /issue/:id
### PUT /list/:listId/issue/reorder — `{ "issueIds": [...] }`
### PATCH /list/:listId/issue/:issueId/attention — `{ "attentionLevel": 0..5 }`

---

## Checkpoint

### GET /list/:listId/checkpoints
### GET /issue/:issueId/checkpoints
### POST /issue/:issueId/checkpoint — `{ "checkpointDate": "...", "description": "..." }`
### PUT /checkpoint/:id
### DELETE /checkpoint/:id

---

## Push

### GET /push/preview — `?fromListId=uuid&toListId=uuid`
### POST /push — `{ "fromListId": "...", "toListId": "...", "issueIds": [...] }`
### GET /list/:listId/push-history
### GET /push/history
### GET /list/:listId/incoming-pushes
### PATCH /push/:id/handle — `{ "action": "accepted", "rejectReason": "..." }`

---

## Dict

读取接口允许已认证用户；以下写接口均需系统管理员。

### GET /dict
### GET /dict/:groupName
### POST /dict
### POST /dict/presets — `{ "preset": "automotive" }`
### PUT /dict/:id
### DELETE /dict/:id
### DELETE /dict/tag/:tag

---

## Seed

状态查询允许已认证用户；写操作均需系统管理员。

### GET /seed/status
### POST /seed/test-data
### POST /seed/decline
### POST /seed?force=true

---

## Backup

### GET /db/export
### POST /db/import — `{ "data": {...}, "mode": "replace|merge" }`
### POST /db/repair-links
### POST /db/repair — `{ "task": "all|schema|..." }`
### POST /db/repair/:task

---

## Unit Tests（系统管理员）

### GET /test/files
返回 `{ files: [{ filePath, packageName, caseCount }], available }`

### GET /test/status
返回 `{ running, available, lastResult }`

### POST /test/run
触发全量 Vitest 运行，生成 JSON + 独立 HTML 报告。

返回 `{ message, exitCode, summary, reportUrl, ranAt, runId }`  
`reportUrl` 示例：`/test-reports/latest/report.html`（新标签页打开）

静态报告目录：`GET /test-reports/...`（无需 Bearer，内网工具）

---

## 错误格式

```json
{ "error": "NotFoundError", "message": "列表 不存在" }
```

| HTTP | 类型 |
|------|------|
| 400 | ValidationError |
| 401 | UnauthorizedError |
| 403 | ForbiddenError |
| 404 | NotFoundError |
| 409 | ConflictError |
| 500 | InternalServerError |
