# Open Issue Admin Plugin

此目录是 Phoenix Admin / COOL 的跨前后端业务模块源码包，不是独立 Web 的第二套实现。

- `vue/phoenix-open-issue` 对应 Phoenix Admin Vue 的 `src/modules/phoenix-open-issue`
- `midway/phoenix-open-issue` 对应 Phoenix Admin Node 的 `src/modules/phoenix-open-issue`
- `manifest.json` 声明 Pah 路由、能力和宿主复用边界
- `midway/phoenix-open-issue/migrations` 保存随插件交付的 PostgreSQL DDL 制品；manifest v2 逐项声明路径和 SHA-256
- `midway/phoenix-open-issue/pah-plugin.artifacts.json` 让 Pah 在受控构建产物中自动发现同版本 SQL，不要求插件导入 Host 内部类
- `test/phoenix-open-issue/domain` 保存后端纯领域单元测试；不放入 Midway 运行时模块，也不冒充数据库集成测试

Host 需提供插件声明的 peer dependencies。当前 UI 原样保留页面导引，因此除 Vue、Pinia、Element Plus、Phoenix Wing 外，还需要 `driver.js@^1.6.0`；这不是插件自己的第二套框架运行时。

## 开发挂载与正式安装

本机联调使用仓库提供的安全 Link 脚本：

```bash
pnpm admin-plugin:mount-dev-host
pnpm admin-plugin:status-dev-host
pnpm admin-plugin:unmount-dev-host
```

开发链接只写入本机 Host 工作区和 `.git/info/exclude`，不能作为正式安装产物。正式环境必须使用冻结的不可变制品，通过 Pah 的 manifest、migration dry-run、可信备份和受控生命周期安装。完整步骤见 [Phoenix Admin 插件部署](../../doc/PhoenixAdmin插件部署.md)。

生产环境不依赖 TypeORM `synchronize` 建表。Pah 先校验 SQL 制品并生成只读 dry-run，再由受控发布编排在可信备份通过后执行；默认缺少备份验证器时必须安全拒绝，不允许把开发环境自动建表当成生产迁移。

Issue 迁移采用“UI 整体复制、接口集中修正”的方式。模板和样式以 `legacy/2cdc5ea` 为金样本；迁移阶段允许脚本、接口和类型暂时未接通，但不得为了通过编译重做页面。

```bash
pnpm admin-plugin:sync-issue-ui
pnpm admin-plugin:adapt-issue-imports
pnpm admin-plugin:verify-issue-closure
pnpm admin-plugin:verify-issue-ui
```

同步命令只用于建立或重新覆盖迁移基线。开始接口适配后，不应在未审查差异的情况下重复运行。
