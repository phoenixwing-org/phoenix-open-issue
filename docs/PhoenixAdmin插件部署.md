# Phoenix Admin 插件部署

状态：current

适用插件：`phoenix-open-issue@0.7.2`

本页是 Open Issue 接入 Phoenix Admin 的部署入口。开发模式与正式安装解决的问题不同，不得混用。

| 模式 | 用途 | 代码进入 Host 的方式 | 数据库处理 |
| --- | --- | --- | --- |
| 开发模式 | 本机联调、HMR、页面和接口迁移 | macOS/Linux 使用目录软链接；Windows 使用 Junction。产品源码仍只归 Open Issue 仓库 | 只登记、校验和查看 dry-run；不得用 `synchronize` 代替迁移 |
| 正式安装模式 | 测试、预发布和生产交付 | 冻结版本的 `.phoenix.cool` Phoenix 业务插件包，由 Phoenix Admin 受控装配 | manifest v2 迁移计划、可信备份、事务执行和 ledger 全部留证 |

## 1. 开发模式：目录挂载

默认目录结构是三个并列仓库：

```text
phoenix-open-issue/
phoenix-admin-vue/
phoenix-admin-node/
```

### 1.1 macOS / Linux：目录软链接

如 Host 不在默认位置，可设置 `PHOENIX_ADMIN_VUE_ROOT`、`PHOENIX_ADMIN_NODE_ROOT`。先在 Open Issue worktree 安装依赖，再执行：

```bash
pnpm admin-plugin:mount-dev-host
pnpm admin-plugin:status-dev-host
```

### 1.2 Windows PowerShell：Junction

Windows 不使用 `SymbolicLink`，避免开发者模式或管理员权限要求；仓库脚本沿用 `linkWinb64.ps1` / `LinkWinb64Common.ps1` 的 `New-Item -ItemType Junction` 模式，并在创建后强制校验 `LinkType` 与目标目录。脚本拒绝覆盖真实目录、文件或指向其它源码的 Junction。

三个仓库按默认方式并列时，在**普通权限** PowerShell 中进入 Open Issue 根目录后执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mount-admin-plugin-dev.ps1 -Action Mount
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mount-admin-plugin-dev.ps1 -Action Status
```

Host 不在默认并列目录时，用变量传参，不要把个人绝对路径写入仓库：

```powershell
$OpenIssueRoot = (Resolve-Path .).Path
$WorkspaceRoot = Split-Path -Parent $OpenIssueRoot
$VueHostRoot = Join-Path $WorkspaceRoot 'phoenix-admin-vue'
$NodeHostRoot = Join-Path $WorkspaceRoot 'phoenix-admin-node'

powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mount-admin-plugin-dev.ps1 `
  -Action Mount `
  -VueHostRoot $VueHostRoot `
  -NodeHostRoot $NodeHostRoot
```

`Status` 必须同时输出 Vue Host、Node Host 的 `LinkType=Junction`、目标匹配和 Git 本机排除有效。也可手工复核：

```powershell
$VueMount = Join-Path $VueHostRoot 'src\modules\phoenix-open-issue'
$NodeMount = Join-Path $NodeHostRoot 'src\modules\phoenix-open-issue'
Get-Item -Force $VueMount, $NodeMount | Select-Object FullName, LinkType, Target
```

两行 `LinkType` 都必须是 `Junction`。如源目录位于网络共享或文件系统不支持 Junction，脚本会失败并保留既有目标；不要退回需要提权的 `SymbolicLink` 冒充通过。

脚本建立两条源码链接：

```text
phoenix-admin-vue/src/modules/phoenix-open-issue
  -> packages/admin-plugin/vue/phoenix-open-issue

phoenix-admin-node/src/modules/phoenix-open-issue
  -> packages/admin-plugin/midway/phoenix-open-issue
```

插件自有的 `driver.js` 会按需桥接到 Vue Host；Vue、Vue Router、Pinia、Element Plus、Phoenix Wing 等运行时必须继续由 Host 提供单例。

两种挂载脚本都会把精确产品路径写入两个 Host 本机的 `.git/info/exclude`。因此：

- Host Git 不归档产品源码、链接或产品名配置；
- 不修改 Host 的 tracked `.gitignore`、`package.json` 或锁文件；
- 插件仓仍是唯一源码真源；
- 真实目录、其他来源的链接不会被脚本覆盖或删除。

挂载后重启 Admin Vue 和 Node。在 `/pah/plugins` 使用 [`packages/admin-plugin/manifest.json`](../packages/admin-plugin/manifest.json) 校验并登记插件，再按 Pah 显示的受控生命周期操作。当前 manifest 包含 DDL，普通“安装”不能绕过迁移门禁；应先查看只读 migration dry-run，不能为了本机方便启用 TypeORM `synchronize`。

已安装实例新增或修改路由贡献后，需要按 Pah 生命周期停用再启用，使菜单重新物化；不要直接修改菜单数据库。开发入口为：

```text
http://127.0.0.1:9000/open-issue/
```

开发完成后卸载本机目录挂载。macOS/Linux 执行：

```bash
pnpm admin-plugin:unmount-dev-host
```

Windows PowerShell 执行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\mount-admin-plugin-dev.ps1 -Action Unmount
```

该命令只移除仍指向本插件的链接及其 `.git/info/exclude` 标记，不卸载 Pah 记录，也不删除业务数据。需要先在 `/pah/plugins` 停用插件，避免 Host 保留无法加载的菜单。

### 1.3 开发挂载与 manifest 登记点检

```bash
pnpm admin-plugin:status-dev-host
git -C ../phoenix-admin-vue status --short
git -C ../phoenix-admin-node status --short
git -C ../phoenix-admin-vue check-ignore -v src/modules/phoenix-open-issue
git -C ../phoenix-admin-node check-ignore -v src/modules/phoenix-open-issue
```

两个 `git status` 都不应因挂载出现产品文件；`check-ignore` 必须指向各仓本机 `.git/info/exclude`。

仓内先执行 `pnpm admin-plugin:verify-manifest`。随后重启 Vue/Node Host，在 `/pah/plugins` 使用已登录的管理员会话选择 Open Issue 仓内的 `packages/admin-plugin/manifest.json` 完成校验与登记；不要在文档、命令历史或复检证据中粘贴 Cookie、令牌或真实连接串。登记后记录 Host 返回的脱敏 module/version/status，并继续按 migration dry-run、可信备份和受控生命周期操作。

## 2. 正式安装模式：不可变制品 + Pah

正式环境禁止使用开发软链接、`link:`、`file:`、`workspace:` override 或直接复制到 Host 主工作树。`*.phoenix.cool` 是 Phoenix 声明式业务插件包，不是 COOL 原生可执行 Hook 包；开发阶段只接受这一后缀，旧 `.pah.cool` 一律拒绝。包内没有 `src/index.js` 或 `source/index.ts`，上传到旧 `/helper/plugins` 安装器必须因格式不完整而安全拒绝，不能执行包内脚本。

发布前先执行固定顺序：

```bash
# runtime build → descriptor/integrity → source pack → immutable business package
pnpm admin-plugin:release-package

# 独立复核已生成包；默认路径为 dist/admin-plugin/phoenix-open-issue-0.7.2.phoenix.cool
pnpm admin-plugin:verify-production-package

# 以两个冻结且 clean 的 Host 根目录装配到普通一次性目录
pnpm admin-plugin:assemble-clean-host -- \
  --archive /absolute/path/phoenix-open-issue-0.7.2.phoenix.cool \
  --node-host /absolute/path/clean-admin-node \
  --vue-host /absolute/path/clean-admin-vue \
  --output /absolute/path/new-empty-assembly
```

`release-package` 先重建 `driver.js@1.6.0` browser runtime 和 descriptor，再强制执行完整 `admin-plugin:verify`（包含 runtime/manifest/pack、确定性生产打包、模块闭包、双端 typecheck 和全部插件测试），最后才生成正式不可变包；不能依赖发布者此前手工跑过测试。如生成结果使工作树变脏，正式打包立即拒绝，必须审查并提交新字节/SHA 后再试。包生成使用固定文件顺序和时间戳、逐文件 SHA-256、同目录临时文件和 hard-link no-replace 发布。同名目标或发布边界并发占用均 fail-closed，不覆盖既有字节。

生产包只含 Node/Vue 产品模块、manifest、descriptor、migrations、许可证与元数据；不含测试、受控测试配置、`node_modules` 或安装脚本。`plugin.json` 固定声明 `kind=pah-business-module`、`coolNativeHook=false`，并携带 Host peerDependencies、源码仓库 URL、精确 commit、dirty 标志和保留数据策略。独立验包默认拒绝 `dirty=true` 的制品，内部确定性测试才可显式接受 dirty fixture。

正式交付按以下顺序执行：

1. 冻结并记录插件、Admin Vue、Admin Node 和 Phoenix Wing 的 commit 与版本；工作树必须干净。
2. 执行 `pnpm admin-plugin:verify`，校验模块闭包、类型、测试、runtime/manifest/descriptor、SQL 路径及原始字节 SHA-256；pack 收入不能代替 runtime 完整性。
3. 使用 `admin-plugin:release-package` 生成 clean、不可变业务包，再在独立装配目录构建 Vue/Node production 制品并部署到约定运行目录；产品源码不能进入 Host Git。
4. 在 `/pah/plugins` 登记与该制品同版本的 manifest v2 并执行校验；当前治理页负责清单和生命周期，不把开发 Link 当成安装包。Node 是迁移制品和 checksum 的权威校验端。
5. 对 `migrations/*.sql` 只先生成一次性 dry-run 计划；计划必须显示版本、checksum、事务要求、到期时间和待执行项。
6. 取得可信备份证明并完成恢复演练后，才允许受控执行迁移；执行结果写入 migration ledger。普通安装入口不得执行 DDL。
7. 安装并启用插件，分配 capability，验证菜单、冷启动深链、真实 404、API 权限及宽窄屏页面。
8. 保存构建体积、测试数量、浏览器旅程、备份、恢复和 ledger 证据，再决定是否发布。

生产 Node 必须关闭 TypeORM `synchronize`。停用只移除运行时 contribution；普通卸载在 Pah 中先要求停用和可信备份引用，再把状态置为 `uninstalled`，并固定保留 9 张 `oip_*` 业务表、7 类产品字典、migration/repair/dictionary ledger 与管理员导航 assignment。下次无插件 production 装配移除代码；重装同稳定 `moduleId` 后恢复 contribution 和原数据。永久清除不是普通卸载的一部分，必须另走具备可信备份和 `phoenix-open-issue:data:purge` 权限的显式流程。回滚优先停用插件并按 ledger/备份恢复，不直接删表或手工改 Pah 菜单。

## 3. 当前发布边界

不可变 `.phoenix.cool` 的 build/verify、全文件 SHA、确定性与原子不覆盖门禁已经落地；Node clean Host production build 也已通过，并复制出 Pah descriptor 与两条 SQL。两个专用隔离 PostgreSQL 16 库已完成 `0.6.1 → 0.6.2`、真实备份/恢复、停用、普通卸载保留 9 张表/7 类字典/ledger/assignment 和重装不重放 migration 的历史闭环。`0.7.0` 又在生产模拟 Admin 中初步跑通安装、启用、停用和普通卸载，但操作步骤仍较多，同版本重装与跨版本升级继续作为独立验收项，不把本次初步验证写成全自动生产发布完成。正式装配精确使用 Registry `phoenix-wing@0.7.1`，并必须通过当次 clean Host production build；禁止用临时 `file:`/override 或相邻源码冒充生产通过。

详细验收状态见[用户点检表](admin-plugin-rectification/用户点检表.md)。开发挂载的命名与联调背景见 [Phoenix Admin 开发联调](admin-plugin-rectification/开发联调.md)。
