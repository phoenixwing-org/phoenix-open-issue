# Phoenix Admin 插件整改讨论稿

状态：active

Owner：Open Issue maintainers / Phoenix Admin Host maintainers

开始执行：2026-08-01

## 1. 这轮讨论要解决什么

`admin` 分支的目标不是重新设计 Open Issue，而是把既有 Open Issue 以**前端插件 + 后端插件**的方式接入 `phoenix-admin`。宿主适配可以改变外壳、身份来源、路由前缀和 API 接入方式，但不能在没有单独产品决策的情况下改变业务页面的信息结构、操作位置和使用习惯。

本目录记录已经确认的边界、执行方法和验收证据。当前实现以 `legacy/2cdc5ea` 为基线。

## 2. 当前建议结论

1. **页面基线固定为 `legacy/2cdc5ea`。** `admin` 已从该提交重新建立；两个 worktree 共享仓库历史，`legacy` 保持为不可变对照。
2. **不在 `legacy` 上继续做 MVC 改造。** UI 批量复制、脚本分离和接口适配都在 `admin` 内完成，避免污染金样本。
3. **Host 中现有 Open Issue 页面只是技术原型。** `phoenix-admin-vue/src/modules/open-issue/views` 下另写的 `oip-*` 页面证明了路由、权限和 API 可以闭环，但不能继续成为产品页面的事实源。
4. **业务代码归插件，不归宿主。** Open Issue 的页面、组件、领域服务、实体和 migration 应由本仓库产出的前后端插件包拥有；Host 只拥有插件加载、壳层、身份、用户/部门、菜单、通用能力与生命周期。
5. **第一阶段先做 COOL 双端源码插件。** `vue/phoenix-open-issue` 与 `midway/phoenix-open-issue` 分别对应两个 Host 的 `src/modules/phoenix-open-issue`；签名上传、在线安装、升级和受控重启在页面等价之后继续演进。
6. **Admin 已完成 Wing 0.6 壳层适配。** Open Issue 不再建立或迁移自己的 Wing Workbench，只向 Admin 已有的 Wing 0.6 Host 壳贡献业务页面。
7. **Wing 区域贡献跟随 `2cdc5ea` 原页面。** 首轮保留现有 Main/Primary/Secondary 语义，只把 POI registry 适配到 Pah registry；不新增 Properties/Bottom，也不重新拆页面。
8. **采用“原样迁移，再换接口”的顺序。** 第一遍迁移保持页面模板、样式、组件结构、信息密度和交互不变；页面进入 Host 且通过对照后，第二遍才逐项替换身份、用户、路由、字典和 API 接口。

## 3. 仓库角色建议

| 工作区/仓库 | 建议角色 | 不应承担的角色 |
|---|---|---|
| `phoenix-open-issue-admin` worktree | `admin` 分支；前后端插件包、共享领域、manifest、迁移与保真验收 | 第二套宿主壳；重新设计业务页面 |
| `phoenix-open-issue` worktree | `legacy` 分支；独立 Web、对照、回归和独立部署 | Admin 插件实现工作区 |
| `phoenix-admin-vue` | Host 外壳、导航、Tab、身份、共享 UI 能力和前端插件装载 | 长期保存 Open Issue 业务页面副本 |
| `phoenix-admin-node` | Host 会话、用户/部门、权限上限、审计、插件生命周期和后端装载 | 长期保存 Open Issue 领域实现副本 |
| `phoenix-wing` | 通用工作台布局和贡献协议 | 决定 Open Issue 页面内容如何重新排列 |

## 4. 讨论材料

- [现状与偏差](现状与偏差.md)：为什么当前结果已经超出 Layout 适配。
- [目标插件边界](目标插件边界.md)：前端插件、后端插件、Host 与 Wing 各自负责什么。
- [页面保真验收](页面保真验收.md)：哪些页面和交互必须保持，哪些变化属于允许的宿主适配。
- [设置能力迁移边界](设置能力迁移边界.md)：legacy 设置页各分区在插件、Cool Host 和本机偏好之间的归属。
- [分阶段整改计划](分阶段整改计划.md)：在不继续扩大返工面的前提下如何推进。
- [Issue 批量迁移执行记录](Issue批量迁移执行记录.md)：当前已执行的脚手架、批量迁移与保真门禁。
- [Phoenix Admin 开发联调](开发联调.md)：短产品 URL、唯一技术 ID、实时源码链接和 Host 验证方式。
- [用户点检表](用户点检表.md)：每轮完成后由用户验证开发挂载、插件生命周期、页面保真和当前允许失败项。
- [Admin 插件迁移 TODO](TODO.md)：Issue 业务闭包、图标能力和 COOL/Wing 复用研究。
- [统一迁移审计](迁移审计.md)：UI、算法、测试、代码量、交付尺寸和框架收益的统一口径及 Issue 当前快照。

详细审计底稿和 Issue/Function/Bom3 的纵向统计归档到同级 `phoenix-ai-workspaces`；源码仓库只保存会影响实现、CI 或验收的入口材料。

## 5. 已确认决策

1. 页面金线为 `legacy/2cdc5ea`；
2. 首批迁移“列表管理 → 列表详情 → Issue 查看/编辑与点检/推送依赖闭包”；
3. 先搭 COOL 双端插件脚手架并批量放文件，再集中修接口和编译；
4. 中间步骤不要求逐步编译通过，但 template/style 保真检查必须持续通过。
