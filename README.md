# Open Issue

Open Issue 是 Phoenix Admin 的声明式业务插件，提供问题列表、点检、推送、8D 报告和功能表能力。本仓库只维护插件模式，不再包含独立 Web、独立 Server 或可单独发布的 Core 应用。

## 仓库结构

| 路径 | 说明 |
| --- | --- |
| `packages/admin-plugin/vue/phoenix-open-issue/` | Phoenix Admin Vue 业务模块 |
| `packages/admin-plugin/midway/phoenix-open-issue/` | Phoenix Admin Node / Midway 业务模块与 PostgreSQL migration |
| `packages/admin-plugin/test/` | 插件领域、服务和契约测试；不进入生产包 |
| `scripts/` | 开发挂载、构建、验证、发布与离线装配工具 |

插件通过 manifest v2、`pah-plugin.artifacts.json` 和版本化 SQL 与 Phoenix Admin/Pah 集成。正式环境统一使用 PostgreSQL，不提供独立服务启动入口，也不使用 TypeORM `synchronize` 自动建表。

## 安装与验证

要求 Node.js 22.x，并使用 `package.json` 声明的 pnpm 版本：

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm admin-plugin:verify
```

常用命令：

```bash
pnpm build                                 # 插件 Node/Vue 类型检查
pnpm test                                  # 插件测试
pnpm admin-plugin:mount-dev-host           # macOS/Linux 开发挂载
pnpm admin-plugin:status-dev-host          # 检查开发挂载
pnpm admin-plugin:unmount-dev-host         # 卸载开发挂载
pnpm admin-plugin:release-package          # 生成不可变 .phoenix.cool 包
pnpm admin-plugin:verify-production-package
```

Windows PowerShell 的 Junction 挂载、正式打包和卸载数据边界见 [插件说明](packages/admin-plugin/README.md)。

## 相关项目

- [phoenix-admin-vue](https://gitee.com/phoenixwing/phoenix-admin-vue)
- [phoenix-admin-node](https://gitee.com/phoenixwing/phoenix-admin-node)
- [phoenix-wing](https://gitee.com/phoenixwing/phoenix-wing)

## 仓库与许可

正式仓库：[Gitee / phoenixwing / phoenix-open-issue](https://gitee.com/phoenixwing/phoenix-open-issue)

Copyright © 2024–2026 凤凰之翼（PhoenixWing）贡献者。项目使用 [Apache License 2.0](LICENSE) 开源。
