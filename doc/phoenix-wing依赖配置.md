# phoenix-wing 依赖配置

## 依赖原则

npm registry 中的 `phoenix-wing@0.4.0` 含未转换的 `workspace:` 依赖，继续作为禁止消费的失败版本。`0.4.2` 已先发布七个 `@phoenix-wing/*` 内部包、最后发布聚合包；Registry manifest 使用纯 `0.4.2` 依赖，npm/pnpm 干净安装均通过。Open Issue 前后端 package manifests 现统一精确锁定 `phoenix-wing@0.4.2`。

- `packages/server/package.json` 和 `packages/web/package.json` 都写明 `"phoenix-wing": "0.4.2"`。
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

当前预期两个包都解析为 `0.4.2`，符号链接目标位于 pnpm 的 `node_modules/.pnpm/phoenix-wing@0.4.2...` 目录；不应指向相邻的 `phoenix-wing` 项目。`pnpm verify:ci` 会检查精确 Registry 版本、本地 override/lockfile 回退、旧 Vite workaround 回退、singleton/Ribbon 契约、自动测试和 core/server/web 生产构建；精确测试数量由当次 CI 结果提供，不在本文固化。

## 升级规则

Wing 发布新版本后不自动跟随升级。0.4.0 已明确禁止升级；0.4.2 已按以下规则完成升级。之后的新版本仍必须重复同一流程：

1. 同步修改前后端 `package.json` 中的精确版本。
2. 执行 `pnpm install` 更新 `pnpm-lock.yaml`。
3. 执行 `pnpm verify:ci`，确认依赖来源、公共组件、测试与前后端构建兼容。
4. 在更新日志中记录 Wing 版本和必要的兼容性调整。

如需验证尚未发布的 Wing 代码，应在 Wing 项目自身完成测试；确需跨项目临时联调时，也不应把本地链接或 Vite alias 提交到 Open Issue。
