# phoenix-wing 依赖配置

## 依赖原则

Open Issue 插件的 `packages/admin-plugin/package.json` 将开发依赖和 peer dependency 都精确锁定为 Registry `phoenix-wing@0.7.2`。

- 不探测相邻 `phoenix-wing` 源码。
- 不使用 `pnpm link`、`file:`、`workspace:` 或本地 resolver。
- 相邻 Wing 工作树的分支、源码或依赖变化不能影响本插件安装与构建。
- Wing 必须先独立发布，Open Issue 再更新精确版本并完成兼容验收。

## 安装与验证

```bash
pnpm install --frozen-lockfile
pnpm why phoenix-wing -r
pnpm verify:wing-dependencies
pnpm admin-plugin:verify
```

当前预期 `packages/admin-plugin/node_modules/phoenix-wing/package.json` 的版本为 `0.7.2`，其 realpath 位于本仓 `node_modules/.pnpm/` Registry store，而不是相邻源码目录。

## 升级规则

Wing 发布新版本后不自动跟随：

1. 修改 `packages/admin-plugin/package.json` 中的开发依赖与 peer dependency。
2. 更新 `pnpm-lock.yaml`。
3. 执行 `pnpm admin-plugin:verify`，完成 manifest、runtime、pack、双端类型和插件测试。
4. 在冻结 Host 上运行真实 Vue/Node production 构建和浏览器点检。
5. 在 [更新日志](CHANGELOG.md) 中记录版本与必要适配。

尚未发布的 Wing 代码只能在 Wing 仓自身验证，不能作为 Open Issue 的正式发布证据。
