# Open Issue 当前路线

状态：current

Owner：Open Issue maintainers

适用版本：0.7.x

最后核验：2026-08-09

## 已完成基线

- v0.1–v0.4 已覆盖基础 CRUD、多列表关联、汽车行业字段、推送/点检、数据字典、Linux 部署、数据保护与双数据库 adapter；该 adapter 现仅作历史迁移兼容。
- **当前包版本 `0.7.1`**：Open Issue 已收敛为 Phoenix Admin 声明式业务插件，使用 `.phoenix.cool` 不可变制品；本补丁版本修复 PostgreSQL 示例数据 8D 标识符，并补齐 Windows 首次启动与 Junction 挂载说明。实现、复检边界、版本决策和制品 SHA 见 [Windows 测试整改归档](CHANGELOG.md#windows-测试整改归档open-issue-部分)。
- 8D 使用可空 `eightDReports.relatedIssueId` 验证附属能力，不建设通用关联表；Issue 新增 `extensions JSONB` 只承载轻量扩展属性，不保存附属关系或动态表单。只有出现多目标、关系元数据或跨模块统一查询时再升级关联模型。实现边界见[扩展能力计划](附属功能与Issue关联计划.md)。
- 仪表盘已增加[待办中心](仪表盘待办中心.md)，按责任视角聚合待我处理、我发起的推送和管理员审批；不建设重复的通用任务表。
- 生产包声明 `phoenix-wing >=0.6.2 <0.7.0` 为 Host peer，不把相邻源码或 Wing 本地构建收入制品；Open Issue 本地类型检查精确使用 `phoenix-wing@0.6.3` 的冻结提交，singleton、Ribbon/Tree 工作台、View contribution、依赖来源和自动测试继续由门禁验证。
- `codex/single-pnw-workbench` 已完成 `PnwWorkbenchShell` 真实消费者验证；受控并列 resolver 仅用于后续 Wing 源码候选联调，不修改 Registry 依赖图，也不与 `develop/admin-plugin` 迁移线合并语义。
- `@open-issue/core` 保持纯 TypeScript，前后端共享类型和算法但不引入 Vue、Express 或数据库驱动。
- 飞书 OAuth 二期设计归档：`docs/第三方登录/`；表结构点检纳入设置「表结构补全」。真实飞书点检已通过（2026-07-21）。

## 当前优先级

1. 将权限细化、搜索/全文检索、Issue 拖拽排序和头像上传拆成可关闭 Issue，并明确 owner、里程碑和验收证据。
2. PostgreSQL 作为唯一正式支持数据库；旧本地数据库兼容进入弃用过渡期，完整移除工作见 `admin-plugin-rectification/TODO.md`。
3. `@open-issue/core` 是否公开发布由第二个消费者与 API 稳定性决定，不为追求包数量提前拆 `@open-issue/ui`。

## 文档合并关系

- `计划.md` 与 `开发计划.md` 的当前架构/ADR 已由架构设计和本路线承接。
- `功能表计划.md` 的已实现数据模型由 API、数据字典和代码测试承接。
- `TODO.md` 与 `待办点检.md` 的未完成事项已合并到“当前优先级”；后续应迁入系统内真实 Issue。
- 完成态 v0.4 计划和界面巡游计划只保留历史证据。

大型 `AppShell`/详情页面拆分不属于 84.75 → 92.5 当前门禁；达到联合目标后另立 UI 治理任务。
