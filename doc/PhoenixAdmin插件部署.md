# Phoenix Admin 插件部署

状态：current

适用插件：`phoenix-open-issue@0.6.1-admin.0`

本页是 Open Issue 接入 Phoenix Admin 的部署入口。开发模式与正式安装解决的问题不同，不得混用。

| 模式 | 用途 | 代码进入 Host 的方式 | 数据库处理 |
| --- | --- | --- | --- |
| 开发模式 | 本机联调、HMR、页面和接口迁移 | 软链接（Link）挂载，产品源码仍只归 Open Issue 仓库 | 只登记、校验和查看 dry-run；不得用 `synchronize` 代替迁移 |
| 正式安装模式 | 测试、预发布和生产交付 | 冻结版本的不可变制品，由 Pah 受控装配 | manifest v2 迁移计划、可信备份、事务执行和 ledger 全部留证 |

## 1. 开发模式：Link 挂载

默认目录结构是三个并列仓库：

```text
phoenix-open-issue-admin/
phoenix-admin-vue/
phoenix-admin-node/
```

如 Host 不在默认位置，可设置 `PHOENIX_ADMIN_VUE_ROOT`、`PHOENIX_ADMIN_NODE_ROOT`。先在 Open Issue Admin worktree 安装依赖，再执行：

```bash
pnpm admin-plugin:mount-dev-host
pnpm admin-plugin:status-dev-host
```

脚本建立两条源码链接：

```text
phoenix-admin-vue/src/modules/phoenix-open-issue
  -> packages/admin-plugin/vue/phoenix-open-issue

phoenix-admin-node/src/modules/phoenix-open-issue
  -> packages/admin-plugin/midway/phoenix-open-issue
```

插件自有的 `driver.js` 会按需桥接到 Vue Host；Vue、Vue Router、Pinia、Element Plus、Phoenix Wing 等运行时必须继续由 Host 提供单例。

挂载脚本还会把精确产品路径写入两个 Host 本机的 `.git/info/exclude`。因此：

- Host Git 不归档产品源码、链接或产品名配置；
- 不修改 Host 的 tracked `.gitignore`、`package.json` 或锁文件；
- 插件仓仍是唯一源码真源；
- 真实目录、其他来源的链接不会被脚本覆盖或删除。

挂载后重启 Admin Vue 和 Node。在 `/pah/plugins` 使用 [`packages/admin-plugin/manifest.json`](../packages/admin-plugin/manifest.json) 校验并登记插件，再按 Pah 显示的受控生命周期操作。当前 manifest 包含 DDL，普通“安装”不能绕过迁移门禁；应先查看只读 migration dry-run，不能为了本机方便启用 TypeORM `synchronize`。

已安装实例新增或修改路由贡献后，需要按 Pah 生命周期停用再启用，使菜单重新物化；不要直接修改菜单数据库。开发入口为：

```text
http://127.0.0.1:9000/open-issue/
```

开发完成后卸载本机链接：

```bash
pnpm admin-plugin:unmount-dev-host
```

该命令只移除仍指向本插件的链接及其 `.git/info/exclude` 标记，不卸载 Pah 记录，也不删除业务数据。需要先在 `/pah/plugins` 停用插件，避免 Host 保留无法加载的菜单。

### 开发挂载点检

```bash
pnpm admin-plugin:status-dev-host
git -C ../phoenix-admin-vue status --short
git -C ../phoenix-admin-node status --short
git -C ../phoenix-admin-vue check-ignore -v src/modules/phoenix-open-issue
git -C ../phoenix-admin-node check-ignore -v src/modules/phoenix-open-issue
```

两个 `git status` 都不应因挂载出现产品文件；`check-ignore` 必须指向各仓本机 `.git/info/exclude`。

## 2. 正式安装模式：不可变制品 + Pah

正式环境禁止使用开发软链接、`link:`、`file:`、`workspace:` override 或直接复制到 Host 主工作树。正式交付按以下顺序执行：

1. 冻结并记录插件、Admin Vue、Admin Node 和 Phoenix Wing 的 commit 与版本；工作树必须干净。
2. 执行 `pnpm admin-plugin:verify`，校验 UI 保真、模块闭包、类型、测试、manifest、descriptor、SQL 路径及原始字节 SHA-256。
3. 在独立装配目录或专用 Host worktree 构建 Vue/Node production 制品，并部署到约定的运行目录；产品源码不能进入 Host Git。
4. 在 `/pah/plugins` 登记与该制品同版本的 manifest v2 并执行校验；当前治理页负责清单和生命周期，不把开发 Link 当成安装包。Node 是迁移制品和 checksum 的权威校验端。
5. 对 `migrations/*.sql` 只先生成一次性 dry-run 计划；计划必须显示版本、checksum、事务要求、到期时间和待执行项。
6. 取得可信备份证明并完成恢复演练后，才允许受控执行迁移；执行结果写入 migration ledger。普通安装入口不得执行 DDL。
7. 安装并启用插件，分配 capability，验证菜单、冷启动深链、真实 404、API 权限及宽窄屏页面。
8. 保存构建体积、测试数量、浏览器旅程、备份、恢复和 ledger 证据，再决定是否发布。

生产 Node 必须关闭 TypeORM `synchronize`。插件卸载默认保留 `oip_*` 业务数据；永久清除必须同时具备可信备份和 `phoenix-open-issue:data:purge` 权限。回滚优先停用插件并按 ledger/备份恢复，不直接删表或手工改 Pah 菜单。

## 3. 当前发布边界

开发 Link 挂载、manifest v2、SQL 制品校验、隔离 PostgreSQL 恢复演练、双端 production build 和 Pah dry-run 已有证据。可信备份验证器与真实 migration ledger 执行仍是正式切换门禁；在它们闭环前，本页描述的是正式安装流程，不代表当前版本已经获准生产发布。

详细验收状态见 [迁移审计](admin-plugin-rectification/迁移审计.md) 和 [用户点检表](admin-plugin-rectification/用户点检表.md)。开发挂载的命名与联调背景见 [Phoenix Admin 开发联调](admin-plugin-rectification/开发联调.md)。
