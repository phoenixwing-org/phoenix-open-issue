# API 文档

Base URL: `http://localhost:3001/api`

认证方式：`Authorization: Bearer <token>`（除标注 `[public]` 外均需）

> 字段命名：API JSON 全部使用 camelCase。数据库列保持 snake_case，Service 层做映射。

---

## Auth

### POST /auth/register `[public]`
注册新用户。成功后直接返回 JWT。

```json
// Request
{ "username": "alice", "password": "123456", "displayName": "Alice" }

// Response 201
{ "token": "eyJ...", "user": { "id": "uuid", "username": "alice", ... } }
```

### POST /auth/login `[public]`
```json
// Request
{ "username": "admin", "password": "123456" }

// Response 200
{ "token": "eyJ...", "user": { ... } }
```

### GET /auth/me
获取当前用户信息。

```json
// Response 200
{ "id": "uuid", "username": "admin", "displayName": "管理员", ... }
```

### GET /users
获取所有用户列表。

---

## Org Units

### GET /org-units
获取完整组织树（嵌套结构）。

```json
// Response 200
[{ "id": "uuid", "name": "研发部", "unitType": "division", "parentId": null, "children": [...] }]
```

### GET /org-units/:id
获取单个组织节点。

### POST /org-units
```json
// Request
{ "name": "前端组", "unitType": "group", "parentId": "uuid" }
```

### PUT /org-units/:id
```json
// Request
{ "name": "新名称" }
```

### DELETE /org-units/:id
删除组织节点（自动解除子节点 parentId）。

### GET /org-units/:id/users
获取组织节点下的用户列表。

---

## Issue Lists

### GET /lists
获取当前用户可访问的所有列表（我创建的 + 我作为成员的）。

```json
// Response 200
[{ "id": "uuid", "name": "2026年7月点检", "listType": "monthly", "ownerId": "uuid", ... }]
```

### POST /lists
创建新列表，创建者自动成为 owner 成员。

```json
// Request
{ "name": "2026年7月点检", "listType": "monthly", "description": "月度常规检查" }
```

### GET /lists/:id
获取列表详情。

### PUT /lists/:id
更新列表（需 owner 或 editor 角色）。

```json
// Request
{ "name": "新名称", "description": "新描述" }
```

### DELETE /lists/:id
删除列表（仅 owner），级联删除 Issues 和 Checkpoints。

### GET /lists/:id/members
获取列表成员（含用户显示名）。

```json
// Response 200
[{ "id": "uuid", "userId": "uuid", "username": "zhangsan", "role": "editor", ... }]
```

### POST /lists/:id/members
添加成员（需 owner 或 editor）。

```json
// Request
{ "userId": "uuid", "role": "editor" }
```

### DELETE /lists/:id/members/:userId
移除成员（需 owner 或 editor，不能移除 owner）。

---

## Issues

### GET /lists/:listId/issues
分页获取 Issue 列表。

```
Query: ?status=open&priority=high&search=关键词&page=1&size=50
```

```json
// Response 200
{
  "items": [{ "id": "uuid", "title": "采购服务器", "status": "in_progress", "priority": "high", ... }],
  "total": 3
}
```

### POST /lists/:listId/issues
```json
// Request
{ "title": "部署 CI/CD", "description": "搭建 Jenkins + K8s", "priority": "high" }
```

### GET /issues/:id
获取 Issue 详情。

### PUT /issues/:id
```json
// Request
{ "title": "新标题", "status": "in_progress", "priority": "critical" }
```

### PATCH /issues/:id/status
快速变更状态。

```json
// Request
{ "status": "resolved" }
```

### DELETE /issues/:id
删除 Issue，级联删除 Checkpoints。

### PUT /lists/:listId/issues/reorder
拖拽排序。

```json
// Request
{ "issueIds": ["uuid1", "uuid3", "uuid2"] }
```

---

## Checkpoints

### GET /issues/:issueId/checkpoints
获取某 Issue 的所有点检项（按日期排序）。

```json
// Response 200
[{ "id": "uuid", "checkpointDate": "2026-06-24", "description": "已走流程到采购", "status": "done", "responsibleUserId": "uuid", ... }]
```

### POST /issues/:issueId/checkpoints
```json
// Request
{ "checkpointDate": "2026-07-05", "description": "草拟规范文档", "responsibleUserId": "uuid" }
```

### PUT /checkpoints/:id
```json
// Request
{ "status": "done", "description": "已完成草拟" }
```

### DELETE /checkpoints/:id
删除点检项。

---

## Push

### GET /push/preview
预览推送，验证成员重叠。

```
Query: ?fromListId=uuid&toListId=uuid
```

```json
// Response 200
{ "valid": true, "overlapUserIds": ["uuid1"], "overlapPercent": 50, "canPush": true,
  "message": "可推送：1 个共同成员（50%）" }
```

### POST /push
执行推送。

```json
// Request
{ "fromListId": "uuid", "toListId": "uuid", "issueIds": ["uuid1", "uuid2"], "note": "月度汇总推送" }

// Response 201
{ "records": [...], "validation": { ... } }
```

### GET /lists/:listId/push-history
获取某个列表相关的推送记录。

### GET /push/history
获取当前用户相关的所有推送记录。

---

## 错误响应格式

所有错误返回统一格式：

```json
{ "error": "NotFoundError", "message": "列表 不存在" }
```

| HTTP Status | 错误类型 | 示例 |
|---|---|---|
| 400 | ValidationError | 参数校验失败 |
| 401 | UnauthorizedError | 未登录或 Token 过期 |
| 403 | ForbiddenError | 权限不足 |
| 404 | NotFoundError | 资源不存在 |
| 409 | ConflictError | 用户名已存在 |
| 500 | InternalServerError | 服务器内部错误 |
