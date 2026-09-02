# Open Issue 当前路线

状态：current

适用版本：0.7.2

最后核验：2026-08-26

## 当前基线

- 仓库只维护 Phoenix Admin 声明式业务插件，不再维护独立 Web、Express Server 或独立 Core 包。
- Vue、Midway、领域算法、类型、PostgreSQL migration 和插件测试均归入 `packages/admin-plugin/`。
- 正式交付使用不可变 `.phoenix.cool` 制品；开发 Link/Junction 不能作为安装包。
- 插件精确消费 Registry `phoenix-wing@0.7.2`，不探测相邻源码，也不使用 `link:`、`file:` 或 workspace override。
- 业务数据使用 `oip_*` PostgreSQL 表；生产禁止 TypeORM `synchronize`，迁移必须经过 manifest 校验、dry-run、可信备份和 ledger。
- 8D 使用可空 `relatedIssueId`；Issue 的 `extensions JSONB` 只承载轻量扩展属性，不保存附属关系。

## 当前优先级

1. 在冻结的 Phoenix Admin Vue/Node Host 上持续验证插件安装、升级、停用、普通卸载保留数据与重装恢复。
2. 保持 capability、列表角色和稳定 Host 用户 ID 的权限边界，列表与详情统一显示 Host 批量解析后的用户名称。
3. 每次 Wing 或 Host 契约升级都运行插件完整门禁、双端类型检查和真实浏览器关键旅程。
4. 新功能只进入插件命名空间；Host-owned 的登录、组织、全局字典、备份和全局导航不在本仓复制实现。

历史独立站版本、SQLite/双数据库计划和迁移讨论仍可从 Git 历史查阅，但不再作为当前实现或发布依据。
