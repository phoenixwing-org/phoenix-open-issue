# phoenix-wing 依赖配置

## 依赖原则

npm Registry 已发布 `phoenix-wing@0.6.0`。Open Issue 前后端 package manifests 统一精确锁定该版本；消费者当前版本由本仓 manifest、lockfile 和验证门禁自行维护，不依赖 Wing 项目维护消费者版本矩阵。

- `packages/server/package.json` 和 `packages/web/package.json` 都写明 `"phoenix-wing": "0.6.0"`。
- Vite 不探测相邻的 `phoenix-wing` 仓库，也不配置本地源码 alias。
- 不使用 `pnpm link`、`file:`、`workspace:` 等本地引用。
- 相邻目录中 Wing 的源码、分支或依赖发生变化，不应影响 Open Issue 的安装、测试和构建。

这样可以明确两个项目的边界：Wing 先独立发布 npm 版本，Open Issue 再按需升级和验证。

## 安装与验证

在 Open Issue 根目录安装依赖：

```bash
pnpm install
```

查看工作区实际解析的版本：

```bash
pnpm why phoenix-wing -r
readlink packages/web/node_modules/phoenix-wing
readlink packages/server/node_modules/phoenix-wing
```

当前预期两个包都解析为 `0.6.0`，符号链接目标位于 pnpm 的 `node_modules/.pnpm/phoenix-wing@0.6.0...` 目录；不应指向相邻的 `phoenix-wing` 项目。`pnpm verify:ci` 会检查精确 Registry 版本、本地 override/lockfile 回退、旧 Vite workaround 回退、工作台契约、自动测试和 core/server/web 生产构建；精确测试数量由当次 CI 结果提供，不在本文固化。

## 升级规则

Wing 发布新版本后不自动跟随升级。每次升级由 Open Issue 独立按以下流程验收并提交：

1. 同步修改前后端 `package.json` 中的精确版本。
2. 执行 `pnpm install` 更新 `pnpm-lock.yaml`。
3. 执行 `pnpm verify:ci`，确认依赖来源、公共组件、测试与前后端构建兼容。
4. 在更新日志中记录 Wing 版本和必要的兼容性调整。

如需验证尚未发布的 Wing 代码，应在 Wing 项目自身完成测试；确需跨项目临时联调时，也不应把本地链接或 Vite alias 提交到 Open Issue。

## 受控本地 Wing 候选验证

`codex/single-pnw-workbench` 曾在 Wing `0.6.0` 发布前验证工作台候选；当前 Open Issue 的两个 manifest 与 lockfile 已回归 Registry `0.6.0`。以下受控命令继续用于验证后续尚未发布的 Wing 源码，并且只在当前进程切换来源：

```bash
pnpm wing:check-local
pnpm dev:local-wing
pnpm build:local-wing
pnpm verify:local-wing
```

这些命令必须找到标准并列目录 `../phoenix-wing`，先构建 Wing，再把 Vite、Vitest 与本地 Web typecheck 指向 Wing `dist`；日志明确输出 `[Wing][LOCAL]`、路径和候选版本。普通 `pnpm dev`、`pnpm build` 与 `pnpm verify:ci` 是 Registry `0.6.0` 基线；本地命令只证明源码候选可被真实消费者加载。

本地模式不是 `pnpm link`：不得写入 `link:`、`file:`、`workspace:`、override 或 node_modules。验证完成后应检查 `package.json`、`pnpm-lock.yaml` 和 `node_modules` 未发生来源污染。本地通过只证明源码候选可被真实消费者加载，不代表 Registry 发布完成。
