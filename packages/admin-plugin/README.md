# Open Issue Admin Plugin

此目录是 Phoenix Admin / COOL 的跨前后端业务模块源码包，不是独立 Web 的第二套实现。

- `vue/phoenix-open-issue` 对应 Phoenix Admin Vue 的 `src/modules/phoenix-open-issue`
- `midway/phoenix-open-issue` 对应 Phoenix Admin Node 的 `src/modules/phoenix-open-issue`
- `manifest.json` 声明 Pah 路由、能力和宿主复用边界
- `midway/phoenix-open-issue/migrations` 保存随插件交付的 PostgreSQL DDL 制品；manifest v2 逐项声明路径和 SHA-256
- `midway/phoenix-open-issue/pah-plugin.artifacts.json` 让 Pah 在受控构建产物中自动发现同版本 SQL，不要求插件导入 Host 内部类
- `test/phoenix-open-issue/domain` 保存后端纯领域单元测试；不放入 Midway 运行时模块，也不冒充数据库集成测试

Host 只需提供插件声明的 peer dependencies。页面导引依赖的 `driver.js@1.6.0` 是 build-only 输入；插件交付包内包含带来源版本、字节大小、SHA-256、MIT license 和 `externalImports=0` 证明的 browser runtime ESM/CSS，Host 不安装 `driver.js`，也不添加产品 alias。

## 受控单元测试

维护页固定展示 17 个测试文件、101 条用例，不接受命令、目录或文件路径输入。可执行清单的 config/test SHA-256 与 Vitest 版本范围只保存在源码侧 `test/phoenix-open-issue/controlled-test-suite.json`，不进入生产包。

开发或受控内网运行时，Open Issue 只消费 Dev Hub 通过 `PHOENIX_DEV_HUB_CONTROLLED_TOOL_PROFILE` 注入的 schema 1 Profile，并复核 Vitest package 身份、realpath containment、pnpm lock identity/integrity、lockfile/entrypoint/package 三组 SHA，以及声明中的 config/test SHA。执行固定为 `process.execPath + Profile entrypoint + 17 个声明路径`，`shell: false`；不会搜索 PATH、调用 pnpm/npx、联网安装或读取页面输入。无 Profile、坏 Profile、外部启动和 production 均 fail-closed，但读取权限用户仍可看到固定清单与非敏感 `reasonCode`。

## 工作台输出

维护页的刷新、dry-run、repair 和受控测试过程只通过 Host `usePahWorkbenchOutput()` 追加到工作台实例级全局 Output。插件不贡献 Bottom，不创建输出 singleton、频道或结构化日志系统，也不会 replace/clear 其他 View 的全局输出。任务表、测试清单、修正审计 ledger、执行确认和可交互测试报告继续留在 View；Output 不写入请求体、绝对路径、完整业务快照或审计数据。

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
