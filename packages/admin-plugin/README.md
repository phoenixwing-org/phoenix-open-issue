# Open Issue Admin Plugin

此目录是 Phoenix Admin / COOL 的跨前后端业务模块源码包，不是独立 Web 的第二套实现。

- `vue/phoenix-open-issue` 对应 Phoenix Admin Vue 的 `src/modules/phoenix-open-issue`
- `midway/phoenix-open-issue` 对应 Phoenix Admin Node 的 `src/modules/phoenix-open-issue`
- `manifest.json` 声明 Pah 路由、能力和宿主复用边界

Host 需提供插件声明的 peer dependencies。当前 UI 原样保留页面导引，因此除 Vue、Pinia、Element Plus、Phoenix Wing 外，还需要 `driver.js@^1.6.0`；这不是插件自己的第二套框架运行时。

Issue 迁移采用“UI 整体复制、接口集中修正”的方式。模板和样式以 `legacy/2cdc5ea` 为金样本；迁移阶段允许脚本、接口和类型暂时未接通，但不得为了通过编译重做页面。

```bash
pnpm admin-plugin:sync-issue-ui
pnpm admin-plugin:adapt-issue-imports
pnpm admin-plugin:verify-issue-closure
pnpm admin-plugin:verify-issue-ui
```

同步命令只用于建立或重新覆盖迁移基线。开始接口适配后，不应在未审查差异的情况下重复运行。
