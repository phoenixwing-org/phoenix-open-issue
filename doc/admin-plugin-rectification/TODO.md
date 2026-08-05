# Admin 插件迁移 TODO

状态：active

本文件只保存会影响实现或验收的短清单。详细的跨项目统计、审计底稿和历史快照后续归档到同级仓库 `phoenix-ai-workspaces`；构建门禁和可执行脚本继续留在源码仓库。

## Issue 业务闭包

### P0：Issue View 第二轮统一调整

- [x] **P0-1 先完成维护合页**：`maintenance.vue` 已吸收单元测试，唯一 `PoiMaintenancePrimary` 导航“数据修正 / 单元测试 / 修正审计”；独立测试 View/Primary 和可见菜单已删除，旧 `/open-issue/test-runner` 只保留 `isShow=false` 的同 View 深链。
- [x] **P0-2 先统一四个高频 View**：Dashboard、8D、功能表与维护共同消费薄层 `PoiCompactEditorView`；按 Wing current《Pnw 工作台 Web · 页面布局与 Header》改为默认 `PnwPageMainBlock` 10px inset，不再由 Issue 强制 `bodyInset=false` 或自建左右 16px gutter。
- [x] 本轮优先源码切片：`dashboard.vue` 把区段/范围/状态筛选移入新增 Wing Primary；`eight-d-reports.vue` 和 `functions.vue` 去掉 Primary/页头重复动作，统一紧凑 Editor、页头和表格布局。
- [x] `lists.vue`、`list-detail.vue` 源码收口：列表范围/搜索/类型进入 Primary；详情的数据筛选和简单/复杂/跟踪显示设置进入 Primary；页头只保留新建、成员、编辑等页面级动作，Editor 直接衔接提示/待办/表格。
- [x] `push-history.vue` 源码收口：Primary 只保留状态与计数，刷新回到页头；紧凑 Editor、空态、边界和按钮层级保持 Host 语义。
- [x] `issue-detail.vue` 源码收口：保留四向 16px 和详情卡片；Primary 去掉重复标题、编辑、推送、返回，只保留编号/状态/章节导航；8D 新建只保留章节内动作，页头保留编辑/推送。
- [x] Dashboard、8D、功能表与维护页删除重复的 `PnwPageHeader + .page` 壳；共享布局源码契约测试固定默认 MainBlock、维护/测试同 View/同 Primary、隐藏兼容路由以及 repair 读写权限拆分。
- [x] **P0-3 继续逐页收口**：`lists.vue`、`list-detail.vue`、`push-history.vue` 已删除旧 `PnwPageHeader + .page` 壳和左右 16px，迁到同一 `PoiCompactEditorView` 与 Wing 默认 MainBlock；各自 Primary 和页头动作不变。`issue-detail.vue` 因自带完整详情卡片保留四向 16px 作为明确例外，不做机械全局覆盖。
- [x] 11 项布局源码契约覆盖 7 个共享数据 View、Issue 详情 16px 例外、维护/测试同 View/同 Primary、隐藏兼容路由以及 repair 读写权限拆分。
- [x] Admin 本地 resolver 已精确锁定包含 `PnwPageLayout/PnwPageMainBlock` 的 Wing `e21f47275060d297c44d35c3d8bd8be034b1cc8d`；插件 manifest/peer 同步 fail closed 为 `phoenix-wing >=0.6.2 <0.7.0`。当前七页 10px 版本的隔离 production build 已通过，真实浏览器矩阵仍待完成。
- [x] 前一轮只读浏览器 fixture 曾验证旧 `padding: 0 16px` 下的宽窄屏、明暗主题和 Primary 无重叠；该尺寸已被 Wing current 默认 10px 规则取代，只保留为历史证据，不作为本轮布局通过结论。
- [x] **P0-4a 先修正开发真源**：确认用户先前看到的是主 checkout `f399ac95` 的旧 SFC；Admin Vue module symlink 已临时改挂 d11c candidate，Vite 自动重启后用户确认 8D 标题恢复正常，七个当前 SFC URL 均返回 200。该证据只属于 d11c worktree，不冒充主 checkout 已修。
- [x] **P0-4b 锁定运行时闭包**：统一窗口已将 Vue/Node symlink 锁到 clean 产品 `399ac372c615814ddd85f12f0dd939658fa05e3f`，Pah `0.6.2-admin.0` enabled、`0002` 唯一 applied、38 contributions；隐藏 test-runner 共用 maintenance，五个 GET 管理员 200 / 匿名 401，未执行 repair。
- [x] **P0-4c 真实浏览器复验**：Admin `1c5531b` + Wing `dbdd70d4` 下干净重启 Vite；PageHelp 完成 tooltip→本页导引→1/4→2/4→Close 且 dialog/overlay 清零；dashboard/lists/list-detail/push-history/8D/functions/maintenance/issue-detail/隐藏 test-runner 全部冷新标签命中，720/1440、light/dark、各 tab console warn/error=[]，Ribbon 无可见“单元测试”按钮。该证据属于产品 `399ac372`；Runner `available=false` 当时仍诚实保留，未计为测试执行通过。
- [x] **P0-5a Issue Primary 源码对齐 BOM/Cool 金样本**：dashboard、lists、list-detail、issue-detail、push-history、8D、functions、maintenance 共 8 个真实 Primary contribution 已改用 Wing `PnwPrimaryPanel` + `PnwPrimarySection`；Panel 的贴边、连续底边与 `gap: 0` 由 Wing 管理，业务控件组只保留 8px inset。未给无 Primary 的 View 造假入口；原字段、按钮、权限判断、事件、算法与 Pinia 数据流保持不变。
- [x] **P0-5b Section 状态与静态门禁**：各 Section 独立受控折叠，插件以稳定 View key 保存状态，list-detail / issue-detail 只追加实体 ID，且最多保留 64 个 View/实体状态；不使用 `fullPath`、query 或无界路由 key，Host 总 Primary 开关契约不变。门禁禁止产品 `<aside>` 外壳、14px 外 padding、手写 separator/caret、`:deep(.pnw-sidebar-block-body)`；既有 layout 测试仍为 11 项，受控测试声明 SHA 已同步。完整 `admin-plugin:verify` 通过：17 文件/101 项测试、UI fidelity 3 exact + 28 approved deltas、pack 121 项/145,048 bytes。另以 Admin `1c5531b` clean Git archive + Wing `dbdd70d4` 完成隔离 production build：2,872 modules，8 个 Primary 所属路由 chunk 均生成；仅有 4 个既存 Host 通用依赖 empty chunk，没有 `types/Pnw*` empty chunk。
- [x] **P0-5c 真实浏览器验收**：产品 `b36e9a27e94763362a5c9294e6d2d937f62b4fb6` 以有界 `sessionStorage` 保持 Section 折叠状态；Dashboard“列表范围”折叠后整页刷新仍保持折叠，Functions 保持自己的默认展开，证明跨 View 隔离。当前闭包 17 files / 101 tests、Host 候选 17 files / 56 tests、typecheck 和 3,018 modules production build 均通过。浏览器只触发唯一一次“全部运行”，固定 17 文件/101 用例为 101 通过/0 失败，运行中按钮禁用，Output 无绝对路径，最终 console warn/error=[]；匿名 files/status/run 均 401 且没有第二次执行。唯一 run 前后及匿名请求后两次 27 表综合 SHA 均为 `94596b04f5689542aa41e0fa771901979a3919480a9d646c8d6fd01cf7789712`，逐表 diff=0，未执行 repair。

- [x] 列表管理、列表详情、Issue 详情原样迁移；
- [x] 点检表单、状态、时间线及调度算法纳入依赖闭包；点检不是遗漏的独立 View；
- [x] 推送发起弹层、推送历史原样迁移；
- [x] 8D 报告列表和 Issue 内 8D 弹层原样迁移；
- [x] 仪表盘和任务中心原样迁移；
- [x] 通过 Pah manifest 为仪表盘、推送历史和 8D 报告登记动态路由/菜单，不再依赖旧开发桥；
- [x] 迁移 Midway Controller、Service、Entity 与 manifest v2 SQL migration，让上述页面接入真实 API；
- [x] BOM `c782319fe109c9faa72281b1020d647e723d4f58` 的 `/bom-studio/parts` 仍是已批准视觉样本，但 gutter 规则已由 Wing current 文档细化：普通 raw table/CRUD 使用默认 MainBlock 10px；只有自带完整卡片/MainBlock 的详情页才自行持有 inset；
- [x] 紧凑 Editor、Issue 详情、维护/测试区以及已迁表单/对话框/抽屉的页面面、文字、边界、hover/focus/readonly 已改用 Host Element Plus/Wing 语义 token；保留业务卡片和风险确认层级，不新增 Issue 主题状态；
- [x] UI fidelity 增加 raw semantic color 门禁：映射范围内裸 `#hex/rgb(a)` CSS、内联 style 或脚本颜色字符串 fail closed；允许 Host token 中的兼容 fallback；
- [x] 用户已确认当前 Issue Primary 正常且效果可接受；Primary 继续由 Wing `d3ddc913` 拥有，Issue 不写定位补丁；
- [ ] 在本轮 MainBlock/semantic token 同时生效后，继续浏览器复验宽窄屏、明暗主题、新标签冷加载和表格边缘；
- [ ] 用真实数据完成点检编辑/状态切换和推送接受/拒绝/撤回；8D 增删改及 Issue 关联已完成临时数据回归并清理。

## 附属入口

- [x] 原样迁移功能简表，保留筛选、排序、增改停用、XLSX 导入、JSON 导出和 Issue 关联；
- [x] 将功能数据迁入插件表 `oip_function`，不归入 Host 设置；
- [x] 迁移 Open Issue 单元测试页面；公开清单固定为 17 个稳定 test ID / 101 条用例，页面无命令或路径输入，无/坏 Profile 与 production 仍展示清单和非敏感 `reasonCode`，但运行 fail-closed；
- [x] 恢复插件维护入口中的 Issue 数据库修正；Issue 字典继续复用 Host namespaced 字典，不复制设置页；
- [x] 数据库修正先完成 `checkpoints` / `links` 的纯规划算法与管理员 Midway API；拒绝 schema、Host 用户和 SQLite 任务；
- [x] 单元测试已用当前 Wing Workbench 契约简化并合并进 `/open-issue/maintenance`；最终 manifest 只保留“维护”一个可见 View/菜单入口。
- [x] 新建 `PoiMaintenancePrimary`，由维护 View 通过 `usePoiViewContribution` 注册；Primary 负责“数据修正 / 单元测试 / 修正审计”的区段导航与只读概况，Editor 保留对应内容和风险确认。
- [x] 合并 UI 不合并权限：继续分别消费 `maintenance:read/run` 与 `test:read/run`，无测试权限时隐藏测试区，无修正权限时隐藏/禁用修正动作；Pah endpoint 授权保持不变。
- [x] 从 manifest 删除独立“单元测试”可见菜单，并删除 `test-runner.vue`、`PoiTestRunnerPrimary.vue` 的重复布局；`/open-issue/test-runner` 仅以 `isShow=false` 共用 `maintenance.vue` 并默认进入测试区。
- [x] Dev Hub `153bcf6e3b093083968ccc0c73f2c4afb77a1129` 提供唯一保留键 `PHOENIX_DEV_HUB_CONTROLLED_TOOL_PROFILE`；产品消费者复核 schema/profile/tool/version、realpath containment、package identity/bin、pnpm lock identity/integrity、lockfile/entrypoint/package 三组 SHA 及 config/test SHA。执行固定为 `process.execPath + Profile entrypoint + 17 个声明路径`、`shell=false`，清理 `NODE_OPTIONS` / `NODE_PATH` / `VITEST_*`，并保持单并发、180 秒、2 MiB 上限；不再递归扫描、探测产品 `node_modules` 或调用 pnpm/PATH/网络。
- [x] source-only 执行声明与合法/无/坏 Profile 隔离矩阵通过；插件门禁保持 17 files / 101 tests，pack 为 120 项 / 143,137 bytes，声明/config/测试源码/工具二进制/node_modules/fixture 均为 0；Admin Node 精确 `tsc --noEmit` 和隔离 Admin `1c5531b` + Wing `dbdd70d4` production build 通过，未重启服务。
- [x] 真实 DevHub Profile 运行闭环：Vue/Node 均锁定 clean 产品 `73e181c5`，管理员页面展示固定 17 文件/101 用例并真实运行 101 通过/0 失败，files/status/run 消费同一受控 Profile；匿名 files/status/run 均为 401，无 Profile 外部启动为 503，运行前后 27 张数据库表 hash 完全一致。页面没有命令或路径输入，Output 不泄露绝对路径；该证据不是隔离 fixture。无 `test:run` 的已登录角色 403 仍须在具备该角色样本的受控窗口单独验证，不并入本条已完成结论。
- [x] Maintenance → Host 全局 Output 源码收口：刷新、dry-run 指纹/有效期/简单计数、repair 执行和测试运行等纯文本过程追加到 Host `usePahWorkbenchOutput()`；View 只保留任务表、测试清单、ledger、确认对话框和可交互报告结果，删除“最近一次 dry-run”与“数据库修正结果”重复区。不贡献 Bottom、不建插件 singleton/频道/level/filter，不输出秘密、请求体、完整业务快照或审计数据；产品只 append，不 replace/clear 全局输出，因此切 View 保留且重进不重放。完整插件门禁、文档门禁和隔离 Host production build 已通过。
- [x] 冻结提交 `73e181c5` 的真实 Host Output 验收通过：刷新追加“正在刷新/已刷新 2 项”；dry-run 只追加指纹 `b3cf0c96e3ee`、有效期、计划 0 项/幂等及未写入说明，页内不再出现“最近一次 dry-run/数据库修正结果”；切到 Functions 后输出保留，返回 Maintenance 不重放完成行。计划为 0 时“执行修正”只追加“当前无需写入”，未发 repair 写请求、未泄露响应体；隐藏 test-runner 复用 Maintenance，720/1440、light/dark、console warn/error=[]。本轮没有为制造分支而造脏数据，确认取消和服务端失败的真实浏览器分支留待可控 fault-injection 验收，不能冒充已覆盖。
- [x] 本轮七个共享 `PnwPageLayout` View、Issue 详情 inset 例外、维护权限拆分及 Output 边界通过 manifest/settings boundary/closure/UI/typecheck/pack 与 17 文件/101 项插件测试；UI fidelity 为 3 exact + 28 approved deltas，pack 为 120 项/144,481 bytes 且测试/fixture 为 0。
- [x] 在 `/tmp` 隔离的 Admin Vue `a26007fc` 源码副本挂入当前插件，并以本地 Wing `0.6.2@e21f4727` 完成 production build：2,869 modules；生成 dashboard/8D/functions/maintenance 四个非空 chunk，无 test-runner chunk，也无 `types/Pnw*` empty chunk；隔离目录已删除。
- [x] 第二轮列表/详情/推送源码在 `/private/tmp` 隔离 Host Vue `03c0c4b5` + Wing `0.6.2@e21f4727` production build 通过：2,869 modules；lists/list-detail/push-history/issue-detail JS raw 分别为 11,443 / 46,418 / 8,836 / 40,700 bytes，gzip 为 4,478 / 14,561 / 3,776 / 13,108 bytes；无 `types/Pnw*` empty chunk，临时目录已删除。
- [x] 当前七页默认 MainBlock 10px 版本在隔离 Host Vue `03c0c4b5` + Wing `0.6.2@e21f4727` production build 通过：2,871 modules；九个 Issue 路由 chunk 均生成，未生成独立 test-runner chunk，也未出现旧 `types/Pnw*` empty chunk。日志只剩 4 个 Host 通用依赖 empty chunk；临时目录已删除。
- [x] 历史证据：旧 16px 四页共享布局曾在隔离 Host Vue `03c0c4b5` + 精确 Wing `0.6.2@e21f4727` production build 通过，且无独立 test-runner chunk、无 `types/Pnw*` empty chunk；只作编译回归历史。
- [x] 历史证据：旧 16px 四页共享布局曾完成只读浏览器隔离验收，Primary 展开/收起及窄屏标题不相交，`/maintenance` 与 `/test-runner` 共用标题和 Primary；该证据不关闭当前 10px 版本的 P0-4。
- [x] 使用真实 `maintenance.vue`、精确 Wing `0.6.2@e21f4727` 和内存 API 的隔离浏览器权限夹具复验 4 种模式：仅 `maintenance:read` 只显示并完成 dry-run、写计数为 0；增加 `maintenance:run` 后才出现二次确认且确认后模拟 POST 计数为 1；仅 `test:read` 自动显示固定测试清单且无运行按钮；无权限只显示 Cool 角色告警。旧 `/test-runner` 深链进入同一维护 View，console warn/error 为 0。该证据不连接数据库，也不替代真实 Host 授权物化。
- [x] 真实 Host 浏览器布局复验：宽窄屏、明暗主题、新标签冷加载，以及旧 `/open-issue/test-runner` 打开同一维护 View 的测试区均通过；无双菜单、双标题或页面 console warn/error。四种权限的后端 200/401/403 与真实 Runner 执行仍按上方独立运行门禁验收。
- [x] 密码、登录方式、用户和组织改为 Host 入口：插件包已删除无调用者的 login/password、external-auth 和 org-tree 类型，不物化对应 route/API/task；Host 用户选择统一消费 `base:sys:user:list`，后端 `base_sys_user` adapter 仅允许只读；
- [ ] 按《附属入口迁移归属》完成 legacy/Admin 双开点检。

## 图标能力

- [x] 修复空图标和问号：Pah 重物化 manifest 的 `pnw:*` 稳定 ID，Wing 对未知 ID 显示可见 fallback；
- [x] 把 legacy 页面图标能力迁为 `pnw:` / Host namespace 注册与解析契约；
- [x] 明确 Pah manifest/Nav 只保存稳定 icon ID，不序列化 Vue Component；
- [x] 由 Host/Wing renderer 解析 icon ID，避免插件全局注册组件；
- [x] Dashboard、Lists、Push History、8D 已显示真实 SVG 且无 fallback，并验证旧问号来自旧标签模块缓存；
- [ ] 将图标契约做成 Admin Fixture 插件示例，供 Function、Bom3 直接照用。

## COOL / Wing 复用研究

| 能力 | 当前结论 | 状态 |
| --- | --- | --- |
| 登录、token、当前用户 | 复用 `useBase().user`；插件不迁移 Login/OAuth/会话存储 | 已接入 |
| 用户列表、启停 | 复用 `service.base.sys.user`；领域层 ID 保持 string，由 adapter 转换 | 已接入首切片 |
| 部门/组织 | 复用 COOL 用户管理 `/sys/user` 与部门服务；插件只保存业务成员关系 | 待固化 SDK |
| 数据字典 | 读取与日常 CRUD 复用 COOL；Issue manifest 已声明 catalog/preset/协议值；当前不加 Host JSONB，也不建无运行需求的 Issue sidecar | Issue 入口完成；Node `e9f1de9` 与 Vue `fe5d801` 为 clean 隔离候选，待装配、部署与物化 |
| 路由/菜单/Tab | 短产品路由 `/open-issue/*`，唯一技术 ID `phoenix-open-issue`；Pah 管注册，Vue Router 管页内跳转 | 已接入首切片 |
| Wing 区域贡献 | 旧 POI facade 统一转到 Pah registry，不迁第二套 Workbench | 已接入首切片 |
| 文件上传 | 复用 COOL comm/upload 与 Host 存储策略，插件只保存业务附件引用 | 待研究 |
| 权限 | legacy `systemRole` 改由 Cool 角色/capability；列表成员、所有者、Issue 可见范围仍属于插件领域算法；Issue service 级矩阵已通过，Host 显式 endpoint middleware 仍仅是 dirty 候选 | 待迁入 Host 并做真实非 root 联合点检 |
| 审计、任务、参数、备份 | 使用 Host lifecycle/adapter，不在插件中复制平台表和管理页；Issue repair ledger 已实现，dictionary ledger 已形成当前 Node 基线的 clean 隔离候选，可信备份仍待后续 | 待合入/部署、真实备份/恢复 |

## Wing Primary 公共结构

- [x] 冻结 Wing `e21f47275060d297c44d35c3d8bd8be034b1cc8d`，消费统一 Header、Primary 开关、`PnwPrimaryPanel` / `PnwPrimarySection` 与 `PnwPageMainBlock`；`6bd3dfc`、`749554c`、`568cc4c`、`4446a316` 只保留为祖先阶段证据；
- [x] 仅迁移原本真实贡献 Primary 的 7 个 View，不给无 Primary 页面新增伪贡献；
- [x] 去除插件重复的 aside、outer padding、Section header/caret/toggle 和跨组件 deep CSS，保留业务控件 8px inset；
- [x] 折叠状态按 `viewId:sectionId` 写入现有设置 Store，纯算法及非法输入边界已有测试；
- [x] 开发者浏览器点检 7/7 页面满宽、28px 标题条、折叠/刷新恢复、标题安全区，以及白天/黑天主题和控制台；
- [x] 用户按《用户点检表》复核白天/黑天/跟随系统及七页折叠状态。
- [x] 清点产品源码：不存在重复 Primary 整体开关、定位或 Header 暗色补丁；Dashboard 的 tabs 网格只负责产品工具条排列，不接管 Wing chrome；
- [x] 评估 `PnwPageLayout`：本阶段不批量替换 legacy View 根容器；Wing Header/Body 结构层均为 0，默认/显式 inset 通过无业务 provider 的 `PnwPageMainBlock` 提供 10px。
- [x] 按用户确认仅将 `/open-issue/lists` 迁入 `PnwPageLayout`：单一 Header、结构 gap/padding=0；该页没有独立 `cl-crud`/MainBlock，显式 `bodyInset=true` 复用 Wing 的 10px 便捷补位，其他 View 暂不扩散。
- [x] 开发者按 Wing `568cc4c` 复验 Dashboard/列表/Function：无 Primary 无空槽；26px 开关与 32px Header 安全区正常；720/1440、白天/黑天无标题遮挡、水平溢出或控制台告警。
- [x] 按 Wing `4446a316` 增量复验带 32px action 的单行 Header 实际高度为 40px、标题/actions/底边对齐，并 smoke 原 720/1440、白天/黑天矩阵。
- [x] 按 Wing `e21f4727` 复验列表页 `PnwPageLayout`：Header/Body 结构 padding=0、MainBlock=10px、Header→Body gap=0；1440/720、白天/黑天、Primary 收起/恢复及控制台均无回归。

判定规则：只有语义和生命周期都属于平台的能力才复用 Host；Issue 分类、点检状态、列表成员等领域含义不能为了减少文件数而错误塞入平台公共模型。

## 设置能力迁移边界

- [x] 只读核实 `legacy/2cdc5ea` 的 6 个设置页签、API、表、算法和来源 commits；
- [x] 只读核实当前 `phoenix_admin`：插件已启用，`0002` 唯一 applied 后 9 张 `oip_*` 表存在，但 `phoenix-open-issue.*` 字典类型/条目仍为 0；
- [x] 冻结 7 个稳定字典 type key、item value、允许定制字段、默认 preset 和卸载保留策略；
- [x] 决定当前不扩 Cool JSONB、不建 Issue sidecar；产品策略由 manifest、协议 adapter 与 Pah ledger 承担，未来出现租户 runtime policy 再建 plugin-owned sidecar；
- [x] 将 Pah 通用 dictionary contribution、dry-run、独立 root-only reconcile、ledger 和审计快照迁到当前 Admin Node 基线隔离候选：`e9f1de913f71fd89efb6c5cb21bf8665d9a829d3`；4 suites / 21 tests、lint、diff-check 通过，Host 不硬编码 Issue。该 commit 尚未合入共享 Host、未部署、未执行 schema 或物化；
- [ ] 将 Pah 插件页 dictionary reconcile ledger 的根管理员分页审计从 dirty 候选迁到当前 Host；列表不得返回 plan/result JSON 快照；
- [x] 在隔离当前基线候选中修正 Cool 字典 Key 的 20 字符 UI 限制并补 namespace 校验：Vue `fe5d801af811b307e1decf63d502bf8b9255c49f` 定向测试 3/3、typecheck 通过；Node `e9f1de913f71fd89efb6c5cb21bf8665d9a829d3` 同时提供 128 字符 schema 与唯一索引定义核验。两者仍未合入共享 Host、schema 未执行；
- [ ] 将 capability 显式 method/path 与非 root middleware 放行/拒绝门禁从 dirty Node 候选迁到当前 Host；Issue service 级资源矩阵不能替代真实 Cool capability 联合旅程；
- [x] 为插件 Midway `OpenIssueAccessService` 增加 6 项服务级矩阵：匿名 401、root 资源旁路但对象 404、owner/viewer 可读、reporter 可创建、editor 可修改、关联列表只授予读取且修改仍锚定来源列表；该证据只关闭 plugin-owned 资源角色半边，真实 Cool capability 联合旅程仍待运行；
- [x] 新增 Host-owned 设置边界门禁：校验 manifest `identity/users/departments/roles` 复用声明、禁止账号/登录/密码/组织 route 与 endpoint、禁止 legacy `systemRole` 和相关类型回流、禁止绕过 Cool 用户列表权限，并固定日常 repair 仅 `checkpoints+links`；3 项 fail-closed 回归通过；
- [x] 插件首次导航固定进入 Host `pah-group-business` /“业务”组；manifest 不创建或选择 `ISSUE` 产品大组，管理员对稳定 target key 的手工分配保留；
- [x] 增加 Pah 静态生命周期门禁：停用后插件菜单、角色菜单和贡献映射归零；全部 migration 已 applied 时零 SQL、零新增 ledger；
- [ ] 将 `activationMode: restart` 通用 activation guard 从 dirty Node 候选迁到当前 Host：未登记、停用、编译 descriptor 与数据库版本错配均返回 404，root admin 不旁路；
- [ ] 完成插件 API 启用 200 → 停用 404 → 再启用 200；产品 `b36e9a27` 已装配并关闭 UI/Runner 门禁，但当前 Host 尚未包含上述 activation guard 候选；
- [ ] 在真实运行环境验证 Cool 角色授权、Pah capability 与 Issue 列表资源角色的联合 200/403；
- [ ] 将 Host 可信 PostgreSQL 备份 manifest provider adapter 从 dirty Node 候选迁到当前 Host，并补齐真实 backupId→provider→migration/uninstall 的生产编排；Issue 只声明 `oip_*` 表，不复制 legacy 整库页；
- [x] 备份范围静态闭包升级为 manifest `dataOwnership`、TypeORM Entity、SQL migration `CREATE TABLE` 三方完全一致；当前 9 张 `oip_*` 表闭合，schema-qualified/Host 表/漏声明表均 fail closed，3 项契约回归通过；
- [ ] 接入真实 Host 全局备份生成/保留系统并完成一次恢复演练；
- [ ] **A｜可信 PG 备份门禁**：在任何 DDL、repair 或 legacy import 前，由 Host 全局系统生成覆盖 9 张 plugin-owned 表的可信 manifest/artifact，验证保留策略并完成独立 PostgreSQL restore drill；无真实恢复证据时 fail closed；
- [x] **B1｜legacy JSON 最小可见入口（Vue）**：Maintenance 已提供原生 JSON 文件选择、本地 `JSON.parse` 只读摘要、8 类业务表行数、排除数据提示和受控导入按钮/状态；预检不上传文件，导入按钮始终 fail-closed 到“待接入/需要可信备份”，过程只写 Host Output，不调用 API、不直写数据库、不提供旧 `replace/merge`；
- [ ] **B2｜legacy JSON transitional import 后端**：旧站/SQLite 只允许离线导出版本化、带 producer/SHA/bytes 的 JSON；服务端提供字段白名单、重复/引用/冲突、用户/部门 ID 映射或拒绝报告、一次性 plan、确认与 ledger。只迁 8 张业务表，不导入 `oip_repair_ledger`、用户/密码/登录/角色或 Host 字典；字典交 Pah reconcile。执行前必须先有 A 的真实恢复证据，并在隔离 PG 库完成黄金查询演练；
- [x] **字典 Maintenance 薄入口（源码）**：展示 automotive 预设 7 类的缺失/已存在/冲突、保留自定义计数和 dry-run 指纹；确认后直连 Pah 独立 root-only reconcile，过程写 Host Output；不复用 `maintenance:run`、不直写 Cool 表，编辑/停用/删除跳 Cool 字典页。仍待 Node/Vue 候选装配后的 API/page smoke 与真实物化；
- [ ] **字典后续细化**：增加 preset 查询/切换契约、software 预设切换预览与升级策略；第一版只物化 manifest 当前 `automotive` 预设（7 类、37 项），catalog 中其余 software 候选不自动混装；
- [x] 为 maintenance 增加 GET dry-run、用户确认、TTL、SERIALIZABLE 重算和 repair ledger；
- [x] 维护页已把只读 dry-run 与写执行拆开：`maintenance:read` 可独立预览计划且明确零写入，只有 `maintenance:run` 才显示确认执行；manifest GET/POST endpoint 与 View 动作由源码契约测试锁定；
- [x] 为 maintenance 增加仅持有 Host `maintenance:read` 的管理角色可读的 repair ledger 分页查询和最近审计表；API 只返回 actor/status/time/fingerprint/error 元数据，不暴露 before/result JSON 快照；
- [ ] 在可信备份与恢复责任明确后，再考虑 `issueNo`/reports；
- [ ] 按《设置能力迁移边界（整改实施草案）》完成 Host schema、Issue migration、字典物化与真实用户点检；本任务不得直接写库。

## SQLite 全仓清理（盘点已启动，删除待门禁）

当前口径：Admin 插件交付闭包已无 SQLite；整个 Open Issue 仓库尚未清理完成。

只读盘点已确认：整改 worktree 与主 checkout 以 hidden/no-ignore 口径均没有 `.sqlite/.sqlite3/.db/-wal/-shm` 数据文件；`data/` 虽被整体忽略，当前也没有命中。仓库仍有 `node-sqlite3-wasm`、adapter/config/schema/migration/tests、`.env.sqlite.example`、重建脚本和 current transitional 规则。详见《SQLite 清理执行草案》。

启动前置：

- [x] 增加只接受显式绝对文件的 SQLite 只读资产清单工具，输出 realpath、SHA-256、大小、mtime、owner 与保留期；未对真实旧库执行；
- [x] 增加 SQLite/PG full export 离线对账工具与 fail-closed 测试，覆盖表内容、关键引用、Issue links/listCount 和字典唯一性；未连接数据库；
- [x] 增加 `sqlite:audit-cleanup` 源码/文档边界审计与 `--check` 门禁；首个过渡快照为 production 18 文件/63 命中、current docs 1 文件/7 命中；正式 runner、通用 factory/public export 和 login-policy fixture 收敛后当前降为 production 13 文件/54 命中、current docs 1 文件/7 命中，严格清零门禁仍按预期不通过；
- [x] 在严格清零前增加 `sqlite:audit-no-regression`：对当前已分类的 13 份 production 与 1 份 current-doc 过渡资产设置逐文件命中上限，允许继续减少，禁止新文件或命中回增；4 项 audit 回归通过；
- [x] 第一批文档清理：旧 Linux 部署、早期架构、旧库重建和已落地迁移设计已标 historical/draft；current 文档由 9 份 SQLite 命中降到仅 `.claude/rules/no-better-sqlite3.md`；
- [x] standalone 正式模板和默认解析已切到 PostgreSQL：未配置 `DATABASE_URL`、混配 `DB_PATH` 或未显式 opt-in legacy SQLite 时 fail closed；配置测试 6/6；
- [x] 继续收紧 legacy 配置：删除默认旧库路径；生产环境拒绝 SQLite；非生产演练必须显式绝对 `DB_PATH` 并只指向可丢弃工作副本；修正 `.env.sqlite.example` 错误的“只读归档”表述；
- [x] 上述配置与清理证据共 3 files / 13 tests 通过；以 `/private/tmp` 隔离源码副本覆盖完整当前 `packages/server/src` 后，server TypeScript production compile 通过，临时目录已删除；
- [x] 删除无任何调用者的同步 standalone 管理员权限函数；现行 Controller/Service 仅保留 async executor 版本，不再扩展旧同步 bridge；
- [x] 先将 standalone 管理员角色 carry 语义迁为纯 executor 契约测试：绑定查询、缺失用户默认 editor、admin 放行和 editor 403，不启动旧数据库 fixture；
- [x] 正式 async schema/migration runner 已改为 PostgreSQL-only 并拒绝非 PG adapter；legacy SQLite 初始化仍隔离在显式 opt-in 的同步 schema bridge，不写正式 migration ledger；
- [x] 通用 schema/migration runner 测试已迁到 PostgreSQL recording adapter；login-policy 从 2 个 SQLite 集成断言迁为 4 个注入式契约断言，不再启动数据库；
- [x] 删除无调用者的通用 async DB factory，并从 `pnw/index.ts` 移除 SQLite adapter 公共导出；正式 async connection 直接构造 PostgreSQL adapter，legacy 恢复仍走显式内部路径；
- [x] 4 个仍覆盖 legacy 恢复与领域语义的 full-server SQLite fixture 改为显式 `ALLOW_LEGACY_SQLITE=true`，另保留 1 个驱动专属 adapter 测试，不放宽生产配置；
- [ ] 从实际部署/备份位置取得并冻结最后一批 legacy SQLite 文件的只读归档、校验和、owner 和保留期限；仓库内没有可替代的数据库文件；
- [ ] 完成 SQLite→PostgreSQL 导入演练，核对表数、行数、主外键、字典、Issue 链接和黄金查询；
- [x] standalone 正式配置默认 PostgreSQL，缺配置时 fail closed，不回退 SQLite；legacy adapter 暂以非生产、显式 `ALLOW_LEGACY_SQLITE=true` 和绝对工作副本路径保留给导入演练；
- [ ] 将仍有价值的 SQLite 迁移/恢复说明归档为 historical，不在验证前删除唯一恢复入口。

执行范围：

- [ ] 删除 `node-sqlite3-wasm` 依赖和 lockfile 残留；
- [ ] 删除剩余 SQLite env/config、同步 connection、adapter 分支、schema/migration bridge 和专属 repair；通用 factory 已删除；
- [ ] 将仍验证领域语义的 SQLite 测试迁为纯算法或 PostgreSQL 集成测试，再删除 SQLite 专属测试与 fixture；
- [ ] 删除/归档 `.env.sqlite.example`、`migrate-rebuild-db.*` 和只服务旧 SQLite 的脚本；
- [ ] PG-only 代码切换后改名/移除最后一份 current SQLite 兼容规则；README、部署、架构、使用手册和代码规范的正式支持表述已完成第一批清理，历史迁移文档保留 archived 标记和替代入口；
- [ ] 更新 `document-policy.json`、文档索引/manifest、CI 命令和 pack 清单；
- [ ] 运行全库搜索，生产源码、依赖、配置和 current 文档中 SQLite 命中为 0；历史归档命中单独列出；
- [ ] 完成 PostgreSQL 单元/集成/生产 build 与真实启动点检后，再声明全仓清理完成。

## Host 业务副本清理

- [x] Midway Controller、Service、Entity、migration 和产品测试迁回插件包；
- [x] Host 从插件 manifest 注册业务路由、菜单、能力码与 API namespace；
- [x] 删除 Phoenix Admin Vue 的临时桥、Open Issue 设置页和 `OpenIssuePrototypeManifest.ts`；
- [x] 删除 Phoenix Admin Node 的 `src/modules/open-issue`，验证 Pah 离开任何内置业务模块仍可独立工作；
- [x] 将 Admin Fixture 改为通用示例，不把 Open Issue 固化成框架内置样例。

详细历史证据归档在 `phoenix-ai-workspaces/open-issue/work/Host中OpenIssue业务副本调查-2026-08-01.md`。

## 统一审计

- [x] 增加可复算的文件数、行数、源码字节和测试用例统计脚本；
- [x] 固定 UI、算法、测试、Host adapter、未迁移平台壳的统计口径；
- [x] 本轮最新产品门禁通过：`b36e9a27` 为 Issue 17 files / 101 tests；Host 当前候选装配为 17 files / 56 tests、typecheck 和 3,018 modules production build；唯一浏览器 run 为 101/101，前后 27 表 hash 不变。11 项布局契约覆盖七个 MainBlock View、Issue 详情 inset 例外及 8 个 Wing PrimaryPanel/Section。另有 dirty Host 设置候选的离线历史证据：Vue 长 key 字段归属 17 files / 56 tests、typecheck/build，Pah Node 6 suites / 65 tests、TypeScript/lint；这些候选未提交、未迁入，不能计作当前 Host 能力。standalone dirty 源码隔离全量 Vitest 为 30 files / 206 tests 通过、2 files / 9 个真实 PG 条件测试跳过，Server TypeScript `--noEmit` 与 production build 通过，SQLite no-regression 为 production 13 files / 54 matches、current docs 1 / 7；除已证明零写的受控 Runner 外，均未连接或修改开发/生产数据库；
- [x] UI fidelity 改为嵌套感知的完整 SFC template/style 提取，并以 4 个回归证明内层 slot template 之后的突变会使指纹变化；另以 3 个回归覆盖 semantic color 门禁；不再使用会提前终止的非贪婪 template 正则；
- [x] 前端受控挂载 production build 通过；9 个路由入口含 CSS 为 186,774 bytes raw / 64,000 bytes gzip，同一 Host 无插件基线的完整 dist 增量为 293,515 / 101,339 bytes；当前构建未生成 brotli；
- [x] 后端隔离 production build 通过并记录源码包压缩/解包体积、dist descriptor/SQL 大小与 SHA；
- [x] 新增真实 `npm pack --dry-run` 门禁并接入 `admin-plugin:verify`；当前 verifier 口径为 121 项/145,048 bytes，测试、fixture、Vitest/tsconfig 与 `node_modules` 进包数为 0，2 个 migration 制品完整；
- [ ] Issue API 闭环后发布最终审计报告；
- [x] Function、BOM 使用同一 Skill 与审计模板：Function 已到 55% 并完成双库恢复演练，BOM 首只读纵切 75% 并量化避免复制 45 文件/5,876 行 Host 壳层。
