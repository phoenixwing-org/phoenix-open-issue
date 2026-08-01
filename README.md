# Open Issue List

> 基于 phoenix-wing 框架的多人协作议题追踪系统。

## 为什么做这个项目

在汽车行业（及其他制造业）的研发流程中，**问题追踪** 是质量管理的核心环节。从发现问题、分析根因、制定措施到验证关闭，每个 Issue 都需要跨角色、跨层级的协作。

市面上的 Issue 追踪工具（Jira、禅道、飞书多维表格）要么过于通用、难以适配行业字段规范，要么缺乏组织层级推送能力。

Open Issue List 的目标是提供一个 **轻量、标准对齐、开箱即用** 的议题追踪工具，并作为 **phoenix-wing 框架的首个验证应用**。

## 标准参考

字段设计与工作流参考汽车行业质量管理标准：


| 标准             | 说明                     |
| -------------- | ---------------------- |
| **IATF 16949** | 汽车质量管理体系 — 问题解决与纠正措施要求 |
| **8D 报告**      | 八步问题解决法（D1-D8）         |
| **VDA 6.3**    | 过程审核 — 问题分级与追踪         |


核心字段对标：严重度（S）、优先级（P）、发现阶段、责任人、截止日、实际完成日、点检记录等。

## 核心优势

- **稳定核心字段** — 通用 Issue 使用重要度 × 紧急度等字段；8D 作为可选附属报告独立维护
- **协作推送** — 可推送到有权访问的列表，也可定向推送给用户，由接收人决定接收到哪个工作列表
- **点检时间线** — 每个 Issue 可追加多条点检记录，逾期项高亮提醒
- **多视图** — 简单/复杂/跟踪三种视图，适配点检会议、审计追溯等不同场景
- **PostgreSQL 持久化** — 正式运行统一使用 PostgreSQL；SQLite 仅保留弃用过渡期兼容
- **按需演示** — 首次登录弹窗询问是否添加演示数据，拒绝后不再打扰



## 快速启动

```bash
pnpm install          # 安装所有依赖
pnpm dev              # 一键启动 core + server + web（首次启动自动创建管理员账号）
```

打开 [http://localhost:5183](http://localhost:5183) 即可使用。

**默认管理员**：`admin` / `123456`

> `123456` 仅用于本地开发。生产启动必须设置至少 32 位的 `JWT_SECRET` 和至少 12 位的 `INITIAL_ADMIN_PASSWORD`，示例占位值会被拒绝。

首次登录后，仪表盘会弹窗询问是否添加演示数据（示例列表、Issue、点检等）。选择「添加」可快速体验完整功能，选择「不需要」则不再询问。

> CLI 强制重填：`pnpm seed`（或 `pnpm seed force` 清空后重填）



## 项目结构


| 路径                 | 说明                                    |
| ------------------ | ------------------------------------- |
| `packages/core/`   | 纯 TypeScript 类型 + 算法（零框架依赖，可独立发布 npm） |
| `packages/server/` | Express + PostgreSQL 后端（MVC）   |
| `packages/web/`    | Vue 3 + Element Plus 前端               |
| `data/`            | 旧 SQLite 数据目录（弃用过渡期，待迁移清理）                    |
| `doc/`             | 文档                                    |




## 技术栈


| 层    | 技术                           | 说明                   |
| ---- | ---------------------------- | -------------------- |
| 前端   | Vue 3 + Element Plus + Pinia | 同 desk-tools 风格      |
| 后端   | Express + TypeScript         | 当前生产与开发 API           |
| 数据库  | PostgreSQL                   | 唯一正式支持；SQLite 仅保留旧库/测试兼容，后续移除 |
| 核心算法 | `@open-issue/core`           | 纯 TS，可独立发布 npm       |
| 包管理  | pnpm workspaces              | monorepo             |




## 核心概念



### 列表 (Issue List)

每个人可创建多个列表，按年度、月度、项目或自定义命名。列表有成员管理（owner / editor / viewer）。

### 议题 (Issue)

每个列表下的追踪条目，有状态（待处理 → 处理中 → 待验收 → 已完成，或已取消）、重要度（较低 → 关键）和紧急度（可延后 → 立即）。

### 点检 (Checkpoint)

每条例议题的时间线记录，包含日期、描述、负责人。逾期项红色高亮。

### 推送 (Push)

**逐条 Issue 推送**（不是整个表）。列表模式把 Issue 从列表 A 推送到列表 B，并由目标列表 owner/admin 审批；用户模式只指定接收人，对方接受时再选择自己管理的列表。两种模式都通过链接共享同一 Issue，不复制正文。

### 8D 附属报告

8D 报告独立于 Issue 核心表单，可单独存在，也可通过可空 `relatedIssueId` 关联一个 Issue。D3/D4/D5-D6 保持专业语义，通用周点检、例会和开发/测试列表无需承担这些专用字段。

## 命令参考

```bash
pnpm dev             # 一键启动 core + server + web
pnpm dev:local-wing  # 使用并列 ../phoenix-wing 构建制品验证源码候选
pnpm dev:web         # 仅启动前端 :5183
pnpm dev:server      # 仅启动后端 :3400
pnpm build           # 全部构建
pnpm build:local-wing # 使用并列 Wing 工作区完成三段构建
pnpm seed            # CLI 重新填充演示数据（force 追加可清空）
```

> 本仓前后端 manifest 与 lockfile 精确消费 npm Registry `phoenix-wing@0.6.0`。另提供显式 `*:local-wing` 命令，在单次进程内验证标准并列 `../phoenix-wing` 的源码候选；普通命令仍不探测相邻源码。详见 [phoenix-wing 依赖配置](doc/phoenix-wing依赖配置.md)。



## 文档


| 文档                                           | 说明                   |
| -------------------------------------------- | -------------------- |
| [文档索引](doc/文档索引.md)                       | 当前说明、草案与历史证据的唯一导航 |
| [当前路线](doc/current-roadmap.md)                | 当前优先级与联合治理消费者责任 |
| [更新日志](doc/CHANGELOG.md)                     | v0.6.1 版本变更摘要        |
| [架构设计](doc/架构设计.md)                          | 架构 + 数据流             |
| [API参考](doc/API参考.md)                        | REST API 全部端点        |
| [数据字典配置](doc/数据字典配置.md)                      | 下拉选项枚举值，汽车/软件预设      |
| [已知问题](doc/已知问题.md)                         | 当前 workaround 与关闭条件    |
| [phoenix-wing 依赖配置](doc/phoenix-wing依赖配置.md) | npm 固定版本与升级规则      |
| [Linux 测试部署](doc/Linux测试部署.md)               | 构建、配置、systemd 与升级检查 |
| [SQLite/PG 双数据库计划](doc/v0.4-PG双数据库适配计划.md) | PnwDbAdapter、迁移与双库测试方案 |
| [PostgreSQL 部署与迁移](doc/PostgreSQL部署与迁移.md) | Linux 配置、SQLite JSON 迁移、校验与回滚 |
| [多人权限与列表筛选加固](doc/多人权限与列表筛选加固.md) | 系统/列表权限矩阵、筛选分页、认证和回归测试 |
| [Issue 扩展能力：定向推送与附属关联](doc/附属功能与Issue关联计划.md) | 用户定向推送、8D 可空关联、权限与迁移边界 |

## 路线图

已完成版本基线和当前未完成项统一见[当前路线](doc/current-roadmap.md)；旧 TODO、点检表和版本计划只保留为分类清单中的历史证据。

## 相关项目

- [phoenix-desk-tools](https://gitee.com/phoenixwing/phoenix-desk-tools) — Phoenix 桌面辅助工具（布局参考）
- [phoenix-wing](https://gitee.com/phoenixwing/phoenix-wing) — Phoenix npm 插件

## 许可证

Copyright © 2024–2026 上海锟钛。项目使用 [Apache License 2.0](LICENSE) 开源。
