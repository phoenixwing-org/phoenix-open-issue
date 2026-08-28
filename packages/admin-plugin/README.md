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

仓库门禁固定执行 27 个测试文件、149 条用例，不接受页面、命令参数或任意目录扩张测试范围。可执行清单的 config/test SHA-256 与 Vitest 版本范围只保存在源码侧 `test/phoenix-open-issue/controlled-test-suite.json`，不进入生产包。

开发或受控内网运行时，Open Issue 的测试服务仅保留为源码侧受控工具实现，不再注册产品页面、route、capability 或 Controller endpoint。测试门禁复核 Vitest package 身份、realpath containment、pnpm lock identity/integrity、lockfile/entrypoint/package 三组 SHA，以及声明中的 config/test SHA；执行固定为 `process.execPath + Profile entrypoint + 27 个声明路径`，`shell: false`，不会搜索 PATH、调用 pnpm/npx 或联网安装。

## Host 维护边界

系统维护统一由 Host 的 `/phoenix/maintenance` 提供。Open Issue 不再贡献私有维护/测试页面，也不暴露重复的维护执行 endpoint。`checkpoints`、`links`、`list-org-references` 三项业务修正规则、旧站导入算法和既有 repair ledger 仅作为待接入资产保留；在 Host adapter schema 冻结前不自行猜造 Registry 描述，也不允许 Host 接收任意 SQL、脚本或文件路径。

## 开发挂载与正式安装

macOS/Linux 本机联调使用仓库提供的安全 Link 脚本：

```bash
pnpm admin-plugin:mount-dev-host
pnpm admin-plugin:status-dev-host
pnpm admin-plugin:unmount-dev-host
```

Windows PowerShell 使用 `scripts/mount-admin-plugin-dev.ps1` 创建 Vue/Node 两处 `Junction`，普通权限即可执行；不要改用需要开发者模式或提权的 `SymbolicLink`。在仓库根目录打开 PowerShell，用本机 Host 根目录设置变量，不要把个人绝对路径写入仓库：

```powershell
$VueHostRoot = '<path-to-phoenix-admin-vue>'
$NodeHostRoot = '<path-to-phoenix-admin-node>'

& .\scripts\mount-admin-plugin-dev.ps1 `
  -Action Mount `
  -VueHostRoot $VueHostRoot `
  -NodeHostRoot $NodeHostRoot

& .\scripts\mount-admin-plugin-dev.ps1 `
  -Action Status `
  -VueHostRoot $VueHostRoot `
  -NodeHostRoot $NodeHostRoot

Get-Item "$VueHostRoot\src\modules\phoenix-open-issue" | Select-Object FullName, LinkType, Target
Get-Item "$NodeHostRoot\src\modules\phoenix-open-issue" | Select-Object FullName, LinkType, Target
```

两处 `LinkType` 都必须是 `Junction`，`Target` 分别指向本仓库 Vue/Node 插件源目录。挂载后在 Host 的 Vue 和 Node 终端各按一次 `Ctrl+C`，等待进程退出后重新执行 Host 原启动命令；不要假定 HMR 会重新解析链接目标。卸载只删除本脚本管理且目标匹配的 Junction：

```powershell
& .\scripts\mount-admin-plugin-dev.ps1 `
  -Action Unmount `
  -VueHostRoot $VueHostRoot `
  -NodeHostRoot $NodeHostRoot
```

开发目录挂载只写入本机 Host 工作区和 `.git/info/exclude`，不能作为正式安装产物。正式环境必须使用冻结的不可变 `.phoenix.cool` Phoenix 业务插件包，通过 Phoenix Admin 的 manifest、migration dry-run、可信备份和受控生命周期安装。开发阶段不兼容旧 `.pah.cool` 后缀：

```bash
pnpm admin-plugin:release-package
pnpm admin-plugin:verify-production-package
pnpm admin-plugin:assemble-clean-host -- \
  --archive /absolute/path/phoenix-open-issue-0.7.2.phoenix.cool \
  --node-host /absolute/path/clean-admin-node \
  --vue-host /absolute/path/clean-admin-vue \
  --output /absolute/path/new-empty-assembly
```

发布命令强制 `browser runtime build → 完整 admin-plugin:verify → 最终不可变包`，其中完整门禁包含 descriptor/integrity、pack、确定性生产打包、模块闭包、双端 typecheck 和全部插件测试；不能依赖发布者此前手工跑过测试。正式工作树必须 clean；包内绑定源码仓库 URL 与 40 位 commit，独立验包默认拒绝 dirty 制品；相同输入得到相同包 SHA，同名目标和并发占用目标均拒绝覆盖。包不含测试、工具、`node_modules` 或原生 Hook 入口。它不能上传到 COOL `/helper/plugins` 执行；`plugin.json` 明确 `kind=pah-business-module` 和 `coolNativeHook=false`，错误安装器必须 fail-closed。

生产环境不依赖 TypeORM `synchronize` 建表。Pah 先校验 SQL 制品并生成只读 dry-run，再由受控发布编排在可信备份通过后执行；默认缺少备份验证器时必须安全拒绝，不允许把开发环境自动建表当成生产迁移。

普通卸载只在停用后移除 contribution 和下一版装配中的代码，固定保留 9 张业务表、7 类字典、migration/repair/dictionary ledger 与管理员导航 assignment；永久清理必须是另一条显式、受权且可恢复的流程。
