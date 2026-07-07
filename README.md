# Open Issue List

> 基于 phoenix-wing 框架的多人协作议题追踪系统。

## 为什么做这个项目

在汽车行业（及其他制造业）的研发流程中，**问题追踪** 是质量管理的核心环节。从发现问题、分析根因、制定措施到验证关闭，每个 Issue 都需要跨角色、跨层级的协作。

市面上的 Issue 追踪工具（Jira、禅道、飞书多维表格）要么过于通用、难以适配行业字段规范，要么缺乏组织层级推送能力。

Open Issue List 的目标是提供一个 **轻量、标准对齐、开箱即用** 的议题追踪工具，并作为 **phoenix-wing 框架的首个验证应用**。

## 标准参考

字段设计与工作流参考汽车行业质量管理标准：

| 标准 | 说明 |
|------|------|
| **IATF 16949** | 汽车质量管理体系 — 问题解决与纠正措施要求 |
| **8D 报告** | 八步问题解决法（D1-D8） |
| **VDA 6.3** | 过程审核 — 问题分级与追踪 |

核心字段对标：严重度（S）、优先级（P）、发现阶段、责任人、计划完成日、实际完成日、点检记录等。

## 核心优势

- **标准字段** — 21 个汽车行业字段，开箱即用，无需配置
- **组织推送** — 按层级（小组 → 科室 → 部门）逐级推送 Issue，支持覆盖/合并策略
- **点检时间线** — 每个 Issue 可追加多条点检记录，逾期项高亮提醒
- **多视图** — 简单/复杂/跟踪三种视图，适配点检会议、审计追溯等不同场景
- **零配置启动** — SQLite 单文件数据库，`pnpm dev` 一键运行
- **按需演示** — 首次登录弹窗询问是否添加演示数据，拒绝后不再打扰

## 快速启动

```bash
pnpm install          # 安装所有依赖
pnpm dev              # 一键启动 core + server + web（首次启动自动创建管理员账号）
```

打开 http://localhost:5173 即可使用。

**默认管理员**：`admin` / `123456`

首次登录后，仪表盘会弹窗询问是否添加演示数据（示例列表、Issue、点检等）。选择「添加」可快速体验完整功能，选择「不需要」则不再询问。

> CLI 强制重填：`pnpm seed`（或 `pnpm seed force` 清空后重填）

## 项目结构

| 路径 | 说明 |
|---|---|
| `packages/core/` | 纯 TypeScript 类型 + 算法（零框架依赖，可独立发布 npm） |
| `packages/server/` | Express + node-sqlite3-wasm 后端（MVC） |
| `packages/web/` | Vue 3 + Element Plus 前端 |
| `data/` | SQLite 数据库文件（自动生成） |
| `doc/` | 文档 |

## 技术栈（原型）

| 层 | 技术 | 说明 |
|---|---|---|
| 前端 | Vue 3 + Element Plus + Pinia | 同 desk-tools 风格 |
| 后端 | Express + TypeScript | 原型用，后续迁移 Midway.js |
| 数据库 | SQLite (node-sqlite3-wasm) | 零配置原型；生产换 PostgreSQL |
| 核心算法 | `@open-issue/core` | 纯 TS，可独立发布 npm |
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
pnpm dev             # 一键启动 core + server + web
pnpm dev:web         # 仅启动前端 :5183
pnpm dev:server      # 仅启动后端 :3400
pnpm build           # 全部构建
pnpm seed            # CLI 重新填充演示数据（force 追加可清空）
```

> phoenix-wing 本地联调自动检测：上级目录有 `phoenix-wing/` 就用本地源码，没有就用 npm 库。详见 [phoenix-wing 依赖配置](doc/phoenix-wing依赖配置.md)。

## 文档

| 文档 | 说明 |
|------|------|
| [架构设计](doc/架构设计.md) | 架构 + 数据流 |
| [API参考](doc/API参考.md) | REST API 全部端点 |
| [数据字典配置](doc/数据字典配置.md) | 下拉选项枚举值，汽车/软件预设 |
| [Issue列设计](doc/Issue列设计.md) | 汽车行业对标，列扩展讨论 |
| [推送工作流](doc/推送工作流.md) | 推送→确认/拒绝 完整流程 |
| [待办点检](doc/待办点检.md) | 用自己系统追踪自己开发 |
| [开发计划](doc/开发计划.md) | ADR 决策 + 路线图 |
| [phoenix-wing 依赖配置](doc/phoenix-wing依赖配置.md) | npm 模式 vs 本地 link 模式 |

## 路线图

- [x] v0.1 原型：SQLite + Express + Vue 3，7 张表，基础 CRUD
- [ ] v0.2 扩展：Issue 列扩展 + 推送确认/拒绝 [→ 讨论](doc/Issue列设计.md)
- [ ] v0.3 npm 发布 `@open-issue/*`
- [ ] v1.0 cool-admin 插件 + PostgreSQL

更多待办见 [TODO](doc/TODO.md)

## 相关项目

- [phoenix-desk-tools](https://gitee.com/PhoenixWing321/phoenix-desk-tools) — Phoenix 桌面辅助工具（布局参考）

## License

MIT
