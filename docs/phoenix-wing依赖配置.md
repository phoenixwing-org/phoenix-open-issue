# phoenix-wing 依赖配置

## 依赖原则

npm Registry 已发布 `phoenix-wing@0.7.0`。Open Issue 前后端 package manifests、Admin 插件 peer 与开发门禁统一精确锁定该根包版本；消费者当前版本由本仓 manifest、lockfile 和验证门禁自行维护。

- `packages/server/package.json`、`packages/web/package.json` 与 Admin 插件开发依赖都写明 `"phoenix-wing": "0.7.0"`，插件 peer 同样精确要求 `0.7.0`。
- 根包在 Registry 的传递依赖是 `@phoenix-wing/code-core@0.6.3` 与 `@phoenix-wing/db-node@0.6.3`；scoped 包没有不存在的 `0.7.0` 发布物。
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

当前预期各消费者都解析为 `0.7.0`，符号链接目标位于 pnpm 的 `node_modules/.pnpm/phoenix-wing@0.7.0...` 目录；不应指向相邻的 `phoenix-wing` 项目。`pnpm verify:ci` 会检查精确 Registry 版本、本地 override/lockfile 回退、旧 Vite workaround 回退、工作台契约、自动测试和 core/server/web 生产构建；精确测试数量由当次 CI 结果提供，不在本文固化。

## 升级规则

Wing 发布新版本后不自动跟随升级。每次升级由 Open Issue 独立按以下流程验收并提交：

1. 同步修改前后端 `package.json` 中的精确版本。
2. 执行 `pnpm install` 更新 `pnpm-lock.yaml`。
3. 执行 `pnpm verify:ci`，确认依赖来源、公共组件、测试与前后端构建兼容。
4. 在更新日志中记录 Wing 版本和必要的兼容性调整。

如需验证尚未发布的 Wing 代码，应在 Wing 项目自身完成测试。Open Issue 不再保留本地 Wing 命令、环境变量、Vite/Vitest alias 或临时 TypeScript resolver；正式验收只接受 Registry 制品和 lockfile 解析证据。
