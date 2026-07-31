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
// 每条 item 含 _attentionLevel（0~5）、extensions（对象）与 listCount（整数）。
// listCount 已固化在 issues 表，由 issueListLinks 触发器维护；列表查询不做关联计数。
// 接口返回全量链接，不关注项显隐由前端「只显示【不关注】」控制
```

**sort 参数**：`field:dir` 或复合 `field:dir,field2:dir2`。支持 `attention`、`priority`、`severity`、`status`、`issueNo`、`title`、`dueDate`、`createdAt`。未传时默认 `attention DESC, priority ASC, createdAt DESC`。

兼容语义：`severity` 表示重要度（`trivial` → `fatal`），`priority` 表示紧急度（`low` → `critical`）。字段名为兼容旧数据保持不变；两组固定值按低到高排列。

`extensions` 为 `JSONB NOT NULL DEFAULT '{}'` 的通用扩展属性容器；当前通用 Issue 新建/编辑接口不接受任意 JSON 修改。`listCount` 为 `INTEGER NOT NULL DEFAULT 0` 的关联列表计数缓存，只在数量大于等于 2 时由列表和详情界面显示。

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
### POST /issue/:issueId/checkpoint — `{ "checkpointDate": "2026-07-30", "deadline": "2026-08-05" | null, "description": "..." }`
### PUT /checkpoint/:id — 不传 `deadline` 保持原值；传日期修改；传 `null` 清空
### DELETE /checkpoint/:id

`checkpointDate` 是必填、可编辑的点检日，用于时间线排序；`deadline` 是可选截止日，仅用于逾期判断。两者均使用 `YYYY-MM-DD`。详见[点检日期设计](点检日期设计.md)。

---

## Push

### GET /dashboard/tasks — 仪表盘待办中心

查询参数：`tab=summary|incoming|outgoing|admin`（默认 `summary`），`limit=1..20`（默认 `5`）。`summary` 只返回各 Tab 数量；其他值只返回对应 Tab 的最多 `limit` 条明细，其余明细数组为空。数据包括当前账号的待我处理推送、我发起的待处理推送，以及系统管理员专属的待批准账号和第三方登录待关联申请。只查询 `pending` 状态；非管理员的管理审批数组固定为空。总数对两个推送视角按记录 ID 去重。

详见[仪表盘待办中心](仪表盘待办中心.md)。

### GET /push/preview — `?fromListId=uuid&toListId=uuid`
### POST /push

列表推送（兼容旧客户端省略 `targetType`）：

```json
{ "fromListId": "...", "targetType": "list", "toListId": "...", "issueIds": ["..."] }
```

用户定向推送：

```json
{ "fromListId": "...", "targetType": "user", "toUserId": "...", "issueIds": ["..."] }
```

用户推送在待处理时 `toListId=null`；指定接收人接受时才选择目标列表。

### GET /list/:listId/push-history
### GET /push/history
### GET /list/:listId/incoming-pushes
### GET /push/:id/target-lists — 用户推送接收人可选择的 owner/admin 列表
### PATCH /push/:id/handle

- 列表推送接受：`{ "action": "accepted" }`
- 用户推送接受：`{ "action": "accepted", "toListId": "..." }`
- 拒绝：`{ "action": "rejected", "rejectReason": "..." }`

### PATCH /push/:id/withdraw — 仅发起人可撤回待处理推送

推送状态：`pending | accepted | rejected | withdrawn`。接受、拒绝和撤回都以 `status=pending` 条件更新，重复或并发处理不会产生第二条列表链接。

---

## 8D 附属报告

8D 报告是独立业务记录，不属于 Issue 核心字段。`relatedIssueId` 可为 `null`；关联不会授予 Issue 权限。

### GET /eight-d-reports — 当前用户可读的关联/独立报告
### GET /eight-d-reports/issue-options — 当前用户可编辑并可作为关联目标的 Issue
### GET /issue/:issueId/eight-d-reports
### GET /eight-d-report/:id
### POST /eight-d-report
### PUT /eight-d-report/:id

```json
{
  "title": "供应商来料尺寸异常 8D",
  "relatedIssueId": "issue-id-or-null",
  "containment": "D3 临时措施",
  "rootCause": "D4 根因",
  "correctiveAction": "D5-D6 永久措施"
}
```

### DELETE /eight-d-report/:id — 软删除，保留审计字段

关联报告读取服从 Issue 权限；关联/改绑/解绑要求目标 Issue 原列表的编辑权限。独立报告默认仅创建人和系统管理员可读写。

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

`severity`（重要度）与 `priority`（紧急度）是内置系统字典：不允许新增、删除、停用、调整顺序或修改 `value`，`PUT /dict/:id` 只接受显示名 `label` 变化。

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
### POST /db/repair — `{ "task": "all|schema|checkpoints|links|dict|users|issueNo|linkAttention|reports" }`
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
