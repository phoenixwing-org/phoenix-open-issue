# Open Issue 当前路线

状态：current

Owner：Open Issue maintainers

适用版本：0.5.x

最后核验：2026-07-20

## 已完成基线

- v0.1–v0.4 已覆盖基础 CRUD、多列表关联、汽车行业字段、推送/点检、数据字典、Linux 部署、数据保护与 SQLite/PostgreSQL adapter。
- **当前包版本 `0.5.0`**：含飞书 OAuth 二期（管理员绑定 + 待审查）、登录方式设定，以及 post-0.4 积压能力；见 [CHANGELOG](CHANGELOG.md)。
- 前端和服务端精确消费 Registry `phoenix-wing@0.4.2`，不依赖相邻源码；已删除 `optimizeDeps.exclude`，singleton 与 Ribbon v1 fixture 回归、依赖来源、自动测试和三段构建已进入 `verify:ci`。
- `@open-issue/core` 保持纯 TypeScript，前后端共享类型和算法但不引入 Vue、Express 或数据库驱动。
- 飞书 OAuth 二期设计归档：`doc/第三方登录/`；表结构点检纳入设置「表结构补全」。真实飞书 E2E 待测。

## 当前优先级

1. 将权限细化、搜索/全文检索、Issue 拖拽排序和头像上传拆成可关闭 Issue，并明确 owner、里程碑和验收证据。
2. 保持 SQLite 与 PostgreSQL 行为一致；迁移必须提供校验、回滚和数据保护证据。
3. `@open-issue/core` 是否公开发布由第二个消费者与 API 稳定性决定，不为追求包数量提前拆 `@open-issue/ui`。

## 文档合并关系

- `计划.md` 与 `开发计划.md` 的当前架构/ADR 已由架构设计和本路线承接。
- `功能表计划.md` 的已实现数据模型由 API、数据字典和代码测试承接。
- `TODO.md` 与 `待办点检.md` 的未完成事项已合并到“当前优先级”；后续应迁入系统内真实 Issue。
- 完成态 v0.4 计划和界面巡游计划只保留历史证据。

大型 `AppShell`/详情页面拆分不属于 84.75 → 92.5 当前门禁；达到联合目标后另立 UI 治理任务。
