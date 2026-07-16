# phoenix-wing 依赖配置

## 依赖原则

Open Issue 的前后端统一使用 npm 已发布的精确版本 `phoenix-wing@0.3.0`。

- `packages/server/package.json` 和 `packages/web/package.json` 都写明 `"phoenix-wing": "0.3.0"`。
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

预期两个包都解析为 `0.3.0`，符号链接目标位于 pnpm 的 `node_modules/.pnpm/phoenix-wing@0.3.0...` 目录；不应指向相邻的 `phoenix-wing` 项目。

## 升级规则

Wing 发布新版本后，不自动跟随升级。需要升级时应单独提交以下变更：

1. 同步修改前后端 `package.json` 中的精确版本。
2. 执行 `pnpm install` 更新 `pnpm-lock.yaml`。
3. 执行 `pnpm test` 和 `pnpm build`，确认公共组件与后端适配接口兼容。
4. 在更新日志中记录 Wing 版本和必要的兼容性调整。

如需验证尚未发布的 Wing 代码，应在 Wing 项目自身完成测试；确需跨项目临时联调时，也不应把本地链接或 Vite alias 提交到 Open Issue。
