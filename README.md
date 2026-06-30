# Open Issue List

多人协作的 **议题追踪系统**，支持多列表管理、组织层级推送、条目点检时间线。

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

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | Vue 3 + Vite + Element Plus + Pinia + Vue Router |
| 后端 | Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| 核心算法 | 纯 TypeScript（`@phoenix-wing/open-issue-core`） |
| 包管理 | pnpm workspaces |

## 核心概念

### 列表 (Issue List)
每个人可创建多个列表，按年度、月度、项目或自定义命名。列表有成员管理（owner / editor / viewer）。

### 议题 (Issue)
每个列表下的追踪条目，有状态（待处理 → 进行中 → 已解决 → 已关闭）和优先级（低 / 中 / 高 / 紧急）。

### 点检 (Checkpoint)
每条例议题的时间线记录，包含日期、描述、负责人。逾期项红色高亮。

### 推送 (Push)
列表间议题推送。小组列表可推送给科室列表 → 科室推送给部级。要求源和目标列表至少有 1 个共同成员。

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

## 路线图

- [x] 快速原型：SQLite + Express + Vue 3
- [ ] npm 发布 `@phoenix-wing/open-issue-core`
- [ ] npm 发布 `@phoenix-wing/open-issue-ui`
- [ ] cool-admin 插件迁移（SQLite → PostgreSQL）
- [ ] 邮件/Webhook 通知
- [ ] 点检周期自动提醒

## 相关项目

- [phoenix-desk-tools](https://gitee.com/PhoenixWing321/phoenix-desk-tools) — Phoenix 桌面辅助工具（布局参考）

## License

MIT
