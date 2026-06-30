# Open Issue List · 快速原型

> v0.1 原型 — 验证核心流程。后续迁移 cool-admin 插件 + PostgreSQL。

多人协作**议题追踪**：多列表 · 组织推送 · 点检时间线。参考汽车行业 IATF 16949 问题追踪格式设计。

## 快速启动

```bash
pnpm install          # 安装所有依赖
pnpm seed             # 初始化数据库（演示数据）
pnpm dev              # 一键启动 core + server + web
```

打开 http://localhost:5173 即可使用。

**演示账号**：`admin` / `123456` 或 `zhangsan` / `123456`

## 项目结构

| 路径 | 说明 |
|---|---|
| `packages/core/` | 纯 TypeScript 类型 + 算法（零框架依赖，可独立发布 npm） |
| `packages/server/` | Express + better-sqlite3 后端（MVC） |
| `packages/web/` | Vue 3 + Element Plus 前端 |
| `data/` | SQLite 数据库文件（自动生成） |
| `doc/` | 文档 |

## 技术栈（原型）

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vue 3 + Element Plus + Pinia | 同 desk-tools 风格 |
| 后端 | Express + TypeScript | 原型用，后续迁移 Midway.js |
| 数据库 | SQLite (better-sqlite3) | 零配置原型；生产换 PostgreSQL |
| 核心算法 | `@phoenix-wing/open-issue-core` | 纯 TS，可独立发布 npm |
| 包管理 | pnpm workspaces | monorepo |

## 核心概念

### 列表 (Issue List)
每个人可创建多个列表，按年度、月度、项目或自定义命名。列表有成员管理（owner / editor / viewer）。

### 议题 (Issue)
每个列表下的追踪条目，有状态（待处理 → 进行中 → 已解决 → 已关闭）和优先级（低 / 中 / 高 / 紧急）。

### 点检 (Checkpoint)
每条例议题的时间线记录，包含日期、描述、负责人。逾期项红色高亮。

### 推送 (Push)
**逐条 Issue 推送**（不是整个表）。把某个 Issue 从列表 A 推送到列表 B。目标列表成员确认后，Issue 进入目标列表全员可见；拒绝则关闭，可下次重推。小组 → 科室 → 部级依此类推。要求源和目标列表至少有 1 个共同成员。

## 命令参考

```bash
# 单独启动
pnpm dev:core        # 构建 core 包（watch 模式）
pnpm dev:server      # 启动后端 :3001
pnpm dev:web         # 启动前端 :5173

# 构建
pnpm build           # 全部构建

# 数据库
pnpm seed            # 重新填充演示数据
```

## 文档

| 文档 | 说明 |
|------|------|
| [架构设计](doc/架构设计.md) | 架构 + 数据流 |
| [API参考](doc/API参考.md) | REST API 全部端点 |
| [Issue列设计](doc/Issue列设计.md) | 汽车行业对标，列扩展讨论 |
| [推送工作流](doc/推送工作流.md) | 推送→确认/拒绝 完整流程 |
| [待办点检](doc/待办点检.md) | 用自己系统追踪自己开发 |
| [开发计划](doc/开发计划.md) | ADR 决策 + 路线图 |

## 路线图

- [x] v0.1 原型：SQLite + Express + Vue 3，7 张表，基础 CRUD
- [ ] v0.2 扩展：Issue 列扩展 + 推送确认/拒绝 [→ 讨论](doc/Issue列设计.md)
- [ ] v0.3 npm 发布 `@phoenix-wing/*`
- [ ] v1.0 cool-admin 插件 + PostgreSQL

## 相关项目

- [phoenix-desk-tools](https://gitee.com/PhoenixWing321/phoenix-desk-tools) — Phoenix 桌面辅助工具（布局参考）

## License

MIT
