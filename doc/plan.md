# 开发计划 & 路线图

## 项目背景

需要一套轻量级议题追踪系统，支持多列表协作、组织层级推送、条目点检时间线，替代 Excel 手工管理。

## 核心用户故事

1. 每人可创建多个 Issue List（按年/月/项目/自定义命名）
2. List Owner 可邀请其他用户加入（owner / editor / viewer）
3. 每条 Issue 有 Checkpoint 时间线（日期 + 描述 + 负责人）
4. 小组列表可推送给科室（需成员重叠），科室→部级依此类推
5. 支持定期点检，逾期高亮提醒

## 架构决策记录 (ADR)

### ADR-1: 原型用 SQLite，生产用 PostgreSQL

**决定**：原型阶段使用 better-sqlite3 零配置启动，cool-admin 迁移时切换到 TypeORM + PostgreSQL。

**原因**：
- 原型需要快速迭代，零运维成本
- cool-admin 原生支持 TypeORM + MySQL/PG
- better-sqlite3 API 简单，Service 手写 SQL 直观

### ADR-2: 不使用外键约束

**决定**：表之间只存 ID 文本值，FK 关系由 Service 层代码保证。

**原因**：
- 原型阶段快速变更表结构
- 级联删除逻辑清晰可控（审计保留 PushRecord）
- cool-admin 迁移时再加 FK 和 Entity 关系

### ADR-3: 纯 TypeScript Core 包零框架依赖

**决定**：`@phoenix-wing/open-issue-core` 不依赖任何框架，纯函数实现算法。

**原因**：
- 算法逻辑可独立测试（vitest 单元测试）
- 可发布为独立 npm 包供其他项目使用
- 后端和前端都能 import 类型定义

### ADR-4: 参考 phoenix-desk-tools 布局

**决定**：前端 Ribbon 工具栏 + 三栏布局参考 desk-tools，但做简化。

**原因**：
- desk-tools 已有成熟的 Vue 3 + Element Plus 壳层模式
- 用户熟悉该交互模式
- 保留未来合并到 desk-tools 的可能性

### ADR-5: 先原型后插件

**决定**：先做独立可运行的原型验证核心流程，后续封装为 cool-admin 插件。

**原因**：
- 快速获得可用的 MVP
- 独立原型更容易调试和演示
- 核心算法在原型阶段验证成熟后再做插件化

## 技术选型对比

| 考虑项 | 原型选择 | cool-admin 迁移后 |
|--------|---------|-------------------|
| 数据库 | SQLite | PostgreSQL |
| ORM/驱动 | better-sqlite3 | TypeORM |
| 后端框架 | Express | Midway.js |
| 表关系 | 无 FK | TypeORM @ManyToOne/@OneToMany |
| 部署 | `tsx src/main.ts` | cool-admin 插件加载 |

## 数据模型讨论

### 为什么需要 org_unit_id 在 issue_lists 表上

列表可以标记为某个组织节点的列表（如"前端组 2026年7月点检"），用于：
- 按组织筛选列表
- 推送时验证层级关系（小组 → 科室 → 部）
- 便于组织负责人查看本组织所有列表

### 推送逻辑详解

```
小组成员 A 和 B 有一个列表 L1
科室成员 A、B、C 有一个列表 L2
→ L1 推送到 L2：A 和 B 是共同成员，✓ 可推送
→ L2 推送到 L1：A 和 B 是共同成员，✓ 可推送

但如果 L1 成员是 A、B，L3 成员是 C、D
→ 没有共同成员，✗ 不可推送
```

### 为什么不直接 COPY issue 而是只记录 push_records

当前版本推送只记录 push_records，不复制 Issue 数据。原因是：
- 保持数据单一来源（避免同步问题）
- 审计保留推送历史
- v0.2 将实现真正的 Issue 副本推送到目标列表

## 后续包发布规划

| 包名 | 当前状态 | 说明 |
|------|---------|------|
| `@phoenix-wing/open-issue-core` | ✅ 已有代码 | 类型 + push/scheduling/permission 算法 |
| `@phoenix-wing/open-issue-ui` | ✅ 已有代码 | Vue3 组件：IssueTable, CheckpointTimeline 等 |
| `@phoenix-wing/caa-dialog-core` | 📦 在 desk-tools | CAA 对话框解析/生成算法 |
| `@phoenix-wing/caa-dialog-ui` | 📦 在 desk-tools | CAA 对话框编辑器 Vue3 组件 |
| `@phoenix-wing/code-sort` | 🔮 待开发 | 代码排序工具 |
| `@phoenix-wing/rename-tool` | 📦 在 desk-tools | 搜索替换改名工具 |

## 时间线

| 阶段 | 范围 | 状态 |
|------|------|------|
| v0.1 原型 | core + server + web 完整功能 | ✅ 2026-06-30 |
| v0.2 改进 | Issue 推送副本、拖拽排序、响应式 | 📅 TBD |
| v0.3 npm | 发布 `@phoenix-wing/*` 包 | 📅 TBD |
| v1.0 迁移 | cool-admin 插件 + PostgreSQL | 📅 TBD |
